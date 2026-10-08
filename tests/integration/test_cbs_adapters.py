"""Core banking adapters configured by a mapping file: file extract and HTTP inquiry.

The layouts below are invented for the tests. No bank's real format is assumed anywhere; the
point is that a different layout needs a different mapping and no code.

The database tests need the migrated test database from conftest (skipped without one).
"""

import json
import os
import uuid
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from backend.app.database import get_db
from backend.app.integration import finacle_adapter
from backend.app.integration.cbs_adapters import CBSMapping, CBSMappingError, FileExtractAdapter, HttpAdapter
from backend.app.integration.finacle_adapter import MockFinacleAdapter, StubFinacleAdapter, build_adapter
from backend.app.integration.finacle_schema import FinacleSyncRequest, FinacleSyncType
from backend.app.main import app
from backend.app.models.audit import AuditLog
from backend.app.models.financial import LoanAccount, LoanAccountRateHistory
from backend.app.models.operations import FinancialPeriod
from backend.app.models.project import Project
from backend.app.services.covenant_engine import Quarter

# A pipe-delimited extract: day-first dates, lakh-style separators, debit balances negative
EXTRACT_MAPPING = {
    "name": "test bank nightly extract",
    "fields": {
        "finacle_account_id": "ACCT_NO", "account_status": "STATUS", "sanctioned_amount": "LIMIT_AMT",
        "disbursed_amount": "DISB_AMT", "outstanding_principal": "BAL_AMT", "overdue_principal": "OD_PRIN",
        "interest_rate_pct": "INT_RATE", "rate_reset_date": "RATE_DT",
    },
    "date_format": "%d-%m-%Y",
    "negate": ["outstanding_principal"],
    "defaults": {"currency_code": "NPR"},
    "status_values": {"A": "ACTIVE", "C": "CLOSED"},
    "file": {"pattern": "loans_*.txt", "delimiter": "|"},
}
HEADER = "ACCT_NO|STATUS|LIMIT_AMT|DISB_AMT|BAL_AMT|OD_PRIN|INT_RATE|RATE_DT"
ROW = "LN-0001|A|10,00,00,000.00|8,00,00,000.00|-7,50,00,000.00|0|9.25|16-07-2026"


def mapping(**overrides) -> CBSMapping:
    return CBSMapping.from_dict({**EXTRACT_MAPPING, **overrides})


def request(*account_ids) -> FinacleSyncRequest:
    return FinacleSyncRequest(sync_type=FinacleSyncType.EOD_BATCH, request_id="t-1",
                              account_ids=list(account_ids) or None)


def write_extract(directory, name: str, *rows: str, mtime: float | None = None):
    path = directory / name
    path.write_text("\n".join([HEADER, *rows]) + "\n", encoding="utf-8")
    if mtime is not None:
        os.utime(path, (mtime, mtime))
    return path


# ------------------------------------------------------------------ mapping

def test_a_record_is_converted_by_the_mapping():
    values = dict(zip(HEADER.split("|"), ROW.split("|")))
    record = mapping().record(values.get)

    assert record.finacle_account_id == "LN-0001" and record.account_status == "ACTIVE"
    assert record.sanctioned_amount == Decimal("100000000.00")
    assert record.outstanding_principal == Decimal("75000000.00")  # reported as a negative debit balance
    assert record.overdue_principal == Decimal("0") and record.interest_rate_pct == Decimal("9.25")
    assert record.rate_reset_date == date(2026, 7, 16) and record.currency_code == "NPR"
    # Not in this bank's extract: left empty so nothing local is overwritten
    assert record.maturity_date is None and record.outstanding_interest is None


