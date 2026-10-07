"""Covenant arithmetic: DSCR, ICR and LTV from a borrower's financials and the loan schedule.

No database access here, so every rule can be read and tested on its own. ``CovenantService``
gathers the inputs and stores the results.

Definitions (trailing twelve months = the four quarters ending at the test date):

    EBITDA = revenue - operating expenses - royalty
    CFADS  = EBITDA - tax paid                      cash flow available for debt service
    EBIT   = EBITDA - depreciation

    DSCR = CFADS / (principal + interest scheduled in the twelve months)
    ICR  = EBIT  / interest scheduled in the twelve months
    LTV  = outstanding principal at the test date / value of the security x 100

Debt service is what the schedule says was due, not what was paid: a borrower that skipped an
instalment must not look better covered for it. A ratio whose inputs are missing is reported as
``not_tested`` with the reason, never as a guessed number.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional, Sequence, Tuple

RATIO = Decimal("0.0001")
ZERO = Decimal("0")

COMPLIANT, WARNING, BREACHED, NOT_TESTED = "compliant", "warning", "breached", "not_tested"
QUARTERS_IN_TEST = 4


@dataclass(frozen=True)
class Terms:
    """Thresholds from the sanction letter. The defaults apply to a project that has none recorded."""

    dscr_min: Decimal = Decimal("1.25")
    ltv_max: Decimal = Decimal("70")
    icr_min: Decimal = Decimal("2.0")
    warning_margin_pct: Decimal = Decimal("8")  # within this share of the threshold counts as a warning

    def as_thresholds(self) -> dict:
        return {"dscr_min": self.dscr_min, "ltv_max": self.ltv_max, "icr_min": self.icr_min}


DEFAULT_TERMS = Terms()


@dataclass(frozen=True)
class Quarter:
    year: int
    number: int  # 1-4, calendar quarters

    @classmethod
    def of(cls, day: date) -> "Quarter":
        return cls(day.year, (day.month - 1) // 3 + 1)

    @classmethod
    def parse(cls, label: str) -> "Quarter":
        try:
            year, number = label.split("-Q")
            quarter = cls(int(year), int(number))
        except ValueError:
            raise ValueError(f"{label!r} is not a quarter like 2026-Q3") from None
        if not (1 <= quarter.number <= 4 and 1900 <= quarter.year <= 2200):
            raise ValueError(f"{label!r} is not a quarter like 2026-Q3")
        return quarter

    @property
    def label(self) -> str:
        return f"{self.year}-Q{self.number}"

    @property
    def start(self) -> date:
        return date(self.year, self.number * 3 - 2, 1)

    @property
    def end(self) -> date:
        return self.shift(1).start - timedelta(days=1)

    def shift(self, quarters: int) -> "Quarter":
        index = self.year * 4 + self.number - 1 + quarters
        return Quarter(index // 4, index % 4 + 1)


@dataclass(frozen=True)
class PeriodFinancials:
    """One quarter of a borrower's figures, in NPR. Income fields are None until they are reported."""

    quarter: Quarter
    revenue: Optional[Decimal] = None
    operating_expenses: Optional[Decimal] = None
    royalty: Optional[Decimal] = None
    tax_paid: Optional[Decimal] = None
    depreciation: Optional[Decimal] = None
    security_value: Optional[Decimal] = None

    @property
    def has_income(self) -> bool:
        return self.revenue is not None and self.operating_expenses is not None


@dataclass
class Metric:
    value: Optional[Decimal]
    threshold: Decimal
    status: str
    note: Optional[str] = None  # why it was not tested


@dataclass
class Calculation:
    quarter: Quarter
    dscr: Metric
    icr: Metric
    ltv: Metric
    # The figures the ratios were built from, so a reviewer can re-perform the test
    quarters_used: List[str] = field(default_factory=list)
    revenue: Optional[Decimal] = None
    ebitda: Optional[Decimal] = None
    cfads: Optional[Decimal] = None
    ebit: Optional[Decimal] = None
    principal_due: Decimal = ZERO
    interest_due: Decimal = ZERO
    outstanding_principal: Optional[Decimal] = None
    security_value: Optional[Decimal] = None

    @property
    def overall_status(self) -> str:
        return overall_status(m.status for m in (self.dscr, self.icr, self.ltv))


