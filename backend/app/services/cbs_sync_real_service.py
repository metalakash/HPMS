"""On-demand sync of one loan account from the core banking system.

Fetches the account through the configured adapter, shows what differs from the local copy,
and (unless it is a dry run or the mock adapter) writes the differences, records them in the
audit chain and re-tests the project's covenants.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
import logging

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.integration.finacle_adapter import (
    FinacleAdapterBase,
    FinacleSyncRequest,
    FinacleSyncType,
    MockFinacleAdapter,
)
from backend.app.models.financial import LoanAccount, LoanAccountRateHistory
from backend.app.services.audit_chain import append_audit_log
from backend.app.services.risk_service import bs_string

logger = logging.getLogger(__name__)

# Fields the core banking system owns: local column -> field on the adapter's record
CBS_OWNED = {
    "disbursed_amount": "disbursed_amount",
    "outstanding_principal": "outstanding_principal",
    "outstanding_interest": "outstanding_interest",
    "overdue_principal": "overdue_principal",
    "overdue_interest": "overdue_interest",
    "interest_rate_pct": "interest_rate_pct",
    "maturity_ad": "maturity_date",
}


def _plain(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    return value.isoformat() if isinstance(value, (date, datetime)) else value


async def apply_cbs_record(db: AsyncSession, loan: LoanAccount, record: Any, user_id: str, adapter_name: str,
                           user_role: Optional[str] = None, source_ip: Optional[str] = None) -> Dict[str, Any]:
    """Write the fields the record supplies and that differ, with a rate-history entry and an audit row.

    Returns the changed fields as {column: new value}; empty when the loan was already up to date.
    """
    before: Dict[str, Any] = {}
    after: Dict[str, Any] = {}
    for column, source in CBS_OWNED.items():
        new = getattr(record, source, None)
        old = getattr(loan, column)
        if new is None or (old is not None and old == new):
            continue
        before[column], after[column] = old, new

    now = datetime.utcnow().isoformat()
    loan.last_synced_at = now
    loan.sync_status = "success"
    if not after:
        await db.flush()
        return {}

    if "interest_rate_pct" in after:
        effective = getattr(record, "rate_reset_date", None) or date.today()
        await db.execute(
            update(LoanAccountRateHistory)
            .where(LoanAccountRateHistory.loan_account_id == loan.id, LoanAccountRateHistory.is_current == "Y")
            .values(is_current="N", valid_to_ad=effective, valid_to_bs=bs_string(effective), updated_by=user_id))
        db.add(LoanAccountRateHistory(
            loan_account_id=loan.id, interest_rate_pct=after["interest_rate_pct"], valid_from_ad=effective,
            valid_from_bs=bs_string(effective), is_current="Y", reason_for_change="CBS rate reset",
            data_provenance="CBS_SYNCED", source_reference=f"CBS sync {now}", created_by=user_id))

    for column, value in after.items():
        setattr(loan, column, value)
    if "maturity_ad" in after:
        loan.maturity_bs = bs_string(after["maturity_ad"])
    loan.data_provenance = "CBS_SYNCED"
    loan.source_reference = f"CBS:{adapter_name}"
    loan.updated_by = user_id
    await db.flush()

    await append_audit_log(
        db, user_id=user_id, user_role=user_role, entity_type="LOAN", entity_id=loan.id, action="cbs_sync",
        reason=f"Balances updated from the core banking system ({adapter_name} adapter)",
        pre_state={k: _plain(v) for k, v in before.items()}, post_state={k: _plain(v) for k, v in after.items()},
        source_ip=source_ip)
    return after


class CBSSyncService:
    """Sync one loan account on demand."""

    def __init__(self, adapter: FinacleAdapterBase):
        self.adapter = adapter

    @staticmethod
    def _failure(status: str, error: str) -> Dict[str, Any]:
        return {"sync_timestamp": datetime.utcnow().isoformat(), "status": status, "error": error,
                "changes_count": 0, "diff_log": []}

    async def sync_loan_account(
        self,
        db: AsyncSession,
        project_id: str,
        loan_id: str,
        user_id: str = "system",
        dry_run: bool = False,
        user_role: Optional[str] = None,
        source_ip: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Compare a loan with the core banking system and bring it up to date.

        ``loan_id`` is the loan account's id or its core banking account number; the loan must
        belong to ``project_id``. Returns the status, the field-by-field diff and whether it
        was written (``applied``). ``simulated`` marks the mock adapter, whose sample record is
        never written; ``dry_run`` compares against the real system without writing.
        """
        try:
            # Clients know the loan by its own id (API responses mask the account number)
            try:
                matches_loan = LoanAccount.id == uuid.UUID(str(loan_id))
            except ValueError:
                matches_loan = LoanAccount.finacle_account_id == loan_id
            loan = (await db.execute(select(LoanAccount).where(
                matches_loan, LoanAccount.project_id == uuid.UUID(str(project_id))))).scalars().first()
            if not loan:
                logger.warning(f"Loan account {loan_id} not found locally")
                return self._failure("error", "Loan account not found")

            response = await self.adapter.sync_with_circuit_breaker(FinacleSyncRequest(
                sync_type=FinacleSyncType.REALTIME_INQUIRY, request_id=str(uuid.uuid4()),
                account_ids=[loan.finacle_account_id]))
            if response.response_code != "000":
                logger.error(f"CBS sync failed: {response.response_message}")
                return self._failure("error", response.response_message)
            if not response.account_records:
                message = response.response_message
                return self._failure("no_data", message if message not in ("", "Success") and
                                     not message.startswith("Read ") else "The account is not in the CBS data")
            record = response.account_records[0]

            local = {source: getattr(loan, column) for column, source in CBS_OWNED.items()}
            diff_log: List[Dict[str, Any]] = self.adapter.compute_diff_log(local, record)
            changes = [d for d in diff_log if d["status"] == "changed"]

            # The mock adapter answers every account with one built-in sample record. Comparing against
            # it is useful to exercise the flow; writing it over real balances never is.
            simulated = isinstance(self.adapter, MockFinacleAdapter)
            applied = False
            if not simulated and not dry_run:
                written = await apply_cbs_record(db, loan, record, user_id, self.adapter.name,
                                                 user_role=user_role, source_ip=source_ip)
                applied = bool(written)
                if applied:
                    from backend.app.services.covenant_service import CovenantService
                    await CovenantService.recalculate_project(db, loan.project_id)

            return {
                "sync_timestamp": datetime.utcnow().isoformat(),
                "status": "success",
                "changes_count": len(changes),
                "diff_log": diff_log,
                "simulated": simulated,
                "dry_run": dry_run,
                "applied": applied,
                "adapter": self.adapter.name,
            }

        except Exception as e:
            logger.error(f"Error syncing loan account {loan_id}: {e}")
            return self._failure("error", str(e))

    def get_adapter_status(self) -> Dict[str, Any]:
        """Adapter health: what it is connected to, circuit breaker and rate limiter."""
        return {
            **self.adapter.describe(),
            "circuit_breaker": self.adapter.get_circuit_breaker_status(),
            "rate_limiter": self.adapter.get_rate_limiter_status(),
        }
