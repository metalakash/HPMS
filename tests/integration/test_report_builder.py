"""Phase 11.2: report builder, shortfall report, geographic filters (no database required)."""

import uuid
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.dialects import postgresql

from backend.app.database import get_db
from backend.app.main import app
from backend.app.schemas.report_schema import ExportFilter
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.services.report_builder import (
    SOURCES, DefinitionError, run_report, shape_rows, validate_definition,
)
from backend.app.services.report_service import (
    COVENANT_THRESHOLDS, covenant_shortfall_row, geography_conditions,
)

ROWS = [
    {"code": "B", "mw": 10, "province": "Gandaki"},
    {"code": "A", "mw": None, "province": "Bagmati"},
    {"code": "C", "mw": 30, "province": "Gandaki"},
]


# ------------------------------------------------------------------ definition validation

def test_every_source_is_self_consistent():
    for src in SOURCES.values():
        assert len(set(src.columns)) == len(src.columns), src.key
        assert {"province", "district", "local_level"} <= set(src.filters), src.key
        assert {"province", "district", "local_level"} <= set(src.columns), src.key


def test_validate_rejects_unknowns():
    with pytest.raises(DefinitionError, match="Unknown source"):
        validate_definition("payroll", None, None)
    with pytest.raises(DefinitionError, match="Unknown columns"):
        validate_definition("portfolio", ["project_code", "salary"], None)
    with pytest.raises(DefinitionError, match="empty"):
        validate_definition("portfolio", [], None)
    with pytest.raises(DefinitionError, match="repeat"):
        validate_definition("portfolio", ["province", "province"], None)
    with pytest.raises(DefinitionError, match="sort_by"):
        validate_definition("portfolio", None, "salary")
    assert validate_definition("portfolio", ["province"], "capacity_mw").key == "portfolio"


# ------------------------------------------------------------------ shaping

def test_shape_rows_sorts_blanks_last_and_orders_columns():
    out = shape_rows([dict(r) for r in ROWS], ["mw", "code"], "mw", sort_desc=False)
    assert [r["code"] for r in out] == ["B", "C", "A"]
    assert list(out[0]) == ["mw", "code"]
    out = shape_rows([dict(r) for r in ROWS], None, "mw", sort_desc=True)
    assert [r["code"] for r in out] == ["C", "B", "A"]  # None still last when descending


def test_shape_rows_sort_key_need_not_be_selected():
    out = shape_rows([dict(r) for r in ROWS], ["code"], "mw", False)
    assert [r["code"] for r in out] == ["B", "C", "A"] and list(out[0]) == ["code"]


async def test_run_report_applies_filters_and_columns(monkeypatch):
    seen = {}

    async def loader(db, filters, user_id):
        seen["filters"], seen["user"] = filters, user_id
        return [dict(r) for r in ROWS], 3

    monkeypatch.setitem(SOURCES, "portfolio", SOURCES["portfolio"].__class__(
        "portfolio", "x", loader, ("province", "district", "local_level", "code"), ("province",)))
    rows = await run_report(None, "portfolio", ["province"], {"province": "Gandaki", "district": "Kaski"},
                            user_id="u1")
    assert seen["filters"].district == "Kaski" and seen["user"] == "u1"
    assert rows[0] == {"province": "Gandaki"}


# ------------------------------------------------------------------ geography filters

def test_geography_conditions_compile_to_sql():
    conds = geography_conditions(ExportFilter(province="Gandaki", district="Kaski", local_level="Pokhara"))
    sql = " AND ".join(str(c.compile(dialect=postgresql.dialect())) for c in conds)
    assert "projects.province" in sql and "projects.district" in sql and "projects.local_level" in sql
    assert geography_conditions(None) == [] and geography_conditions(ExportFilter()) == []


# ------------------------------------------------------------------ shortfall report

def _loan(dscr=None, ltv=None, icr=None):
    return SimpleNamespace(
        finacle_account_id="ACC1", facility_type="Term Loan", sanctioned_amount=Decimal("100"),
        outstanding_principal=Decimal("80"), dscr=dscr, ltv=ltv, icr=icr, metric_as_of_date=date(2026, 4, 14))


PROJECT = SimpleNamespace(project_code="P1", name_en="Alpha", province="Gandaki", district="Kaski",
                          local_level="Pokhara")