def overall_status(statuses) -> str:
    """Worst of the tested ratios; not_tested only when none of them could be tested."""
    statuses = list(statuses)
    for status in (BREACHED, WARNING, COMPLIANT):
        if status in statuses:
            return status
    return NOT_TESTED


def assess(value: Decimal, threshold: Decimal, higher_is_better: bool, warning_margin_pct: Decimal) -> str:
    """breached past the threshold, warning within the margin of it, otherwise compliant."""
    headroom = (value - threshold) if higher_is_better else (threshold - value)
    if headroom < 0:
        return BREACHED
    return WARNING if headroom < threshold * warning_margin_pct / 100 else COMPLIANT


def window_of(quarter: Quarter) -> Tuple[date, date]:
    """First and last day of the twelve months that end with ``quarter``."""
    return quarter.shift(1 - QUARTERS_IN_TEST).start, quarter.end


def _ratio(numerator: Decimal, denominator: Decimal) -> Decimal:
    return (numerator / denominator).quantize(RATIO)


def calculate(
    quarter: Quarter,
    periods: Sequence[PeriodFinancials],
    principal_due: Decimal,
    interest_due: Decimal,
    outstanding_principal: Optional[Decimal],
    terms: Terms = DEFAULT_TERMS,
) -> Calculation:
    """Test the three covenants at the end of ``quarter``.

    ``periods`` may hold any quarters; the four ending at ``quarter`` are used. ``principal_due``
    and ``interest_due`` are the scheduled amounts falling inside ``window_of(quarter)``.
    """
    by_quarter = {p.quarter: p for p in periods}
    wanted = [quarter.shift(-back) for back in range(QUARTERS_IN_TEST - 1, -1, -1)]
    window = [by_quarter[q] for q in wanted if q in by_quarter and by_quarter[q].has_income]
    margin = terms.warning_margin_pct

    result = Calculation(
        quarter=quarter,
        dscr=Metric(None, terms.dscr_min, NOT_TESTED),
        icr=Metric(None, terms.icr_min, NOT_TESTED),
        ltv=Metric(None, terms.ltv_max, NOT_TESTED),
        principal_due=principal_due, interest_due=interest_due, outstanding_principal=outstanding_principal,
    )

    if len(window) < QUARTERS_IN_TEST:
        missing = [q.label for q in wanted if q not in by_quarter or not by_quarter[q].has_income]
        result.dscr.note = result.icr.note = "No income figures for " + ", ".join(missing)
    else:
        def total(name: str) -> Decimal:
            return sum(((getattr(p, name) or ZERO) for p in window), ZERO)

        result.quarters_used = [p.quarter.label for p in window]
        result.revenue = total("revenue")
        result.ebitda = result.revenue - total("operating_expenses") - total("royalty")
        result.cfads = result.ebitda - total("tax_paid")
        debt_service = principal_due + interest_due
        if debt_service > 0:
            value = _ratio(result.cfads, debt_service)
            result.dscr = Metric(value, terms.dscr_min, assess(value, terms.dscr_min, True, margin))
        else:
            result.dscr.note = "No debt service was scheduled in the twelve months"

        if any(p.depreciation is None for p in window):
            result.icr.note = "Depreciation is not reported for every quarter"
        elif interest_due > 0:
            result.ebit = result.ebitda - total("depreciation")
            value = _ratio(result.ebit, interest_due)
            result.icr = Metric(value, terms.icr_min, assess(value, terms.icr_min, True, margin))
        else:
            result.icr.note = "No interest was scheduled in the twelve months"

    # The most recent valuation on or before the test date secures the loan at that date
    valued = [p for p in periods if p.security_value and p.quarter.end <= quarter.end]
    if not valued:
        result.ltv.note = "No valuation of the security is recorded"
    elif outstanding_principal is None:
        result.ltv.note = "The outstanding principal at the test date is not known"
    else:
        result.security_value = max(valued, key=lambda p: p.quarter.end).security_value
        value = _ratio(outstanding_principal * 100, result.security_value)
        result.ltv = Metric(value, terms.ltv_max, assess(value, terms.ltv_max, False, margin))
    return result
