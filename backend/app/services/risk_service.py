"""Risk register helpers and automatic risk generation (RFP E.9, E.19, E.20)."""
from datetime import date as _date, datetime
from typing import Optional, Tuple

from sqlalchemy import select

SEVERITY_BANDS = ((20, "critical"), (12, "high"), (6, "medium"), (1, "low"))
SLIP_RISK_DAYS = 30


def compute_severity(likelihood: int, impact: int) -> str:
    """Map a 1-5 likelihood x 1-5 impact score to a severity band."""
    if not (1 <= likelihood <= 5 and 1 <= impact <= 5):
        raise ValueError("likelihood and impact must be between 1 and 5")
    score = likelihood * impact
    for threshold, label in SEVERITY_BANDS:
        if score >= threshold:
            return label
    return "low"


def bs_string(d: Optional[_date]) -> Optional[str]:
    """YYYY-MM-DD Bikram Sambat string for an AD date, or None if unconvertible."""
    if d is None:
        return None
    from backend.app.i18n.calendar import CalendarConverter
    try:
        y, m, day = CalendarConverter.ad_to_bs(datetime(d.year, d.month, d.day))
        return f"{y:04d}-{m:02d}-{day:02d}"
    except Exception:
        return None


def slippage_risk_rating(slip_days: int) -> Tuple[int, int]:
    """(likelihood, impact) for a slipped milestone; longer slips rate higher."""
    if slip_days > 180:
        return 5, 5
    if slip_days > 90:
        return 4, 4
    return 3, 3


async def _upsert_auto_risk(db, project_id, source: str, title: str, description: str,
                            risk_type: str, likelihood: int, impact: int) -> int:
    """Create the automatic risk, or refresh it while still open. Returns 1 if created, else 0."""
    from backend.app.models.risk import RiskRegisterEntry
    existing = (await db.execute(
        select(RiskRegisterEntry).where(
            RiskRegisterEntry.project_id == project_id,
            RiskRegisterEntry.trigger_source == source,
            RiskRegisterEntry.title == title,
            RiskRegisterEntry.mitigation_status.in_(["open", "in_progress"]),
        )
    )).scalar_one_or_none()
    severity = compute_severity(likelihood, impact)
    if existing:
        existing.description, existing.likelihood = description, likelihood
        existing.impact, existing.severity = impact, severity
        return 0
    db.add(RiskRegisterEntry(
        project_id=project_id, title=title, description=description, risk_type=risk_type,
        likelihood=likelihood, impact=impact, severity=severity,
        mitigation_status="open", trigger_source=source, created_by="system",
    ))
    return 1


async def sync_automatic_risks(db, project_id, today: _date) -> int:
    """Raise risks for slipped milestones and breached covenants. Idempotent; returns new count."""
    from backend.app.models.operations import CovenantHistory
    from backend.app.models.risk import Milestone
    from backend.app.services.alert_service import AlertService
    created = 0

    milestones = (await db.execute(
        select(Milestone).where(Milestone.project_id == project_id, Milestone.actual_date_ad.is_(None))
    )).scalars().all()
    for m in milestones:
        slip = AlertService.milestone_slippage_days(m.planned_date_ad, m.forecast_date_ad, None, today)
        if slip > SLIP_RISK_DAYS:
            likelihood, impact = slippage_risk_rating(slip)
            created += await _upsert_auto_risk(
                db, project_id, "milestone_delay", f"Milestone delay: {m.name}",
                f"Milestone '{m.name}' is {slip} days behind plan.", "technical", likelihood, impact)

    latest = (await db.execute(
        select(CovenantHistory).where(CovenantHistory.project_id == project_id)
        .order_by(CovenantHistory.covenant_date_ad.desc().nullslast()).limit(1)
    )).scalar_one_or_none()
    if latest:
        for name, status in (("DSCR", latest.dscr_status), ("LTV", latest.ltv_status), ("ICR", latest.icr_status)):
            if status == "breached":
                created += await _upsert_auto_risk(
                    db, project_id, "compliance_breach", f"Covenant breach: {name}",
                    f"{name} breached in {latest.quarter_ad}.", "financial", 4, 5)
    await db.flush()
    return created
