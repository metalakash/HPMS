"""A new exchange rate as a change request (EXCHANGE_RATE; RFP FUNC B.3).

    entity_id = the currency code, e.g. "USD"
    {"rate_to_npr": "133.45", "effective_from_ad": "2026-10-19", "source_reference": "NRB reference rate"}

A rate is added for a date, never edited: a correction is a new rate from the same or a later date. The
same currency and date twice is refused.
"""

import re
from datetime import date
from typing import Any, Dict
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.financial import ExchangeRate
from backend.app.services.change_kinds import ChangeKind, amount, only_fields, register, require_source
from backend.app.services.fx import HOME
from backend.app.services.report_dates import bs_string

KIND = "EXCHANGE_RATE"


def _checked(entity_id: Any, changes: Dict[str, Any]):
    only_fields(changes, ["rate_to_npr", "effective_from_ad", "source_reference"], KIND)
    code = str(entity_id).upper()
    if not re.fullmatch(r"[A-Z]{3}", code) or code == HOME:
        raise ValueError("Give a three-letter currency code other than NPR")
    rate = amount(changes.get("rate_to_npr"), "rate_to_npr")
    if rate <= 0:
        raise ValueError("rate_to_npr must be above zero")
    if rate.as_tuple().exponent < -6:
        raise ValueError("rate_to_npr: at most six decimals")
    try:
        day = date.fromisoformat(str(changes.get("effective_from_ad")))
    except ValueError:
        raise ValueError("effective_from_ad: give the date the rate applies from, as YYYY-MM-DD") from None
    return code, rate, day, require_source(changes)


async def _existing(db: AsyncSession, code: str, day: date):
    return (await db.execute(select(ExchangeRate).where(
        ExchangeRate.currency_code == code, ExchangeRate.effective_from_ad == day))).scalar_one_or_none()


async def prepare(db: AsyncSession, entity_id: Any, changes: Dict[str, Any]) -> Dict[str, Any]:
    code, _, day, _ = _checked(entity_id, changes)
    if await _existing(db, code, day):
        raise ValueError(f"A {code} rate from {day} is already on file; propose one from another date")
    previous = (await db.execute(select(ExchangeRate).where(
        ExchangeRate.currency_code == code, ExchangeRate.effective_from_ad <= day)
        .order_by(ExchangeRate.effective_from_ad.desc()).limit(1))).scalar_one_or_none()
    return {"rate_to_npr": str(previous.rate_to_npr), "effective_from_ad": previous.effective_from_ad.isoformat()} if previous else {}


async def apply(db: AsyncSession, entity_id: Any, changes: Dict[str, Any], approver: str):
    code, rate, day, source = _checked(entity_id, changes)
    if await _existing(db, code, day):
        raise ValueError(f"A {code} rate from {day} was added since this was proposed")
    db.add(ExchangeRate(id=uuid4(), currency_code=code, rate_to_npr=rate, effective_from_ad=day,
                        effective_from_bs=bs_string(day), source_reference=source, created_by=approver,
                        updated_by=approver))
    await db.flush()
    return {}, {"currency_code": code, "rate_to_npr": str(rate), "effective_from_ad": day.isoformat(),
                "source_reference": source}


register(ChangeKind(name=KIND, project_scoped=False, prepare=prepare, apply=apply, label="Exchange rate for"))