@pytest.mark.parametrize("change,problem", [
    ({"BAL_AMT": "seven"}, "outstanding_principal: 'seven' is not a number"),
    ({"BAL_AMT": "NaN"}, "is not a number"),
    ({"BAL_AMT": "7,50,00,000.00"}, "add it to 'negate'"),  # positive here means the sign convention is wrong
    ({"BAL_AMT": ""}, "record has no outstanding_principal"),
    ({"ACCT_NO": "  "}, "record has no finacle_account_id"),
    ({"RATE_DT": "2026-07-16"}, "rate_reset_date: '2026-07-16' does not match %d-%m-%Y"),
])
def test_values_that_do_not_fit_the_mapping_are_refused_with_the_reason(change, problem):
    values = {**dict(zip(HEADER.split("|"), ROW.split("|"))), **change}
    with pytest.raises(CBSMappingError, match=problem.replace("(", r"\(")):
        mapping().record(values.get)


@pytest.mark.parametrize("bad,problem", [
    ({"fields": {}}, "non-empty 'fields'"),
    ({"fields": {"finacle_account_id": "A"}}, "must say where to find: outstanding_principal"),
    ({"fields": {**EXTRACT_MAPPING["fields"], "balance": "X"}}, "fields HPMS does not have: balance"),
    ({"negate": ["account_status"]}, "only amounts can be negated"),
])
def test_a_bad_mapping_is_rejected_when_loaded(bad, problem):
    with pytest.raises(CBSMappingError, match=problem):
        mapping(**bad)


def test_mapping_file_problems_are_reported_without_a_traceback(tmp_path):
    with pytest.raises(CBSMappingError, match="cannot read mapping file"):
        CBSMapping.load(str(tmp_path / "missing.json"))
    broken = tmp_path / "broken.json"
    broken.write_text("{not json", encoding="utf-8")
    with pytest.raises(CBSMappingError, match="not valid JSON"):
        CBSMapping.load(str(broken))
    good = tmp_path / "good.json"
    good.write_text(json.dumps(EXTRACT_MAPPING), encoding="utf-8")
    assert CBSMapping.load(str(good)).name == "test bank nightly extract"


# ------------------------------------------------------------------ file extract

async def test_the_newest_extract_is_read_and_bad_rows_are_reported(tmp_path):
    write_extract(tmp_path, "loans_20261004.txt", ROW.replace("-7,50,00,000.00", "-9,99,99,999.00"), mtime=1_000_000)
    write_extract(tmp_path, "loans_20261005.txt", ROW, "LN-0002|C|5|5|oops|0|9|16-07-2026",
                  ROW.replace("9.25", "9.99"), "LN-0003|A|100|80|-60|0|10.5|", mtime=2_000_000)
    (tmp_path / "notes.csv").write_text("ignore me", encoding="utf-8")
    adapter = FileExtractAdapter(mapping(), str(tmp_path))

    response = await adapter.sync_accounts(request())
    assert response.is_success and response.response_message == "Read loans_20261005.txt"
    assert [(r.finacle_account_id, r.outstanding_principal) for r in response.account_records] == [
        ("LN-0001", Decimal("75000000.00")), ("LN-0003", Decimal("60"))]
    assert response.account_records[1].rate_reset_date is None
    assert (response.records_processed, response.records_failed) == (2, 2)
    assert adapter.row_errors == ["line 3: outstanding_principal: 'oops' is not a number",
                                  "line 4: account appears more than once; first occurrence kept"]

    only = await adapter.sync_accounts(request("LN-0003", "LN-9999"))
    assert [r.finacle_account_id for r in only.account_records] == ["LN-0003"]
    assert adapter.describe()["latest_file"] == "loans_20261005.txt"


async def test_extract_problems_fail_loudly(tmp_path):
    adapter = FileExtractAdapter(mapping(), str(tmp_path), max_age_hours=24)
    with pytest.raises(FileNotFoundError, match="No extract matching loans_"):
        await adapter.sync_accounts(request())
    assert "No extract" in adapter.describe()["problem"]

    write_extract(tmp_path, "loans_old.txt", ROW, mtime=1_000_000)
    with pytest.raises(TimeoutError, match="hours old"):
        await adapter.sync_accounts(request())

    (tmp_path / "loans_wrong.txt").write_text("ACCOUNT;BALANCE\nLN-1;5\n", encoding="utf-8")
    with pytest.raises(CBSMappingError, match="has no column ACCT_NO, BAL_AMT; found: ACCOUNT;BALANCE"):
        await FileExtractAdapter(mapping(), str(tmp_path)).sync_accounts(request())

    with pytest.raises(FileNotFoundError, match="does not exist"):
        await FileExtractAdapter(mapping(), str(tmp_path / "nowhere")).sync_accounts(request())


