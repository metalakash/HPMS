"""Sprint D3 through the API. Needs the migrated test database from conftest (skipped without one)."""

from datetime import date, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.database import get_db
from backend.app.main import app


@pytest.fixture
async def api(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client:
        yield client
    app.dependency_overrides.pop(get_db, None)


async def login(api, username: str) -> dict:
    r = await api.post("/api/v1/auth/login", json={"username": username, "password": f"{username}123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---------------------------------------------------------------- stakeholder history (C.9)

async def test_interactions_build_a_stakeholder_history_with_an_average_rating(api):
    admin = await login(api, "admin")
    contact = (await api.post("/api/v1/stakeholders", headers=admin, json={
        "name": "Ram Thapa", "organization": "Department of Electricity Development", "email": "ram@example.org",
        "category": "external"})).json()
    base = f"/api/v1/stakeholders/{contact['id']}/interactions"

    maker = await login(api, "maker")
    first = await api.post(base, headers=maker, json={
        "interaction_date_ad": "2026-09-01", "kind": "meeting", "rating": 4, "summary": "Licence renewal discussed"})
    assert first.status_code == 201, first.text
    assert first.json()["interaction_date_bs"]  # the Bikram Sambat date is filled in
    await api.post(base, headers=admin, json={"interaction_date_ad": "2026-10-01", "kind": "letter", "rating": 2,
                                              "summary": "Reply came six weeks late"})
    await api.post(base, headers=admin, json={"interaction_date_ad": "2026-10-05", "kind": "call",
                                              "summary": "Not rated"})

    history = (await api.get(base, headers=admin)).json()["interactions"]
    assert [i["interaction_date_ad"] for i in history] == ["2026-10-05", "2026-10-01", "2026-09-01"]
    listed = next(c for c in (await api.get("/api/v1/stakeholders", headers=admin)).json()["contacts"]
                  if c["id"] == contact["id"])
    assert (listed["interaction_count"], listed["average_rating"], listed["last_interaction_ad"]) == (3, 3.0, "2026-10-05")

    # Deleting the contact deletes its history with it
    assert (await api.delete(f"/api/v1/stakeholders/{contact['id']}", headers=admin)).status_code == 204


@pytest.mark.parametrize("body,problem", [
    ({"interaction_date_ad": (date.today() + timedelta(days=2)).isoformat(), "summary": "Planned"}, "future"),
    ({"interaction_date_ad": "2026-10-01", "kind": "telegram", "summary": "Odd"}, "kind must be one of"),
    ({"interaction_date_ad": "2026-10-01", "rating": 6, "summary": "Too good"}, "less than or equal to 5"),
])
async def test_bad_interactions_are_refused(api, body, problem):
    admin = await login(api, "admin")
    contact = (await api.post("/api/v1/stakeholders", headers=admin, json={
        "name": "Sita Rai", "email": "sita@example.org", "category": "external"})).json()
    r = await api.post(f"/api/v1/stakeholders/{contact['id']}/interactions", headers=admin, json=body)
    assert r.status_code == 422 and problem in r.text


async def test_an_auditor_reads_the_history_but_cannot_add_to_it(api):
    admin = await login(api, "admin")
    contact = (await api.post("/api/v1/stakeholders", headers=admin, json={
        "name": "Hari KC", "email": "hari@example.org", "category": "external"})).json()
    auditor = await login(api, "auditor")
    base = f"/api/v1/stakeholders/{contact['id']}/interactions"
    assert (await api.get(base, headers=auditor)).status_code == 200
    r = await api.post(base, headers=auditor, json={"interaction_date_ad": "2026-10-01", "summary": "No"})
    assert r.status_code == 403


# ---------------------------------------------------------------- Nepali search (TECH B.7)

from backend.app.i18n.search_text import contains, normalise, normalised_column  # noqa: E402

QA_PRECOMPOSED = "\u0958"            # क़ as one character
QA_DECOMPOSED = "\u0915\u093c"       # क + nukta
ZWJ = "\u200d"


def test_the_same_word_typed_two_ways_normalises_the_same():
    assert normalise(f"{QA_PRECOMPOSED}ाठमाडौं") == normalise(f"{QA_DECOMPOSED}ाठमाडौं")
    assert normalise(f"क्{ZWJ}षेत्र") == normalise("क्षेत्र")
    assert normalise("  Khola ") == "khola"


def test_like_wildcards_in_a_query_are_taken_literally():
    assert contains(r"50%_a\b") == r"%50\%\_a\\b%"


async def test_a_stored_nepali_name_is_found_whichever_way_the_query_is_typed(db_session):
    from sqlalchemy import select
    from backend.app.models.project import Project

    db_session.add(Project(project_code="NP-001", name_en="Qa Khola", name_np=f"{QA_PRECOMPOSED}{ZWJ}ा खोला",
                           province="Gandaki", installed_capacity_mw=1, project_stage="operation",
                           pipeline_status="under_operation"))
    await db_session.flush()
    for typed in (f"{QA_DECOMPOSED}ा", f"{QA_PRECOMPOSED}ा खोला"):
        query = select(Project.project_code).where(
            normalised_column(Project.name_np).like(contains(normalise(typed)), escape="\\"))
        assert (await db_session.execute(query)).scalars().all() == ["NP-001"], typed


# ---------------------------------------------------------------- field-level read rights (A.1)

from backend.app.security.read_policy import READ_POLICY, redact, withheld_for  # noqa: E402


def test_guests_are_denied_every_confidential_field_and_staff_none():
    assert withheld_for(["guest"]) == frozenset(READ_POLICY)
    for role in ("admin", "maker", "approver", "auditor"):
        assert withheld_for([role]) == frozenset()


def test_redaction_reaches_nested_fields_and_reports_what_it_hid():
    data = {"data": [{"project": "A", "loan": {"sanctioned_amount": "10", "facility_type": "term_loan"}}],
            "dscr": None}
    redacted, found = redact(data, frozenset({"sanctioned_amount", "dscr"}))
    assert redacted == {"data": [{"project": "A", "loan": {"sanctioned_amount": None, "facility_type": "term_loan"}}],
                        "dscr": None}
    assert found == {"sanctioned_amount"}  # a field that was already empty is not reported


def _values_of(data, fields, path=""):
    """(path, value) for every non-null occurrence of the fields, at any depth."""
    if isinstance(data, dict):
        for key, value in data.items():
            if key in fields and value is not None:
                yield f"{path}.{key}", value
            yield from _values_of(value, fields, f"{path}.{key}")
    elif isinstance(data, list):
        for index, item in enumerate(data):
            yield from _values_of(item, fields, f"{path}[{index}]")


async def test_no_endpoint_shows_a_guest_a_confidential_figure(api, db_session):
    """Every GET route a guest can call, over a seeded portfolio. A new endpoint that returns a confidential
    field to a guest fails here."""
    from backend.scripts import seed_realistic_data

    await seed_realistic_data.seed(db_session, today=date(2026, 10, 5))
    admin = await login(api, "admin")
    project = (await api.get("/api/v1/projects", headers=admin, params={"stage": "operation", "page_size": 1})).json()["data"][0]
    guest = await login(api, "guest")

    paths = set()
    for path, operations in app.openapi()["paths"].items():
        if "get" not in operations or not path.startswith("/api/"):
            continue
        if "{" not in path:
            paths.add(path)
        elif path.count("{") == 1 and ("{project_id}" in path or "{id}" in path):
            paths.add(path.replace("{project_id}", project["id"]).replace("{id}", project["id"]))
    leaks, checked = [], 0
    from backend.app.security.read_policy import EXEMPT_PATHS
    for path in sorted(p for p in paths if not p.startswith(EXEMPT_PATHS)):
        r = await api.get(path, headers=guest)
        if r.status_code != 200 or "application/json" not in r.headers.get("content-type", ""):
            continue
        checked += 1
        leaks += [f"{path} {where}" for where, _ in _values_of(r.json(), READ_POLICY)]
    assert checked >= 10, f"only {checked} endpoints answered the guest"
    assert leaks == [], "confidential fields shown to a guest:\n" + "\n".join(leaks[:20])

    # Staff still see them, and the guest is told something was withheld
    loans_admin = (await api.get(f"/api/v1/projects/{project['id']}/loan-accounts", headers=admin))
    loans_guest = (await api.get(f"/api/v1/projects/{project['id']}/loan-accounts", headers=guest))
    if loans_guest.status_code == 200:
        assert list(_values_of(loans_admin.json(), {"sanctioned_amount"}))
        assert "sanctioned_amount" in loans_guest.headers.get("x-fields-withheld", "")


# ---------------------------------------------------------------- currencies (B.3)

async def test_a_usd_facility_shows_its_npr_equivalent_at_the_rate_in_force(api, db_session):
    from decimal import Decimal
    from backend.app.models.financial import LoanAccount
    from backend.app.models.project import Project
    from backend.app.services import fx

    admin, approver, admin2 = await login(api, "admin"), await login(api, "approver"), await login(api, "admin2")

    async def rate(code, value, day, expect=200):
        r = await api.post("/api/v1/mutations/submit-with-justification", headers=admin, json={
            "entity_type": "EXCHANGE_RATE", "entity_id": code, "action": "UPDATE",
            "changes": {"rate_to_npr": value, "effective_from_ad": day, "source_reference": "NRB reference rate"},
            "justification": "Reference rate published by the central bank (test)"})
        if expect != 200:
            assert r.status_code == expect, r.text
            return r
        rid = r.json()["data"]["approval_request_id"]
        assert (await api.post("/api/v1/mutations/approve", headers=approver, json={"approval_request_id": rid})).status_code == 200
        done = await api.post("/api/v1/mutations/approve", headers=admin2,
                              json={"approval_request_id": rid})
        assert done.status_code == 200, done.text
        return done

    today = date.today()
    await rate("USD", "130.00", (today - timedelta(days=30)).isoformat())
    await rate("USD", "133.50", (today - timedelta(days=1)).isoformat())
    await rate("USD", "200.00", (today + timedelta(days=10)).isoformat())  # not yet in force
    duplicate = await rate("USD", "131", (today - timedelta(days=1)).isoformat(), expect=400)
    assert "already on file" in duplicate.text
    assert (await rate("NPR", "1", today.isoformat(), expect=400)).status_code == 400

    rates = await fx.load(db_session)
    assert rates.on("USD", today - timedelta(days=10)).rate_to_npr == Decimal("130.00")
    assert rates.to_npr(Decimal("10"), "USD", today) == Decimal("1335.00")
    assert rates.on("EUR", today) is None  # no rate on file: no equivalent rather than a guess

    project = Project(project_code="FX-001", name_en="Dollar Khola", name_np="Dollar Khola", province="Bagmati",
                      installed_capacity_mw=5, project_stage="operation", pipeline_status="under_operation")
    db_session.add(project)
    await db_session.flush()
    db_session.add(LoanAccount(project_id=project.id, finacle_account_id="FIN-FX-1", facility_type="term_loan",
                               currency_code="USD", sanctioned_amount=Decimal("1000000"),
                               disbursed_amount=Decimal("800000"), outstanding_principal=Decimal("600000")))
    await db_session.flush()
    loans = (await api.get("/api/v1/loan-accounts", headers=admin, params={"project_id": str(project.id)})).json()["data"]
    assert (loans[0]["currency_code"], Decimal(loans[0]["sanctioned_amount_npr"]), Decimal(loans[0]["fx_rate_to_npr"])) == (
        "USD", Decimal("133500000.00"), Decimal("133.5"))

    report = await api.post("/api/v1/reports/builder/run", headers=admin, json={
        "source": "covenant_summary", "columns": ["project_code", "currency", "sanctioned_amount", "sanctioned_amount_npr"],
        "format": "json"})
    row = next(r for r in report.json()["data"] if r["project_code"] == "FX-001")
    assert (row["currency"], row["sanctioned_amount_npr"]) == ("USD", 133500000.0)

    listed = {c["currency_code"]: c for c in (await api.get("/api/v1/admin/exchange-rates", headers=admin)).json()["data"]}
    assert listed["USD"]["current"]["rate_to_npr"] == "133.500000" and len(listed["USD"]["history"]) == 3


# ---------------------------------------------------------------- consolidated report (F.6)

async def test_the_consolidated_report_agrees_with_the_separate_sources(api, db_session):
    from decimal import Decimal
    from sqlalchemy import func, select
    from backend.app.models.financial import LoanAccount
    from backend.scripts import seed_demo_budgets, seed_realistic_data

    await seed_realistic_data.seed(db_session, today=date(2026, 10, 5))
    await seed_demo_budgets.seed(db_session)
    admin = await login(api, "admin")
    r = await api.post("/api/v1/reports/builder/run", headers=admin, json={"source": "consolidated", "format": "json"})
    assert r.status_code == 200, r.text
    rows = r.json()["data"]
    assert len(rows) == 50  # one per project

    outstanding = (await db_session.execute(select(func.sum(LoanAccount.outstanding_principal)))).scalar()
    assert Decimal(str(sum(row["outstanding_principal_npr"] or 0 for row in rows))).quantize(Decimal("1")) == \
        Decimal(outstanding).quantize(Decimal("1"))

    covenants = {c["project_code"]: c for c in (await api.get("/api/v1/compliance/covenants", headers=admin)).json()["data"]}
    tested = [row for row in rows if row["dscr"] is not None]
    assert tested, "the seed has tested covenants"
    for row in tested:
        assert row["dscr"] == float(covenants[row["project_code"]]["dscr"]["value"])

    capex = (await api.post("/api/v1/reports/builder/run", headers=admin, json={
        "source": "capex_progress", "columns": ["budgeted_amount"], "format": "json"})).json()["data"]
    assert round(sum(row["budgeted_amount"] or 0 for row in rows), 2) == round(sum(row["budgeted_amount"] for row in capex), 2)

    # Filters work as on the other sources
    gandaki = (await api.post("/api/v1/reports/builder/run", headers=admin, json={
        "source": "consolidated", "format": "json", "filters": {"province": "Gandaki"}})).json()["data"]
    assert gandaki and all(row["province"] == "Gandaki" for row in gandaki)


# ---------------------------------------------------------------- database row security (TECH A.6)

async def test_every_table_that_belongs_to_a_project_has_a_row_policy(db_session):
    import backend.app.models  # noqa: F401
    from sqlalchemy import text
    from backend.app.models.base import Base

    with_project = {t.name for t in Base.metadata.tables.values() if "project_id" in t.columns} - {"project_owner"}
    policed = set((await db_session.execute(text(
        "SELECT tablename FROM pg_policies WHERE policyname = 'hpms_project_rows'"))).scalars())
    forced = set((await db_session.execute(text(
        "SELECT relname FROM pg_class WHERE relrowsecurity AND relforcerowsecurity"))).scalars())
    assert with_project | {"projects"} <= policed, f"no row policy: {sorted(with_project - policed)}"
    assert with_project | {"projects"} <= forced


async def test_the_database_itself_limits_a_maker_to_owned_projects(db_session):
    """Below the application: a query that skips every application check still sees only what the policy allows.
    Run as an ordinary role, because PostgreSQL never applies row security to a superuser."""
    import uuid as uuidlib
    from decimal import Decimal
    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError
    from backend.app.models.auth import ProjectOwner, User
    from backend.app.models.project import Project

    maker = User(username=f"rls-maker-{uuidlib.uuid4().hex[:6]}", email=f"{uuidlib.uuid4().hex[:8]}@sbl.local",
                 default_role="maker")
    owned = Project(project_code="RLS-OWN", name_en="Owned Khola", name_np="Owned Khola", province="Koshi",
                    installed_capacity_mw=1, project_stage="operation", pipeline_status="under_operation")
    other = Project(project_code="RLS-OTHER", name_en="Other Khola", name_np="Other Khola", province="Koshi",
                    installed_capacity_mw=1, project_stage="operation", pipeline_status="under_operation")
    db_session.add_all([maker, owned, other])
    await db_session.flush()
    db_session.add(ProjectOwner(user_id=maker.id, project_id=owned.id, ownership_type="direct"))
    await db_session.flush()

    await db_session.execute(text("CREATE ROLE hpms_rls_probe NOLOGIN"))
    await db_session.execute(text("GRANT SELECT, INSERT ON projects, loan_accounts, project_owner TO hpms_rls_probe"))
    await db_session.execute(text("SET LOCAL ROLE hpms_rls_probe"))

    async def visible(rls, roles, user_id=maker.id):
        await db_session.execute(text(
            "SELECT set_config('hpms.rls', :rls, true), set_config('hpms.roles', :roles, true), "
            "set_config('hpms.user_id', :uid, true)"), {"rls": rls, "roles": roles, "uid": str(user_id)})
        return set((await db_session.execute(text(
            "SELECT project_code FROM projects WHERE project_code LIKE 'RLS-%'"))).scalars())

    try:
        assert await visible("on", "maker") == {"RLS-OWN"}
        assert await visible("on", "admin") == {"RLS-OWN", "RLS-OTHER"}
        assert await visible("on", "approver") == {"RLS-OWN", "RLS-OTHER"}
        assert await visible("on", "guest") == set()
        assert await visible("off", "guest") == {"RLS-OWN", "RLS-OTHER"}  # no user described: not restricted

        # Writing a loan onto a project the maker cannot see is refused by the database
        await visible("on", "maker")
        savepoint = await db_session.begin_nested()
        try:
            await db_session.execute(text(
                "INSERT INTO loan_accounts (id, project_id, finacle_account_id, sanctioned_amount, disbursed_amount, "
                "outstanding_principal) VALUES (:id, :pid, 'FIN-RLS', 1, 1, 1)"), {"id": str(uuidlib.uuid4()), "pid": str(other.id)})
            raised = False
        except DBAPIError as error:
            raised = "row-level security" in str(error)
        await savepoint.rollback()
        assert raised, "the policy should refuse a row for a project the maker cannot see"
    finally:
        await db_session.execute(text("RESET ROLE"))


async def test_a_described_user_reaches_every_new_transaction_and_bank_wide_lifts_it(db_session):
    from sqlalchemy import text
    from backend.app.security.db_row_security import INFO_KEY, bank_wide, describe_user

    setting = text("SELECT current_setting('hpms.rls', true), current_setting('hpms.roles', true)")
    describe_user(db_session, "00000000-0000-0000-0000-000000000001", ["maker"])
    await db_session.commit()  # the next statement begins a new transaction
    assert tuple((await db_session.execute(setting)).one()) == ("on", "maker")
    async with bank_wide(db_session):
        assert (await db_session.execute(setting)).one()[0] == "off"
    assert (await db_session.execute(setting)).one()[0] == "on"
    db_session.sync_session.info.pop(INFO_KEY)


async def test_screen_label_translations_are_not_mistaken_for_figures(api):
    guest = await login(api, "guest")
    r = await api.get("/api/v1/i18n/translations", headers=guest)
    assert r.status_code == 200 and "x-fields-withheld" not in r.headers
