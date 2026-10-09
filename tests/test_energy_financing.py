"""The energy-financing ratio: pure arithmetic, no database. Figures are invented."""

from datetime import date
from decimal import Decimal

from backend.app.services.energy_financing import Bond, QuarterInput, bonds_held, calculate, cumulative

Q = [date(2025, 1, 13), date(2025, 4, 13), date(2025, 7, 16), date(2025, 10, 17), date(2026, 1, 14)]


def test_ratio_is_measured_against_the_banks_loans_two_quarters_earlier():
    quarters = [
        QuarterInput(Q[0], bank_total_loans=Decimal(10000)),
        QuarterInput(Q[1], bank_total_loans=Decimal(20000)),
        QuarterInput(Q[2], bank_total_loans=Decimal(30000), required_pct=Decimal("6.5"),
                     hydro_outstanding_actual=Decimal(700), energy_bond_actual=Decimal(100)),
    ]
    first, second, third = calculate(quarters, {}, [])

    # No quarter two back, so nothing to measure against
    assert (first.base_loans, first.ratio_pct, second.ratio_pct) == (None, None, None)
    assert third.base_loans == Decimal(10000)
    assert third.energy_financing == Decimal(800)
    assert third.ratio_pct == Decimal("8.0000")
    assert third.requirement == Decimal(650)
    assert (third.headroom, third.status, third.is_actual) == (Decimal(150), "met", True)


def test_later_quarters_use_the_projection_and_the_bond_register():
    quarters = [
        QuarterInput(Q[0], bank_total_loans=Decimal(10000)),
        QuarterInput(Q[1], bank_total_loans=Decimal(10000)),
        QuarterInput(Q[2], required_pct=Decimal(10)),
        QuarterInput(Q[3], required_pct=Decimal(10)),
        QuarterInput(Q[4], required_pct=Decimal(10)),
    ]
    bonds = [Bond(Decimal(200), date(2023, 1, 5), date(2025, 9, 1)), Bond(Decimal(50), date(2025, 8, 1), None)]
    results = calculate(quarters, {Q[2]: Decimal(850), Q[3]: Decimal(900)}, bonds)

    third, fourth, fifth = results[2:]
    assert (third.hydro_outstanding, third.energy_bonds, third.is_actual) == (Decimal(850), Decimal(200), False)
    assert (third.ratio_pct, third.status, third.headroom) == (Decimal("10.5000"), "met", Decimal(50))
    # The first bond has matured and the second has been bought
    assert (fourth.energy_bonds, fourth.ratio_pct, fourth.status) == (Decimal(50), Decimal("9.5000"), "shortfall")
    assert fourth.headroom == Decimal(-50)
    # Nothing projected and no bank-loan figure two quarters back: no ratio, no status
    assert (fifth.hydro_outstanding, fifth.ratio_pct, fifth.status) == (None, None, None)


def test_a_quarter_without_a_minimum_has_a_ratio_but_no_status():
    quarters = [QuarterInput(Q[0], bank_total_loans=Decimal(1000)), QuarterInput(Q[1]),
                QuarterInput(Q[2], hydro_outstanding_actual=Decimal(60), energy_bond_actual=Decimal(0))]
    result = calculate(quarters, {}, [])[2]
    assert (result.ratio_pct, result.requirement, result.headroom, result.status) == (Decimal("6.0000"), None, None, None)


def test_planned_new_lending_is_added_to_projected_quarters_only():
    quarters = [
        QuarterInput(Q[0], bank_total_loans=Decimal(10000)),
        QuarterInput(Q[1], bank_total_loans=Decimal(10000)),
        QuarterInput(Q[2], required_pct=Decimal(10), hydro_outstanding_actual=Decimal(950), energy_bond_actual=Decimal(0)),
        QuarterInput(Q[3], required_pct=Decimal(10)),
    ]
    new_lending = cumulative({Q[2]: Decimal(40), Q[3]: Decimal(80)}, [q.period_end for q in quarters])
    assert new_lending == {Q[0]: 0, Q[1]: 0, Q[2]: Decimal(40), Q[3]: Decimal(120)}

    base = calculate(quarters, {Q[3]: Decimal(930)}, [])
    scenario = calculate(quarters, {Q[3]: Decimal(930)}, [], new_lending)
    # The recorded quarter is unchanged; the projected one moves from a shortfall to met
    assert scenario[2] == base[2]
    assert (base[3].ratio_pct, base[3].status) == (Decimal("9.3000"), "shortfall")
    assert (scenario[3].hydro_outstanding, scenario[3].ratio_pct, scenario[3].status) == (
        Decimal(1050), Decimal("10.5000"), "met")


def test_a_bond_counts_from_investment_until_maturity():
    bond = Bond(Decimal(100), date(2023, 1, 5), date(2030, 1, 3))
    assert bonds_held([bond], date(2023, 1, 4)) == 0
    assert bonds_held([bond], date(2023, 1, 5)) == 100
    assert bonds_held([bond], date(2030, 1, 2)) == 100
    assert bonds_held([bond], date(2030, 1, 3)) == 0
