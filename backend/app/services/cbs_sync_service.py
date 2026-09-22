"""CBS synchronization service orchestrating data updates and audit trail.

Handles:
1. Fetching account data from Finacle adapter
2. Detecting rate changes and creating history records
3. Updating loan_accounts table with CBS data
4. Logging sync events with encrypted payloads
5. DLQ handling for retryable errors
"""

import logging
from datetime import datetime, date
from typing import Optional
from decimal import Decimal
import json
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update
from sqlalchemy.exc import IntegrityError, OperationalError

from backend.app.models.financial import (
    LoanAccount,
    CBSSyncLog,
    LoanAccountRateHistory,
)
from backend.app.models.project import Project
from backend.app.integration.finacle_adapter import (
    FinacleAdapterBase,
    FinacleSyncRequest,
    FinacleSyncType,
    FinacleAccountRecord,
)
from backend.app.integration.finacle_schema import FinacleFieldMapping

logger = logging.getLogger(__name__)


class CBSSyncService:
    """Orchestrate Finacle CBS synchronization with resilience and auditability."""

    def __init__(self, adapter: FinacleAdapterBase):
        self.adapter = adapter

    async def sync_loan_accounts(
        self,
        db: AsyncSession,
        sync_type: FinacleSyncType,
        account_ids: Optional[list[str]] = None,
        date_range: Optional[tuple[date, date]] = None,
        user_id: str = "SYSTEM",
    ) -> dict:
        """Synchronize loan accounts from Finacle CBS.

        Args:
            db: async database session
            sync_type: REALTIME_INQUIRY, EOD_BATCH, or BOD_BATCH
            account_ids: specific accounts to sync (None = all)
            date_range: for batch syncs, the date range
            user_id: user triggering the sync (for audit)

        Returns:
            dict with sync results: {
                'sync_log_id': UUID,
                'status': 'ok' | 'dlq' (dead-letter queue),
                'message': str,
                'accounts_synced': int,
                'rate_changes': int,
                'errors': [str],
            }
        """

        request_id = str(uuid.uuid4())
        sync_log_id = None
        dlq_flag = "ok"
        errors = []
        accounts_synced = 0
        rate_changes = 0

        try:
            # Create sync request
            request = FinacleSyncRequest(
                sync_type=sync_type,
                request_id=request_id,
                account_ids=account_ids,
                date_range=date_range,
            )

            logger.info(f"Starting CBS sync: {request_id} ({sync_type.value})")

            # Call adapter with circuit breaker
            response = await self.adapter.sync_with_circuit_breaker(request)

            # Process response
            if not response.is_success:
                error_msg = f"CBS returned error code {response.response_code}: {response.response_message}"
                logger.error(error_msg)
                errors.append(error_msg)
                dlq_flag = "dlq"  # Retryable error
                raise Exception(error_msg)

            # Update loan accounts and detect rate changes
            for cbs_account in response.account_records:
                try:
                    updated, rate_changed = await self._update_loan_account(
                        db, cbs_account, user_id
                    )
                    if updated:
                        accounts_synced += 1
                    if rate_changed:
                        rate_changes += 1
                except Exception as e:
                    error_msg = f"Failed to sync account {cbs_account.finacle_account_id}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)

            logger.info(
                f"CBS sync complete: {accounts_synced} accounts updated, "
                f"{rate_changes} rate changes, {len(errors)} errors"
            )

        except Exception as e:
            error_msg = f"CBS sync failed: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)
            dlq_flag = "dlq"  # Circuit breaker open or connection error

        finally:
            # Always log the sync attempt
            sync_log_id = await self._log_sync(
                db,
                request_id,
                sync_type,
                accounts_synced,
                len(errors),
                dlq_flag,
                response if 'response' in locals() else None,
                errors,
                user_id,
            )

        return {
            'sync_log_id': str(sync_log_id),
            'status': dlq_flag,
            'accounts_synced': accounts_synced,
            'rate_changes': rate_changes,
            'errors': errors,
            'message': f"Synced {accounts_synced} accounts, {rate_changes} rate changes, "
                      f"{len(errors)} errors" + (f" (DLQ)" if dlq_flag == "dlq" else ""),
        }

    async def _update_loan_account(
        self,
        db: AsyncSession,
        cbs_account: FinacleAccountRecord,
        user_id: str,
    ) -> tuple[bool, bool]:
        """Update loan account from CBS record.

        Returns:
            (was_updated, rate_changed)
        """

        # Find existing account
        stmt = select(LoanAccount).where(
            LoanAccount.finacle_account_id == cbs_account.finacle_account_id
        )
        result = await db.execute(stmt)
        existing_account = result.scalar_one_or_none()

        # Determine if this is new or update
        is_new = existing_account is None

        # Prepare update data
        update_data = {
            'facility_type': cbs_account.account_type,
            'sanctioned_amount': cbs_account.sanctioned_amount,
            'disbursed_amount': cbs_account.disbursed_amount,
            'outstanding_principal': cbs_account.outstanding_principal,
            'outstanding_interest': cbs_account.outstanding_interest,
            'overdue_principal': cbs_account.overdue_principal,
            'overdue_interest': cbs_account.overdue_interest,
            'currency_code': cbs_account.currency_code,
            'interest_rate_pct': cbs_account.interest_rate_pct,
            'maturity_ad': cbs_account.maturity_date,
            'moratorium_end_ad': cbs_account.moratorium_end_date,
            'last_synced_at': datetime.utcnow().isoformat(),
            'sync_status': 'success',
            'data_provenance': 'CBS_SYNCED',
            'source_reference': f"Finacle:{cbs_account.finacle_account_id}",
            'updated_by': user_id,
        }

        rate_changed = False

        if is_new:
            # NEW ACCOUNT: must have project_id (try to link by customer_id or fail)
            logger.info(f"Creating new loan account: {cbs_account.finacle_account_id}")

            # For now, fail if no project link. In Phase 2, implement customer → project mapping
            raise ValueError(
                f"New account {cbs_account.finacle_account_id} has no project mapping. "
                "Manual linking required."
            )

        else:
            # EXISTING ACCOUNT: check for rate change
            old_rate = existing_account.interest_rate_pct
            new_rate = cbs_account.interest_rate_pct

            if old_rate != new_rate:
                rate_changed = True
                logger.info(
                    f"Rate change detected for {cbs_account.finacle_account_id}: "
                    f"{old_rate}% → {new_rate}%"
                )

                # Create history record for old rate (mark as no longer current)
                if old_rate:
                    await self._archive_rate(
                        db,
                        existing_account.id,
                        old_rate,
                        user_id,
                    )

                # Create new rate history entry (current)
                await self._record_rate_change(
                    db,
                    existing_account.id,
                    new_rate,
                    cbs_account.rate_reset_date,
                    user_id,
                )

            # Update the account
            stmt = (
                update(LoanAccount)
                .where(LoanAccount.id == existing_account.id)
                .values(**update_data)
            )
            await db.execute(stmt)

        return (True, rate_changed)

    async def _archive_rate(
        self,
        db: AsyncSession,
        loan_account_id: str,
        rate_pct: Decimal,
        user_id: str,
    ):
        """Mark old rate as no longer current."""

        stmt = (
            update(LoanAccountRateHistory)
            .where(
                (LoanAccountRateHistory.loan_account_id == loan_account_id) &
                (LoanAccountRateHistory.is_current == 'Y')
            )
            .values(
                is_current='N',
                valid_to_ad=date.today(),
                updated_by=user_id,
            )
        )
        await db.execute(stmt)

    async def _record_rate_change(
        self,
        db: AsyncSession,
        loan_account_id: str,
        rate_pct: Decimal,
        rate_reset_date: Optional[date],
        user_id: str,
    ):
        """Create new rate history entry."""

        rate_record = LoanAccountRateHistory(
            id=uuid.uuid4(),
            loan_account_id=loan_account_id,
            interest_rate_pct=rate_pct,
            valid_from_ad=rate_reset_date or date.today(),
            valid_from_bs=None,  # BS conversion done at API layer
            is_current='Y',
            reason_for_change='CBS rate reset',
            data_provenance='CBS_SYNCED',
            source_reference=f"CBS sync on {datetime.utcnow().isoformat()}",
            created_by=user_id,
            updated_by=user_id,
        )

        db.add(rate_record)
        logger.info(f"Created rate history entry: {rate_pct}% from {rate_reset_date}")

    async def _log_sync(
        self,
        db: AsyncSession,
        request_id: str,
        sync_type: FinacleSyncType,
        records_processed: int,
        records_failed: int,
        dlq_flag: str,
        response: Optional = None,
        errors: Optional[list[str]] = None,
        user_id: str = "SYSTEM",
    ) -> uuid.UUID:
        """Log sync event to CBS sync log with encrypted payload."""

        # Build raw payload (will be encrypted by pgcrypto)
        payload = {
            'request_id': request_id,
            'sync_type': sync_type.value,
            'records_processed': records_processed,
            'records_failed': records_failed,
            'dlq_flag': dlq_flag,
            'errors': errors or [],
            'timestamp': datetime.utcnow().isoformat(),
        }

        if response:
            payload['response_code'] = response.response_code
            payload['response_message'] = response.response_message

        sync_log = CBSSyncLog(
            id=uuid.uuid4(),
            loan_account_id=None,  # Batch sync applies to all
            sync_type=sync_type.value,
            request_ref=request_id,
            response_code=response.response_code if response else "ERROR",
            started_at=datetime.utcnow().isoformat(),
            completed_at=datetime.utcnow().isoformat(),
            record_count=records_processed,
            raw_payload=json.dumps(payload),  # Will be encrypted at DB layer
            error_detail='\n'.join(errors) if errors else None,
            retry_count=1 if dlq_flag == "dlq" else 0,
            dlq_flag=dlq_flag,
            created_by=user_id,
            updated_by=user_id,
        )

        db.add(sync_log)

        try:
            await db.flush()
        except IntegrityError as e:
            logger.error(f"Failed to log sync: {e}")

        logger.info(f"Logged sync {sync_log.id}: {records_processed} records, dlq_flag={dlq_flag}")

        return sync_log.id
