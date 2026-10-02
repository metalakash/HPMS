"""Regulatory filing periods in the Nepali fiscal calendar (RFP E.7, E.23).

Nepal's fiscal year starts on 1 Shrawan (BS month 4) and ends on the last day of Ashadh
(month 3). Quarters therefore end in Ashwin (6), Poush (9), Chaitra (12) and Ashadh (3).
Periods are computed in BS and returned with their AD equivalents.
"""

from dataclasses import dataclass
from datetime import date
from typing import List

import nepali_datetime

from backend.app.services.report_dates import bs_string

FREQUENCIES = ("monthly", "quarterly", "semi_annual", "annual")

# BS months in which a period ends, per frequency
_PERIOD_END_MONTHS = {
    "monthly": tuple(range(1, 13)),
    "quarterly": (3, 6, 9, 12),
    "semi_annual": (3, 9),
    "annual": (3,),
}


_QUARTER_OF_END_MONTH = {6: 1, 9: 2, 12: 3, 3: 4}


@dataclass(frozen=True)
class FilingPeriod:
    label: str          # e.g. "FY 2082/83 Q1", "FY 2082/83", "2082-04 (Shrawan)"
    end_ad: date
    end_bs: str


def _last_day_of_bs_month(year: int, month: int) -> int:
    for day in (32, 31, 30, 29):
        try:
            nepali_datetime.date(year, month, day)
            return day
        except ValueError:
            continue
    raise ValueError(f"No valid day found for BS {year}-{month}")


def fiscal_year_of(bs_year: int, bs_month: int) -> int:
    """BS year in which the fiscal year containing this month started (Shrawan = month 4)."""
    return bs_year if bs_month >= 4 else bs_year - 1


def _label(frequency: str, bs_year: int, bs_month: int) -> str:
    fy = fiscal_year_of(bs_year, bs_month)
    fy_label = f"FY {fy}/{(fy + 1) % 100:02d}"
    if frequency == "annual":
        return fy_label
    if frequency == "semi_annual":
        return f"{fy_label} H{1 if bs_month == 9 else 2}"
    if frequency == "quarterly":
        return f"{fy_label} Q{_QUARTER_OF_END_MONTH[bs_month]}"
    return f"{bs_year}-{bs_month:02d}"


def period_ends(frequency: str, start: date, end: date) -> List[FilingPeriod]:
    """Every period that *ends* between ``start`` and ``end`` (inclusive), oldest first.

    Raises ValueError for an unknown frequency, a reversed range, or dates outside the BS tables.
    """
    if frequency not in _PERIOD_END_MONTHS:
        raise ValueError(f"frequency must be one of {', '.join(FREQUENCIES)}")
    if end < start:
        raise ValueError("end must not be before start")

    first = nepali_datetime.date.from_datetime_date(start)
    last = nepali_datetime.date.from_datetime_date(end)
    months = _PERIOD_END_MONTHS[frequency]

    periods: List[FilingPeriod] = []
    for year in range(first.year, last.year + 1):
        for month in months:
            period_end = nepali_datetime.date(year, month, _last_day_of_bs_month(year, month)).to_datetime_date()
            if start <= period_end <= end:
                periods.append(FilingPeriod(
                    label=_label(frequency, year, month), end_ad=period_end, end_bs=bs_string(period_end) or ""))
    periods.sort(key=lambda p: p.end_ad)
    return periods
