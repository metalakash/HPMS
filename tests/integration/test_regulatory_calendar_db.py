"""Regulatory calendar against a real migrated Postgres (skipped when none is available)."""

import uuid
from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

from backend.app.models.regulatory import FilingCalendarEntry, RegulatoryRequirement
from backend.app.services import regulatory_service as reg


async def _requirement(db, code="NRB-Q", **over):
    r = RegulatoryRequirement(id=uuid.uuid4(), code=code, title="Quarterly return", authority="NRB",
                              frequency="quarterly", lag_days=15, applies_to="portfolio", **over)
    db.add(r)
    await db.flush()
    return r


async def test_generate_is_idempotent_in_the_database(db_session):
    r = await _requirement(db_session)
    assert await reg.generate_filings(db_session, r, date(2025, 7, 1), date(2026, 7, 31)) == 5
    assert await reg.generate_filings(db_session, r, date(2025, 7, 1), date(2026, 7, 31)) == 0


async def test_portfolio_duplicates_are_rejected_by_the_partial_index(db_session):
    r = await _requirement(db_session)
    kw = dict(requirement_id=r.id, project_id=None, period_label="x", period_end_ad=date(2025, 10, 17),
              due_date_ad=date(2025, 11, 1))
    db_session.add(FilingCalendarEntry(**kw))
    await db_session.flush()
    db_session.add(FilingCalendarEntry(**kw))
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_overdue_marking_and_alerts(db_session):
    r = await _requirement(db_session)
    await reg.generate_filings(db_session, r, date(2025, 7, 1), date(2026, 7, 31))
    today = date(2025, 11, 10)  # Q4 FY81/82 (due 31 Jul) and Q1 FY82/83 (due 1 Nov) are past due
    assert await reg.mark_overdue(db_session, today) == 2
    alerts = await reg.open_filing_alerts(db_session, today, portfolio=True)
    assert [a["urgency"] for a in alerts] == ["expired", "expired"]
    assert all(a["days_remaining"] < 0 for a in alerts)