def test_shortfall_row_flags_each_breach_with_gap():
    row = covenant_shortfall_row(_loan(Decimal("1.10"), Decimal("75"), Decimal("1.5")), PROJECT)
    assert row["breached_covenants"] == "DSCR, LTV, ICR" and row["shortfall_count"] == 3
    assert row["dscr_shortfall"] == pytest.approx(0.15)
    assert row["ltv_excess"] == pytest.approx(5.0)
    assert row["icr_shortfall"] == pytest.approx(0.5)
    assert row["local_level"] == "Pokhara"


def test_shortfall_row_compliant_loan_has_no_breach():
    t = COVENANT_THRESHOLDS
    row = covenant_shortfall_row(_loan(t["dscr_min"], t["ltv_max"], t["icr_min"]), PROJECT)  # exactly on threshold
    assert row["shortfall_count"] == 0 and row["breached_covenants"] == ""
    assert row["dscr_shortfall"] is None and row["ltv_excess"] is None


def test_shortfall_row_missing_metric_is_not_a_breach():
    row = covenant_shortfall_row(_loan(dscr=Decimal("1.0")), PROJECT)
    assert row["breached_covenants"] == "DSCR" and row["ltv"] is None and row["ltv_excess"] is None


def test_shortfall_row_keys_match_declared_columns():
    row = covenant_shortfall_row(_loan(Decimal("1")), PROJECT)
    assert set(row) == set(SOURCES["covenant_shortfall"].columns)


# ------------------------------------------------------------------ routes

@pytest.fixture
async def api(monkeypatch):
    async def fake_db():
        yield SimpleNamespace()

    async def fake_run(db, source, columns, filters, sort_by, sort_desc, user_id):
        return shape_rows([dict(r) for r in ROWS], columns, sort_by, sort_desc)

    monkeypatch.setattr("backend.app.api.routes_report_builder.run_report", fake_run)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: CurrentUser({
        "sub": str(uuid.uuid4()), "username": "tester", "roles": ["admin"], "is_authenticated": True})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client:
        yield client
    app.dependency_overrides.clear()


async def test_sources_endpoint_lists_columns_and_filters(api):
    body = (await api.get("/api/v1/reports/sources")).json()
    shortfall = next(s for s in body["sources"] if s["key"] == "covenant_shortfall")
    assert "dscr_shortfall" in shortfall["columns"] and "local_level" in shortfall["filters"]


async def test_adhoc_run_json(api):
    r = await api.post("/api/v1/reports/builder/run", json={
        "source": "portfolio", "columns": ["province", "capacity_mw"], "filters": {"province": "Gandaki"}})
    assert r.status_code == 200
    assert r.json()["record_count"] == 3


@pytest.mark.parametrize("fmt,marker", [("word", "wordprocessingml"), ("excel", "spreadsheetml"), ("csv", "text/csv")])
async def test_adhoc_run_file_formats(api, fmt, marker):
    r = await api.post("/api/v1/reports/builder/run", json={"source": "portfolio", "format": fmt})
    assert r.status_code == 200 and marker in r.headers["content-type"]


async def test_adhoc_rejects_bad_definition(api, monkeypatch):
    async def boom(*a, **k):
        raise DefinitionError("Unknown columns for portfolio: salary")

    monkeypatch.setattr("backend.app.api.routes_report_builder.run_report", boom)
    r = await api.post("/api/v1/reports/builder/run", json={"source": "portfolio", "columns": ["salary"]})
    assert r.status_code == 422 and "salary" in r.json()["detail"]


async def test_create_definition_validates_before_touching_db(api):
    r = await api.post("/api/v1/reports/definitions", json={
        "name": "Bad", "source": "portfolio", "columns": ["salary"]})
    assert r.status_code == 422
    r = await api.post("/api/v1/reports/definitions", json={"name": "", "source": "portfolio"})
    assert r.status_code == 422


async def test_builder_requires_portfolio_role(api):
    app.dependency_overrides[get_current_user] = lambda: CurrentUser({
        "sub": str(uuid.uuid4()), "username": "g", "roles": ["maker"], "is_authenticated": True})
    assert (await api.get("/api/v1/reports/sources")).status_code == 403
    assert (await api.post("/api/v1/reports/builder/run", json={"source": "portfolio"})).status_code == 403
