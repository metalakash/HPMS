"""The bank workbook importer's parsing, against small workbooks built here in the bank's layout.

No database and no customer data: the borrowers and figures below are invented.
"""

from datetime import date
from decimal import Decimal

import pytest

openpyxl = pytest.importorskip("openpyxl")

from backend.scripts import import_bank_portfolio as importer  # noqa: E402
from tests.bank_workbooks import generation_book, projection_book  # noqa: E402


@pytest.fixture
def projection_workbook(tmp_path):
    path = tmp_path / "projection.xlsx"
    projection_book().save(path)
    return path


def test_borrowers_take_their_status_from_the_row_colour(projection_workbook):
    issues = []
    portfolio = importer.read_portfolio(projection_workbook, issues)
    alpha, beta = portfolio["borrowers"]

    assert (alpha["name"], alpha["cif"], alpha["status"]) == ("ALPHA HYDRO PVT LTD", "1001", "in operation")
    assert (beta["cif"], beta["status"], beta["outstanding"]) == (None, "yet to start drawdown", Decimal(0))
    assert portfolio["total"] == {"mw": Decimal(30), "limit": Decimal(1400), "outstanding": Decimal(400)}
    assert portfolio["stated"]["in operation"] == {"mw": Decimal(10), "count": 1}
    assert issues == []


def test_projection_quarters_are_dated_from_the_one_named_fiscal_year(projection_workbook):
    portfolio = importer.read_portfolio(projection_workbook, [])
    quarters = portfolio["quarters"]

    assert [(q["fiscal_year"], q["quarter"], q["period_end_bs"]) for q in quarters] == [
        ("2081/82", 3, "2081-12-31"), ("2081/82", 4, "2082-03-32"),
        ("2082/83", 1, "2082-06-31"), ("2082/83", 2, "2082-09-30"),
    ]
    assert quarters[0]["period_end_ad"] == date(2025, 4, 13)
    assert [q["is_opening"] for q in quarters] == [True, False, False, False]

    alpha = portfolio["borrowers"][0]["projection"]
    assert alpha[1] == {"outstanding": Decimal(440), "repayment": Decimal(10), "disbursement": Decimal(50)}
    # Each quarter is the one before plus disbursement less repayment, and the totals match the sheet's
    for before, after in zip(alpha, alpha[1:]):
        assert before["outstanding"] + after["disbursement"] - after["repayment"] == after["outstanding"]
    assert all(q["outstanding_parsed"] == q["outstanding_stated"] for q in quarters)
    assert quarters[3]["disbursement_parsed"] == Decimal(300)


def test_generation_sheets_read_bs_months_units_and_rate_steps(tmp_path):
    book = generation_book()
    path = tmp_path / "generation.xlsx"
    book.save(path)

    issues = []
    plants = importer.read_generation(path, issues)
    months = plants["Alpha Hydro Pvt. Ltd."]
    assert sorted(months) == [(2080, 8), (2080, 9), (2081, 4)]
    assert months[(2080, 9)] == {"contract": Decimal(500000), "generated": Decimal(400000),
                                 "revenue": Decimal(3360000), "rate": Decimal("8.4")}

    borrowers = [{"name": "ALPHA HYDRO PVT LTD"}, {"name": "BETA POWER LTD"}]
    importer.assign_generation(plants, borrowers, issues)
    assert borrowers[0]["plants"] == ["Alpha Hydro Pvt. Ltd."] and borrowers[1]["generation"] == {}
    assert issues == []

    steps = importer.rate_history(borrowers[0]["generation"])
    assert [(s["season"], s["rate"], s["valid_from_bs"], s["valid_to_ad"] is None) for s in steps] == [
        ("wet", Decimal("4.8"), "2080-08-01", False), ("wet", Decimal("4.94"), "2081-04-01", True),
        ("dry", Decimal("8.4"), "2080-09-01", True),
    ]


@pytest.mark.parametrize("label, month", [
    ("Baisakh -2079", 1), ("Jestha-2079", 2), ("Asadh", 3), ("Shrawan ", 4), ("Bhadra", 5), ("Aswin-2080", 6),
    ("Ashwin-2080", 6), ("Kartik", 7), ("Mangsir-2081", 8), ("Mangshir", 8), ("Poush", 9), ("Magh", 10),
    ("Falgun", 11), ("Chaitra", 12), ("Total", None),
])
def test_bs_month_labels(label, month):
    assert importer.bs_month(label) == month