# ------------------------------------------------------------------ HTTP inquiry

JSON_MAPPING = {
    "name": "test bank REST gateway",
    "fields": {"finacle_account_id": "accountNo", "outstanding_principal": "balances.principal",
               "interest_rate_pct": "pricing.0.rate", "maturity_date": "maturity"},
    "http": {"path": "/loans/{account_id}", "record_path": "data"},
}
XML_MAPPING = {
    "name": "test bank XML inquiry",
    "fields": {"finacle_account_id": "AcctId", "outstanding_principal": "Bal/Principal", "maturity_date": "MatDt"},
    "date_format": "%Y%m%d",
    "http": {"path": "/inquiry", "format": "xml", "record_path": "Body/LoanInqRs",
             "headers": {"Content-Type": "application/xml"},
             "body_template": "<Req><Id>{request_id}</Id><Acct>{account_id}</Acct></Req>"},
}


def http_adapter(spec: dict, handler, **options) -> HttpAdapter:
    return HttpAdapter(CBSMapping.from_dict(spec), "https://cbs.test/api", transport=httpx.MockTransport(handler),
                       **options)


async def test_json_inquiry_reads_fields_by_path_and_sends_the_credential():
    seen = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append((req.method, str(req.url), req.headers.get("X-API-Key")))
        return httpx.Response(200, json={"data": {
            "accountNo": "LN/0001", "balances": {"principal": "75000000.00"}, "pricing": [{"rate": 9.25}],
            "maturity": "2036-06-01"}})

    adapter = http_adapter(JSON_MAPPING, handler, auth_header="X-API-Key", auth_value="s3cret")
    response = await adapter.sync_accounts(request("LN/0001"))

    record = response.account_records[0]
    assert (record.outstanding_principal, record.interest_rate_pct) == (Decimal("75000000.00"), Decimal("9.25"))
    assert record.maturity_date == date(2036, 6, 1)
    assert seen == [("GET", "https://cbs.test/api/loans/LN%2F0001", "s3cret")]  # the id cannot alter the path
    assert "s3cret" not in json.dumps(adapter.describe())


async def test_xml_inquiry_ignores_namespaces_and_escapes_the_request():
    bodies = []

    def handler(req: httpx.Request) -> httpx.Response:
        bodies.append(req.content.decode())
        return httpx.Response(200, content=(
            '<s:Envelope xmlns:s="urn:soap" xmlns:b="urn:bank"><s:Body><b:LoanInqRs>'
            '<b:AcctId>LN-0001</b:AcctId><b:Bal><b:Principal>75000000.00</b:Principal></b:Bal>'
            '<b:MatDt>20360601</b:MatDt></b:LoanInqRs></s:Body></s:Envelope>').encode())

    response = await http_adapter(XML_MAPPING, handler).sync_accounts(request("LN<&>1"))
    record = response.account_records[0]
    assert record.outstanding_principal == Decimal("75000000.00") and record.maturity_date == date(2036, 6, 1)
    assert "<Acct>LN&lt;&amp;&gt;1</Acct>" in bodies[0] and "<Id>t-1</Id>" in bodies[0]


