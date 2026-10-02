"""Dual-calendar (AD + BS) helpers shared by every report format."""

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional


def bs_string(d: Optional[date]) -> Optional[str]:
    """YYYY-MM-DD Bikram Sambat string for an AD date, or None if unconvertible."""
    from backend.app.services.risk_service import bs_string as _bs
    return _bs(d)


def _as_date(value: Any) -> Optional[date]:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and len(value) >= 10:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def add_bs_columns(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Fill every ``<name>_ad`` / ``<name>_date_ad`` column's ``_bs`` twin from the AD value.

    Existing non-empty BS values are kept. Rows are modified in place and returned.
    """
    for row in rows:
        for key in [k for k in row if k.endswith("_ad")]:
            twin = key[:-3] + "_bs"
            if twin in row and row[twin]:
                continue
            row[twin] = bs_string(_as_date(row[key]))
    return rows


def dual_stamp(now: Optional[datetime] = None) -> str:
    """'2026-10-02 AD / 2083-06-16 BS' for report headers and footers."""
    now = now or datetime.now(timezone.utc)
    return f"{now:%Y-%m-%d} AD / {bs_string(now.date()) or 'n/a'} BS"
