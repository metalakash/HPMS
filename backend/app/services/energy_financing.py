"""Energy-sector financing against the regulator's minimum: pure arithmetic, no database.

For each fiscal quarter end:

    energy financing = hydropower loans outstanding + investment in energy bonds
    base             = the bank's total loans and advances two quarters (six months) earlier
    ratio            = energy financing / base
    requirement      = base x the minimum share in force that quarter
    headroom         = energy financing - requirement   (negative is a shortfall)

A quarter that has passed uses the figures the bank recorded for it. A later quarter takes its
hydropower outstanding from the loan projection and its bonds from the bond register (a bond
counts from its investment date until it matures).

A scenario adds lending that is planned but not yet approved: pass what it would add to the
outstanding at each quarter end and the same test is run on the larger book.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional, Sequence

BASE_LAG_QUARTERS = 2
PCT = Decimal("0.0001")


@dataclass(frozen=True)
class Bond:
    amount: Decimal
    investment_date: Optional[date]
    maturity_date: Optional[date]


@dataclass(frozen=True)
class QuarterInput:
    period_end: date
    bank_total_loans: Optional[Decimal] = None
    required_pct: Optional[Decimal] = None
    hydro_outstanding_actual: Optional[Decimal] = None
    energy_bond_actual: Optional[Decimal] = None


@dataclass(frozen=True)
class QuarterResult:
    period_end: date
    hydro_outstanding: Optional[Decimal]
    energy_bonds: Decimal
    energy_financing: Optional[Decimal]
    base_loans: Optional[Decimal]
    ratio_pct: Optional[Decimal]
    required_pct: Optional[Decimal]
    requirement: Optional[Decimal]
    headroom: Optional[Decimal]
    status: Optional[str]  # met, shortfall, or None where there is no requirement or nothing to test
    is_actual: bool


def bonds_held(bonds: Sequence[Bond], on: date) -> Decimal:
    """Face value of the bonds held on a date."""
    return sum((b.amount for b in bonds
                if (b.investment_date is None or b.investment_date <= on)
                and (b.maturity_date is None or b.maturity_date > on)), Decimal("0"))


def cumulative(flows: Dict[date, Decimal], period_ends: Sequence[date]) -> Dict[date, Decimal]:
    """What a series of disbursements has added to the outstanding by each quarter end."""
    return {end: sum((amount for day, amount in flows.items() if day <= end), Decimal("0")) for end in period_ends}


def calculate(quarters: Sequence[QuarterInput], projected_outstanding: Dict[date, Decimal],
              bonds: Sequence[Bond], additional_outstanding: Optional[Dict[date, Decimal]] = None) -> List[QuarterResult]:
    """One result per input quarter, oldest first. ``quarters`` must be consecutive fiscal quarters.

    ``additional_outstanding`` is a scenario's extra lending at each quarter end. It is added to
    projected quarters only: a recorded quarter is what it was.
    """
    ordered = sorted(quarters, key=lambda q: q.period_end)
    results: List[QuarterResult] = []
    for index, quarter in enumerate(ordered):
        is_actual = quarter.hydro_outstanding_actual is not None
        hydro = quarter.hydro_outstanding_actual if is_actual else projected_outstanding.get(quarter.period_end)
        if hydro is not None and not is_actual and additional_outstanding:
            hydro += additional_outstanding.get(quarter.period_end, Decimal("0"))
        held = quarter.energy_bond_actual if quarter.energy_bond_actual is not None else bonds_held(bonds, quarter.period_end)
        base = ordered[index - BASE_LAG_QUARTERS].bank_total_loans if index >= BASE_LAG_QUARTERS else None
        financing = hydro + held if hydro is not None else None

        ratio = requirement = headroom = status = None
        if financing is not None and base:
            ratio = (financing / base * 100).quantize(PCT)
            if quarter.required_pct is not None:
                requirement = base * quarter.required_pct / 100
                headroom = financing - requirement
                status = "met" if headroom >= 0 else "shortfall"
        results.append(QuarterResult(
            period_end=quarter.period_end, hydro_outstanding=hydro, energy_bonds=held, energy_financing=financing,
            base_loans=base, ratio_pct=ratio, required_pct=quarter.required_pct, requirement=requirement,
            headroom=headroom, status=status, is_actual=is_actual))
    return results