async def test_one_unusable_answer_is_counted_but_an_outage_is_raised():
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/missing"):
            return httpx.Response(404)
        if req.url.path.endswith("/garbled"):
            return httpx.Response(200, content=b"<html>login page</html>")
        if req.url.path.endswith("/down"):
            return httpx.Response(503)
        return httpx.Response(200, json={"data": {"accountNo": "ok", "balances": {"principal": 1}}})

    adapter = http_adapter(JSON_MAPPING, handler)
    response = await adapter.sync_accounts(request("missing", "ok", "garbled"))
    assert [r.finacle_account_id for r in response.account_records] == ["ok"]
    assert response.records_failed == 2

    alone = await adapter.sync_accounts(request("missing"))
    assert alone.account_records == [] and "not found in CBS" in alone.response_message

    with pytest.raises(ConnectionError, match="HTTP 503"):
        await adapter.sync_with_circuit_breaker(request("down"))
    assert adapter.circuit_breaker.failure_count == 1

    def refuse(req):
        raise httpx.ConnectError("no route")
    with pytest.raises(ConnectionError, match="CBS unreachable"):
        await http_adapter(JSON_MAPPING, refuse).sync_accounts(request("x"))
    with pytest.raises(ValueError, match="needs account ids"):
        await adapter.sync_accounts(request())


def test_http_adapter_refuses_plain_http_and_incomplete_mappings():
    with pytest.raises(CBSMappingError, match="must be https"):
        HttpAdapter(CBSMapping.from_dict(JSON_MAPPING), "http://cbs.test")
    with pytest.raises(CBSMappingError, match="needs http.path"):
        HttpAdapter(mapping(), "https://cbs.test")


# ------------------------------------------------------------------ configuration

def settings(**overrides) -> SimpleNamespace:
    base = dict(CBS_ADAPTER="mock", CBS_MAPPING_FILE="", CBS_EXTRACT_DIR="", CBS_EXTRACT_MAX_AGE_HOURS=0,
                CBS_HTTP_BASE_URL="", CBS_HTTP_AUTH_HEADER="", CBS_HTTP_AUTH_VALUE="", CBS_HTTP_TIMEOUT_SECONDS=15,
                CBS_HTTP_VERIFY_TLS=True, CBS_HTTP_CLIENT_CERT="", CBS_HTTP_CLIENT_KEY="", CBS_MAX_CALLS_PER_DAY=50)
    return SimpleNamespace(**{**base, **overrides})


def test_the_environment_chooses_the_adapter(tmp_path):
    assert isinstance(build_adapter(settings()), MockFinacleAdapter)
    assert isinstance(build_adapter(settings(CBS_ADAPTER="stub")), StubFinacleAdapter)

    extract = build_adapter(settings(CBS_ADAPTER="file", CBS_EXTRACT_DIR=str(tmp_path)))
    assert isinstance(extract, FileExtractAdapter) and "placeholder" in extract.mapping.name
    assert extract.rate_limiter.max_calls == 50

    spec = tmp_path / "bank.json"
    spec.write_text(json.dumps(JSON_MAPPING), encoding="utf-8")
    inquiry = build_adapter(settings(CBS_ADAPTER="http", CBS_MAPPING_FILE=str(spec),
                                     CBS_HTTP_BASE_URL="https://cbs.test"))
    assert isinstance(inquiry, HttpAdapter) and inquiry.requires_account_ids

    for incomplete, problem in ((settings(CBS_ADAPTER="file"), "needs CBS_EXTRACT_DIR"),
                                (settings(CBS_ADAPTER="http"), "needs CBS_MAPPING_FILE"),
                                (settings(CBS_ADAPTER="oracle"), "Unknown adapter type")):
        with pytest.raises(ValueError, match=problem):
            build_adapter(incomplete)


# ------------------------------------------------------------------ through the database and API

