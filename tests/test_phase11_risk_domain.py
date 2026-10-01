"""Phase 11 risk/milestone/alert logic (no database required)."""
from datetime import date

import pytest
from sqlalchemy.orm import configure_mappers

from backend.app.services.alert_service import AlertService
from backend.app.services.risk_service import compute_severity


def test_mappers_configure_with_new_models():
    import backend.app.models  # noqa: F401
    configure_mappers()


@pytest.mark.parametrize("likelihood,impact,expected", [
    (1, 1, "low"), (2, 3, "medium"), (3, 4, "high"), (4, 5, "critical"), (5, 5, "critical"),
])
def test_compute_severity(likelihood, impact, expected):
    assert compute_severity(likelihood, impact) == expected


@pytest.mark.parametrize("bad", [(0, 3), (3, 6)])
def test_compute_severity_rejects_out_of_range(bad):
    with pytest.raises(ValueError):
        compute_severity(*bad)


def test_milestone_slippage_uses_forecast_then_today():
    planned = date(2026, 1, 1)
    assert AlertService.milestone_slippage_days(planned, date(2026, 1, 11), None, date(2026, 3, 1)) == 10
    assert AlertService.milestone_slippage_days(planned, None, None, date(2026, 1, 21)) == 20
    assert AlertService.milestone_slippage_days(planned, None, None, date(2025, 12, 1)) == 0
    assert AlertService.milestone_slippage_days(planned, None, date(2026, 1, 5), date(2026, 3, 1)) == 4


def test_urgency_bands():
    assert AlertService._get_urgency(-1) == "expired"
    assert AlertService._get_urgency(10) == "critical"
    assert AlertService._get_urgency(60) == "warning"
    assert AlertService._get_urgency(200) == "ok"


def test_risk_routes_registered():
    from backend.app.main import app
    paths = app.openapi()["paths"]
    base = "/api/v1/projects/{project_id}"
    for resource in ("milestones", "risks", "insurance", "permits", "esia-monitoring", "community-engagements"):
        assert {"get", "post"} <= set(paths[f"{base}/{resource}"])
        assert {"patch", "delete"} <= set(paths[f"{base}/{resource}/{{item_id}}"])
    assert "post" in paths[f"{base}/risks/auto-scan"]


def test_risk_endpoints_require_auth():
    from fastapi.testclient import TestClient
    from backend.app.main import app
    client = TestClient(app, base_url="http://localhost")
    assert client.get("/api/v1/projects/00000000-0000-0000-0000-000000000000/milestones").status_code in (401, 403)


def test_create_schemas_validate():
    from pydantic import ValidationError
    from backend.app.schemas.risk import RiskCreate, MilestoneCreate
    with pytest.raises(ValidationError):
        RiskCreate(title="x", risk_type="financial", likelihood=6, impact=1)
    with pytest.raises(ValidationError):
        RiskCreate(title="x", risk_type="weather", likelihood=1, impact=1)
    with pytest.raises(ValidationError):
        MilestoneCreate(name="Civil", planned_date_ad=date(2026, 1, 1), percent_complete=101)


def test_bs_string_pairs_dates():
    from backend.app.services.risk_service import bs_string
    assert bs_string(date(2026, 4, 14)) == "2083-01-01"
    assert bs_string(date(2026, 10, 1)) == "2083-06-15"
    assert bs_string(date(1800, 1, 1)) is None
    assert bs_string(None) is None


def test_slippage_risk_rating_escalates():
    from backend.app.services.risk_service import slippage_risk_rating
    assert slippage_risk_rating(45) == (3, 3)
    assert slippage_risk_rating(120) == (4, 4)
    assert slippage_risk_rating(200) == (5, 5)


def test_daily_scan_schedule_and_digest():
    from datetime import datetime
    from backend.app.services.alert_daemon import format_digest, seconds_until_next_run
    assert seconds_until_next_run(datetime(2026, 1, 1, 1, 0), hour=2) == 3600
    assert seconds_until_next_run(datetime(2026, 1, 1, 3, 0), hour=2) == 23 * 3600
    assert format_digest([]) is None
    text = format_digest([("P1", "Alpha", [{"description": "PPA expiring", "urgency": "critical", "days_remaining": 5}])])
    assert "[P1] Alpha: PPA expiring" in text
