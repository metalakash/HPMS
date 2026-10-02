"""Filing calendar generation, overdue tracking, reminders and stakeholder alert routing (RFP E.7, E.15, E.22, E.23)."""
import logging
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.project import Project
from backend.app.models.regulatory import (
    FilingCalendarEntry, RegulatoryRequirement, StakeholderContact, UserReminder,
)
from backend.app.services.filing_calendar import period_ends
from backend.app.services.report_dates import bs_string

logger = logging.getLogger(__name__)

FILING_WARNING_DAYS = 30
URGENCY_RANK = {"ok": 0, "warning": 1, "critical": 2, "expired": 3}


def due_date(period_end: date, lag_days: int) -> date:
    return period_end + timedelta(days=lag_days)


async def generate_filings(
    db: AsyncSession,
    requirement: RegulatoryRequirement,
    start: date,
    end: date,
    project_ids: Optional[Sequence[Any]] = None,
    created_by: Optional[str] = None,
) -> int:
    """Create the missing calendar rows for periods ending in [start, end]. Idempotent; returns rows created.

    Portfolio requirements get one row per period; project requirements one per project
    (``project_ids`` if given, otherwise every project).
    """
    periods = period_ends(requirement.frequency, start, end)
    if not periods:
        return 0

    if requirement.applies_to == "project":
        if project_ids is None:
            project_ids = (await db.execute(select(Project.id))).scalars().all()
        targets: List[Optional[Any]] = list(project_ids)
    else:
        targets = [None]

    existing = {
        (row.project_id, row.period_end_ad)
        for row in (await db.execute(
            select(FilingCalendarEntry.project_id, FilingCalendarEntry.period_end_ad)
            .where(FilingCalendarEntry.requirement_id == requirement.id)
            .where(FilingCalendarEntry.period_end_ad.in_([p.end_ad for p in periods]))
        )).all()
    }

    created = 0
    for project_id in targets:
        for p in periods:
            if (project_id, p.end_ad) in existing:
                continue
            due = due_date(p.end_ad, requirement.lag_days)
            db.add(FilingCalendarEntry(
                requirement_id=requirement.id, project_id=project_id, period_label=p.label,
                period_end_ad=p.end_ad, period_end_bs=p.end_bs, due_date_ad=due, due_date_bs=bs_string(due),
                status="pending", created_by=created_by, updated_by=created_by))
            created += 1
    await db.flush()
    return created


async def mark_overdue(db: AsyncSession, today: date) -> int:
    """Flip pending filings whose due date has passed to 'overdue'."""
    result = await db.execute(
        update(FilingCalendarEntry)
        .where(FilingCalendarEntry.status == "pending", FilingCalendarEntry.due_date_ad < today)
        .values(status="overdue"))
    return result.rowcount or 0


def filing_urgency(days_remaining: int) -> str:
    if days_remaining < 0:
        return "expired"
    if days_remaining <= 7:
        return "critical"
    if days_remaining <= FILING_WARNING_DAYS:
        return "warning"
    return "ok"


def filing_alert(entry: FilingCalendarEntry, requirement: RegulatoryRequirement, today: date) -> Dict[str, Any]:
    days = (entry.due_date_ad - today).days
    verb = "overdue" if days < 0 else "due"
    return {
        "alert_id": f"FILING:{entry.id}",
        "entity_type": "FILING",
        "entity_id": str(entry.id),
        "description": f"{requirement.authority} {requirement.title} ({entry.period_label}) {verb}",
        "expiry_date": entry.due_date_ad.isoformat(),
        "days_remaining": days,
        "urgency": filing_urgency(days),
        "authority": requirement.authority,
        "action_available": [{"type": "FILE", "label": "Mark as filed"}],
    }


async def open_filing_alerts(db: AsyncSession, today: date, project_id: Optional[Any] = None,
                             portfolio: bool = False) -> List[Dict[str, Any]]:
    """Alerts for unfiled filings that are overdue or due within the warning window.

    ``project_id`` selects that project's filings; ``portfolio=True`` selects portfolio-level ones.
    """
    query = (
        select(FilingCalendarEntry, RegulatoryRequirement)
        .join(RegulatoryRequirement, RegulatoryRequirement.id == FilingCalendarEntry.requirement_id)
        .where(FilingCalendarEntry.status.in_(("pending", "overdue")))
        .where(FilingCalendarEntry.due_date_ad <= today + timedelta(days=FILING_WARNING_DAYS))
        .where(RegulatoryRequirement.is_active.is_(True))
    )
    if portfolio:
        query = query.where(FilingCalendarEntry.project_id.is_(None))
    else:
        query = query.where(FilingCalendarEntry.project_id == project_id)
    return sorted(
        (filing_alert(e, r, today) for e, r in (await db.execute(query)).all()),
        key=lambda a: a["days_remaining"])


# ---------------------------------------------------------------- reminders

async def due_reminders(db: AsyncSession, today: date) -> List[UserReminder]:
    return list((await db.execute(
        select(UserReminder).where(UserReminder.status == "active", UserReminder.remind_on_ad <= today)
        .order_by(UserReminder.remind_on_ad))).scalars().all())


async def send_due_reminders(db: AsyncSession, email_service, today: date) -> int:
    """Email each due reminder to its owner and mark it sent. A reminder with no deliverable address stays active."""
    from backend.app.models.auth import User
    from backend.app.services.email_service import EmailMessage

    sent = 0
    for reminder in await due_reminders(db, today):
        user = (await db.execute(select(User).where(User.username == reminder.owner_username))).scalar_one_or_none()
        if user is None or not user.email:
            logger.warning("Reminder %s: no email for %s", reminder.id, reminder.owner_username)
            continue
        body = reminder.title + (f"\n\n{reminder.note}" if reminder.note else "")
        body += f"\n\nReminder date: {reminder.remind_on_ad.isoformat()} AD / {reminder.remind_on_bs or 'n/a'} BS"
        ok = await email_service.provider.send(EmailMessage(
            to=[user.email], subject=f"HPMS reminder: {reminder.title}", body_text=body))
        if ok:
            reminder.status, reminder.sent_at = "sent", today
            sent += 1
    await db.flush()
    return sent


# ---------------------------------------------------------------- stakeholder routing

AlertRow = Tuple[Optional[Any], str, str, List[Dict[str, Any]]]  # (project_id, code, name, alerts)


def contact_wants(contact: StakeholderContact, project_id: Optional[Any], alert: Dict[str, Any]) -> bool:
    if not contact.is_active:
        return False
    if contact.project_id is not None and str(contact.project_id) != str(project_id):
        return False
    if contact.alert_types and alert["entity_type"] not in contact.alert_types:
        return False
    return URGENCY_RANK.get(alert["urgency"], 0) >= URGENCY_RANK.get(contact.min_urgency, 2)


def route_alerts(contacts: Iterable[StakeholderContact], rows: Iterable[AlertRow]) -> Dict[str, List[str]]:
    """Group alert lines by contact email. Portfolio-level alerts (project_id None) only reach contacts
    not pinned to a single project."""
    rows = list(rows)
    out: Dict[str, List[str]] = defaultdict(list)
    for contact in contacts:
        for project_id, code, name, alerts in rows:
            for a in alerts:
                if contact_wants(contact, project_id, a):
                    out[contact.email].append(
                        f"[{code}] {name}: {a['description']} ({a['urgency']}, {a['days_remaining']} days)")
    return dict(out)
