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
