"""Application settings an admin manages from the Settings screen (RFP FUNC A.5).

Each setting is defined here with its default and limits, and is read by the code it controls; a value
is stored (``app_parameters``) only once it differs from the default. Changing one is a change request
of type SETTING, which a second administrator approves.
"""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.governance import AppParameter


@dataclass(frozen=True)
class Setting:
    name: str
    group: str
    label: str
    description: str
    default: Decimal
    minimum: Decimal
    maximum: Decimal
    unit: str
    integer: bool = False


SETTINGS: Dict[str, Setting] = {s.name: s for s in (
    Setting("alert_warning_days", "Alerts", "Expiry warning lead time",
            "Permits, licences, PPAs and insurance policies are flagged this many days before they expire.",
            Decimal("90"), Decimal("7"), Decimal("365"), "days", integer=True),
    Setting("alert_critical_days", "Alerts", "Expiry critical lead time",
            "Within this many days of expiry an alert is marked critical. Must be shorter than the warning lead time.",
            Decimal("30"), Decimal("1"), Decimal("180"), "days", integer=True),
    Setting("default_dscr_min", "Covenant defaults", "Minimum DSCR",
            "Used for a facility with no sanction terms of its own.", Decimal("1.25"), Decimal("0.5"), Decimal("5"), "x"),
    Setting("default_icr_min", "Covenant defaults", "Minimum ICR",
            "Used for a facility with no sanction terms of its own.", Decimal("2.0"), Decimal("0.5"), Decimal("10"), "x"),
    Setting("default_ltv_max", "Covenant defaults", "Maximum LTV",
            "Used for a facility with no sanction terms of its own.", Decimal("70"), Decimal("10"), Decimal("100"), "%"),
    Setting("default_warning_margin_pct", "Covenant defaults", "Warning margin",
            "A ratio within this share of its threshold is reported as a warning rather than compliant.",
            Decimal("8"), Decimal("0"), Decimal("50"), "%"),
)}

COVENANT_DEFAULTS = ("default_dscr_min", "default_icr_min", "default_ltv_max", "default_warning_margin_pct")


def parse(name: str, value: Any) -> Decimal:
    """The value as the setting's type, refused when outside its limits."""
    setting = SETTINGS.get(name)
    if setting is None:
        raise ValueError(f"Unknown setting {name!r}")
    try:
        number = Decimal(str(value).strip())
    except (InvalidOperation, AttributeError):
        raise ValueError(f"{setting.label}: {value!r} is not a number") from None
    if not number.is_finite():
        raise ValueError(f"{setting.label}: {value!r} is not a number")
    if setting.integer and number != number.to_integral_value():
        raise ValueError(f"{setting.label} is a whole number of {setting.unit}")
    if not setting.minimum <= number <= setting.maximum:
        raise ValueError(f"{setting.label} must be between {setting.minimum} and {setting.maximum} {setting.unit}")
    return number


async def stored(db: AsyncSession) -> Dict[str, Decimal]:
    rows = (await db.execute(select(AppParameter))).scalars().all()
    return {row.name: Decimal(row.value) for row in rows if row.name in SETTINGS}


async def value(db: AsyncSession, name: str) -> Decimal:
    row = await db.get(AppParameter, name)
    return Decimal(row.value) if row else SETTINGS[name].default


async def values(db: AsyncSession) -> Dict[str, Decimal]:
    current = {name: setting.default for name, setting in SETTINGS.items()}
    current.update(await stored(db))
    return current


def check_consistent(current: Dict[str, Decimal]) -> None:
    """Rules across settings, checked against the values they would have after a change."""
    if current["alert_critical_days"] >= current["alert_warning_days"]:
        raise ValueError("The critical lead time must be shorter than the warning lead time")


async def listing(db: AsyncSession) -> List[Dict[str, Any]]:
    current = await stored(db)
    return [{
        "name": s.name, "group": s.group, "label": s.label, "description": s.description, "unit": s.unit,
        "value": str(current.get(s.name, s.default)), "default": str(s.default), "is_default": s.name not in current,
        "minimum": str(s.minimum), "maximum": str(s.maximum), "integer": s.integer,
    } for s in SETTINGS.values()]


async def save(db: AsyncSession, name: str, number: Decimal, by: str) -> Optional[Decimal]:
    """Store a value (a value equal to the default removes the row). Returns the previous value."""
    row = await db.get(AppParameter, name)
    previous = Decimal(row.value) if row else SETTINGS[name].default
    if number == SETTINGS[name].default:
        if row is not None:
            await db.delete(row)
    elif row is None:
        db.add(AppParameter(name=name, value=str(number), created_by=by, updated_by=by))
    else:
        row.value, row.updated_by = str(number), by
    await db.flush()
    return previous