@pytest.fixture
async def api(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client:
        login = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
        client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
        yield client
    app.dependency_overrides.pop(get_db, None)
    finacle_adapter.reset_adapter()


@pytest.fixture
async def loan(db_session):
    project = Project(project_code="CBS-001", name_en="CBS Khola", name_np="CBS Khola", province="Koshi",
                      installed_capacity_mw=8, project_stage="operation", pipeline_status="under_operation")
    db_session.add(project)
    await db_session.flush()
    account = LoanAccount(
        project_id=project.id, finacle_account_id="LN-0001", facility_type="term_loan",
        sanctioned_amount=Decimal("100000000"), disbursed_amount=Decimal("80000000"),
        outstanding_principal=Decimal("78000000"), outstanding_interest=Decimal("1234"),
        interest_rate_pct=Decimal("10.00"), maturity_ad=date(2036, 6, 1))
    db_session.add(account)
    await db_session.flush()
    db_session.add(LoanAccountRateHistory(loan_account_id=account.id, interest_rate_pct=Decimal("10.00"),
                                          valid_from_ad=date(2024, 1, 15), is_current="Y"))
    # A valuation for the last completed quarter, so the sync has a covenant to move
    latest = Quarter.of(date.today()).shift(-1)
    db_session.add(FinancialPeriod(project_id=project.id, quarter_ad=latest.label, period_end_ad=latest.end,
                                   security_value_npr=Decimal("150000000")))
    await db_session.flush()
    return account


def use_extract(tmp_path, *rows) -> FileExtractAdapter:
    write_extract(tmp_path, "loans_today.txt", *rows)
    adapter = FileExtractAdapter(mapping(), str(tmp_path))
    finacle_adapter._configured = adapter
    return adapter


async def audit_rows(db_session, loan_id) -> list:
    return (await db_session.execute(
        select(AuditLog).where(AuditLog.entity_type == "LOAN", AuditLog.entity_id == str(loan_id))
        .order_by(AuditLog.id))).scalars().all()


async def test_a_sync_writes_only_what_the_bank_supplied_and_leaves_a_trail(api, db_session, loan, tmp_path):
    use_extract(tmp_path, ROW)
    url = f"/api/v1/cbs/sync/{loan.project_id}"

    preview = (await api.post(url, json={"loan_id": str(loan.id), "dry_run": True})).json()["data"]
    assert (preview["status"], preview["applied"], preview["dry_run"], preview["adapter"]) == (
        "success", False, True, "file")
    by_field = {d["field"]: d for d in preview["diff_log"]}
    assert by_field["outstanding_principal"] == {
        "field": "outstanding_principal", "previous_value": 78000000.0, "new_value": 75000000.0, "status": "changed"}
    assert by_field["disbursed_amount"]["status"] == "same"
    assert by_field["maturity_date"]["status"] == by_field["outstanding_interest"]["status"] == "not_provided"
    await db_session.refresh(loan)
    assert loan.outstanding_principal == Decimal("78000000") and await audit_rows(db_session, loan.id) == []

    done = (await api.post(url, json={"loan_id": str(loan.id)})).json()["data"]
    assert (done["applied"], done["simulated"], done["changes_count"]) == (True, False, 2)
    await db_session.refresh(loan)
    assert (loan.outstanding_principal, loan.interest_rate_pct) == (Decimal("75000000.00"), Decimal("9.25"))
    assert loan.overdue_principal == Decimal("0")
    # The extract has no maturity date or accrued interest: the local values stand
    assert (loan.maturity_ad, loan.outstanding_interest) == (date(2036, 6, 1), Decimal("1234"))
    assert (loan.data_provenance, loan.source_reference, loan.sync_status) == ("CBS_SYNCED", "CBS:file", "success")

    rates = (await db_session.execute(
        select(LoanAccountRateHistory).where(LoanAccountRateHistory.loan_account_id == loan.id)
        .order_by(LoanAccountRateHistory.valid_from_ad))).scalars().all()
    assert [(r.interest_rate_pct, r.is_current, r.valid_to_ad) for r in rates] == [
        (Decimal("10.0000"), "N", date(2026, 7, 16)), (Decimal("9.2500"), "Y", None)]
    assert rates[1].valid_from_ad == date(2026, 7, 16) and rates[1].valid_from_bs

    trail = await audit_rows(db_session, loan.id)
    assert [(a.action_performed, a.user_id) for a in trail] == [("cbs_sync", "admin")]
    assert "78000000" in str(trail[0].pre_state) and "75000000" in str(trail[0].post_state)
    assert "maturity" not in str(trail[0].post_state)

    # The new balance flows into the covenant test: 75,000,000 / 150,000,000
    assert loan.ltv == Decimal("50.0000")

    again = (await api.post(url, json={"loan_id": str(loan.id)})).json()["data"]
    assert (again["applied"], again["changes_count"]) == (False, 0)
    assert len(await audit_rows(db_session, loan.id)) == 1


async def test_an_account_missing_from_the_extract_changes_nothing(api, db_session, loan, tmp_path):
    use_extract(tmp_path, ROW.replace("LN-0001", "LN-7777"))
    data = (await api.post(f"/api/v1/cbs/sync/{loan.project_id}", json={"loan_id": str(loan.id)})).json()["data"]
    assert (data["status"], data["error"]) == ("no_data", "The account is not in the CBS data")
    await db_session.refresh(loan)
    assert loan.outstanding_principal == Decimal("78000000")

    status = (await api.get("/api/v1/cbs/status")).json()["data"]
    assert (status["adapter"], status["latest_file"]) == ("file", "loans_today.txt")
    assert status["mapping"] == "test bank nightly extract" and status["circuit_breaker"]["state"] == "CLOSED"


async def test_nightly_batch_updates_held_accounts_and_reports_the_rest(api, db_session, loan, tmp_path):
    use_extract(tmp_path, ROW, "LN-5000|A|100|80|-60|0|10.5|01-01-2026", "LN-5001|A|100|80|bad|0|10.5|01-01-2026")

    r = await api.post("/api/v1/loan-accounts/sync", params={"sync_type": "eod_batch"})
    assert r.status_code == 202, r.text
    data = r.json()["data"]
    assert (data["accounts_synced"], data["rate_changes"], data["status"]) == (1, 1, "ok")
    assert data["errors"] == ["line 4: outstanding_principal: 'bad' is not a number"]
    assert "1 not held in HPMS" in data["message"]

    await db_session.refresh(loan)
    assert loan.outstanding_principal == Decimal("75000000.00") and loan.ltv == Decimal("50.0000")
    assert (await db_session.execute(select(func.count()).select_from(LoanAccount))).scalar() >= 1
    assert not (await db_session.execute(
        select(LoanAccount).where(LoanAccount.finacle_account_id == "LN-5000"))).scalar_one_or_none()
    assert len(await audit_rows(db_session, loan.id)) == 1


async def test_the_default_adapter_is_still_the_mock_and_never_writes(api, db_session, loan):
    finacle_adapter.reset_adapter()
    data = (await api.post(f"/api/v1/cbs/sync/{loan.project_id}", json={"loan_id": str(loan.id)})).json()["data"]
    assert (data["simulated"], data["applied"], data["adapter"]) == (True, False, "mock")
    await db_session.refresh(loan)
    assert loan.outstanding_principal == Decimal("78000000") and await audit_rows(db_session, loan.id) == []


# ------------------------------------------------------------------ onboarding: checking a bank's extract

def test_the_extract_checker_reports_what_a_file_holds_without_touching_anything(tmp_path, capsys):
    from backend.scripts import check_cbs_extract as checker
    spec = tmp_path / "bank.json"
    spec.write_text(json.dumps(EXTRACT_MAPPING), encoding="utf-8")
    extract = write_extract(tmp_path, "loans_sample.txt", ROW, "LN-0002|A|5|5|oops|0|9|16-07-2026")

    summary = checker.inspect(extract, CBSMapping.load(str(spec)))
    assert len(summary["records"]) == 1 and summary["row_errors"] == [
        "line 3: outstanding_principal: 'oops' is not a number"]
    assert summary["supplied"]["outstanding_principal"] == 1 and "maturity_date" not in summary["supplied"]
    # What a sync would leave alone because this bank's extract does not carry it
    assert summary["synced_but_missing"] == ["maturity_date", "outstanding_interest", "overdue_interest"]

    assert checker.main([str(extract), "--mapping", str(spec)]) == 0
    out = capsys.readouterr().out
    assert "Rows read     : 1" in out and "Rows rejected : 1" in out and "Result: usable" in out
    assert "LN-0001" not in out  # account numbers are not echoed

    wrong = tmp_path / "other.txt"
    wrong.write_text("ACCOUNT;BALANCE\nLN-1;5\n", encoding="utf-8")
    assert checker.main([str(wrong), "--mapping", str(spec)]) == 1
    assert "has no column ACCT_NO" in capsys.readouterr().out
    assert checker.main([str(tmp_path / "missing.txt"), "--mapping", str(spec)]) == 1
    assert checker.main([str(extract), "--mapping", str(tmp_path / "nope.json")]) == 1


async def test_the_extract_checker_lines_accounts_up_with_held_loans(db_session, loan, tmp_path):
    from backend.scripts import check_cbs_extract as checker
    extract = write_extract(tmp_path, "loans_sample.txt", ROW, "LN-5000|A|100|80|-60|0|10.5|01-01-2026")
    summary = checker.inspect(extract, mapping())

    result = await checker.compare(summary["records"], db_session)
    held = (await db_session.execute(select(func.count()).select_from(LoanAccount))).scalar()
    assert (result["held"], result["matched"], result["would_change"]) == (held, 1, 1)
    assert result["in_extract_not_held"] == 1 and "LN-0001" not in result["held_not_in_extract"]

    text = "\n".join(checker.report(extract, mapping(), summary, result))
    assert "a sync would change : 1" in text and "(ignored by a sync)" in text
    await db_session.refresh(loan)
    assert loan.outstanding_principal == Decimal("78000000")  # nothing was written


# ------------------------------------------------------------------ the nightly schedule

async def test_a_core_banking_schedule_refreshes_held_loans_from_the_adapter(api, db_session, loan, tmp_path):
    from backend.app.models.financial import LoanExposureSyncHistory, LoanExposureSyncSchedule
    from backend.app.services.background_sync_executor import BackgroundSyncExecutor

    schedule = LoanExposureSyncSchedule(name="Nightly CBS", frequency="daily", scheduled_time_utc="18:30",
                                        sync_source="FINACLE_CBS", is_active="Y")
    db_session.add(schedule)
    await db_session.flush()
    executor = BackgroundSyncExecutor(None)

    # With no real source connected the run is refused and says why
    finacle_adapter.reset_adapter()
    assert await executor.run_schedule(db_session, schedule) == "failed"
    await db_session.refresh(loan)
    assert loan.outstanding_principal == Decimal("78000000")

    use_extract(tmp_path, ROW, "LN-5000|A|100|80|-60|0|10.5|01-01-2026", "LN-5001|A|100|80|bad|0|10.5|01-01-2026")
    assert await executor.run_schedule(db_session, schedule) == "partial_success"
    await db_session.refresh(loan)
    assert loan.outstanding_principal == Decimal("75000000.00")
    assert [(a.action_performed, a.user_id) for a in await audit_rows(db_session, loan.id)] == [
        ("cbs_sync", "scheduler")]

    history = (await db_session.execute(
        select(LoanExposureSyncHistory).where(LoanExposureSyncHistory.schedule_id == schedule.id)
        .order_by(LoanExposureSyncHistory.created_at, LoanExposureSyncHistory.started_at))).scalars().all()
    by_status = {h.status: h for h in history}
    assert set(by_status) == {"failed", "partial_success"}
    assert "No core banking source is connected (CBS_ADAPTER=mock)" in by_status["failed"].error_message
    done = by_status["partial_success"]
    assert (done.updated_count, done.created_count, done.skipped_count) == (1, 0, 2)
    assert "line 4" in done.error_message


async def test_ready_reports_the_schema_revision(api):
    body = (await api.get("/ready")).json()
    assert body["status"] == "ready"
    assert body["schema_revision"] == body["expected_revision"] and body["expected_revision"].startswith("0")
