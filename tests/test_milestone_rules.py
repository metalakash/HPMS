"""Milestone updates (FUNC C.5): a completed milestone has happened, on a real date (no database)."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException

from backend.app.api.routes_risk import _milestone_rules


def test_completing_needs_the_actual_date_and_sets_full_progress():
    with pytest.raises(HTTPException, match="needs its actual date"):
        _milestone_rules({"status": "completed", "actual_date_ad": None})
    assert _milestone_rules({"status": "completed", "actual_date_ad": date.today()}) == {"percent_complete": Decimal("100")}


def test_the_actual_date_cannot_be_in_the_future():
    with pytest.raises(HTTPException, match="cannot be in the future"):
        _milestone_rules({"status": "in_progress", "actual_date_ad": date.today() + timedelta(days=1)})


def test_other_updates_pass_unchanged():
    assert _milestone_rules({"status": "in_progress", "actual_date_ad": None, "percent_complete": Decimal("40")}) == {}
