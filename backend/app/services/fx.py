"""NPR equivalents of amounts in other currencies, at the rate in force on a date (RFP FUNC B.3).

A rate applies from its effective date until the next one for the same currency. An amount in a currency
with no rate on file on that date has no NPR equivalent (None), and says so, rather than a guess.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.financial import ExchangeRate

HOME = "NPR"
MONEY = Decimal("0.01")


@dataclass(frozen=True)
class Rate:
    currency: str
    rate_to_npr: Decimal
    effective_from: Optional[date]


class Rates:
    """Every rate on file, loaded once, for converting many amounts."""

    def __init__(self, rows: List[ExchangeRate]):
        self._by_currency: Dict[str, List[ExchangeRate]] = {}
        for row in sorted(rows, key=lambda r: r.effective_from_ad):
            self._by_currency.setdefault(row.currency_code, []).append(row)

    def on(self, currency: Optional[str], day: date) -> Optional[Rate]:
        code = (currency or HOME).upper()
        if code == HOME:
            return Rate(HOME, Decimal("1"), None)
        found = None
        for row in self._by_currency.get(code, []):
            if row.effective_from_ad <= day:
                found = row
        return Rate(code, found.rate_to_npr, found.effective_from_ad) if found else None

    def to_npr(self, amount: Optional[Decimal], currency: Optional[str], day: date) -> Optional[Decimal]:
        rate = self.on(currency, day)
        if amount is None or rate is None:
            return None
        return (Decimal(amount) * rate.rate_to_npr).quantize(MONEY)


async def load(db: AsyncSession) -> Rates:
    return Rates(list((await db.execute(select(ExchangeRate))).scalars()))


async def listing(db: AsyncSession) -> List[dict]:
    """Each currency's current rate and its history, newest first."""
    rows = (await db.execute(select(ExchangeRate).order_by(ExchangeRate.currency_code,
                                                            ExchangeRate.effective_from_ad.desc()))).scalars().all()
    today = date.today()
    currencies: Dict[str, dict] = {}
    for row in rows:
        entry = currencies.setdefault(row.currency_code, {"currency_code": row.currency_code, "current": None, "history": []})
        view = {"rate_to_npr": str(row.rate_to_npr), "effective_from_ad": row.effective_from_ad.isoformat(),
                "effective_from_bs": row.effective_from_bs, "source_reference": row.source_reference}
        entry["history"].append(view)
        if entry["current"] is None and row.effective_from_ad <= today:
            entry["current"] = view
    return list(currencies.values())
