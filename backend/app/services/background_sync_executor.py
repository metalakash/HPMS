"""Background executor for scheduled loan exposures syncs (Phase 8.3.1)."""

import logging
import asyncio
from datetime import datetime, time
from typing import Optional, List
import httpx
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.financial import LoanExposureSyncSchedule, LoanAccount
from backend.app.models.project import Project
from backend.app.schemas.loan import LoanExposureSyncAlertResponse
from backend.app.services.loan_sync_scheduler_service import LoanSyncSchedulerService

logger = logging.getLogger(__name__)


class BackgroundSyncExecutor:
    """Execute scheduled loan sync operations in background."""

    def __init__(self, db_session_factory):
        """Initialize with database session factory."""
        self.db_session_factory = db_session_factory
        self.http_client = None

    async def initialize_http_client(self):
        """Initialize async HTTP client for bank API calls."""
        if not self.http_client:
            self.http_client = httpx.AsyncClient(timeout=30.0)

    async def shutdown_http_client(self):
        """Shutdown HTTP client."""
        if self.http_client:
            await self.http_client.aclose()

    async def execute_due_syncs(self):
        """
        Execute all due sync schedules.

        This should be called frequently (e.g., every minute) by APScheduler.
        """
        db = self.db_session_factory()

        try:
            # Get all active schedules
            result = db.execute(
                select(LoanExposureSyncSchedule).where(
                    LoanExposureSyncSchedule.is_active == "Y"
                )
            )
            schedules = result.scalars().all()

            logger.debug(f"🔍 Checking {len(schedules)} active schedules for sync...")

            for schedule in schedules:
                if self._should_run(schedule):
                    logger.info(f"⏱️  Due schedule: {schedule.name} ({schedule.id})")
                    await self._execute_sync(db, schedule)

        except Exception as e:
            logger.error(f"❌ Error in execute_due_syncs: {e}", exc_info=True)
        finally:
            db.close()

    def _should_run(self, schedule: LoanExposureSyncSchedule) -> bool:
        """Check if schedule is due to run now."""
        now = datetime.utcnow()
        current_time = now.time()
        current_day = now.weekday()  # 0=Mon, 6=Sun

        # Handle manual frequency
        if schedule.frequency == "manual":
            return False

        # Handle hourly
        if schedule.frequency == "hourly":
            # Run at top of every hour (allow 2-min window)
            return current_time.minute <= 1

        # Handle daily
        if schedule.frequency == "daily":
            if not schedule.scheduled_time_utc:
                logger.warning(f"Schedule {schedule.id} is daily but has no scheduled_time_utc")
                return False

            try:
                scheduled = datetime.strptime(schedule.scheduled_time_utc, "%H:%M").time()
                # Allow 2-min window
                return (
                    current_time.hour == scheduled.hour
                    and current_time.minute >= scheduled.minute
                    and current_time.minute < scheduled.minute + 2
                )
            except ValueError:
                logger.error(f"Invalid scheduled_time_utc: {schedule.scheduled_time_utc}")
                return False

        # Handle weekly
        if schedule.frequency == "weekly":
            if schedule.day_of_week is None:
                logger.warning(f"Schedule {schedule.id} is weekly but has no day_of_week")
                return False

            if current_day != schedule.day_of_week:
                return False

            if not schedule.scheduled_time_utc:
                logger.warning(f"Schedule {schedule.id} is weekly but has no scheduled_time_utc")
                return False

            try:
                scheduled = datetime.strptime(schedule.scheduled_time_utc, "%H:%M").time()
                return (
                    current_time.hour == scheduled.hour
                    and current_time.minute >= scheduled.minute
                    and current_time.minute < scheduled.minute + 2
                )
            except ValueError:
                logger.error(f"Invalid scheduled_time_utc: {schedule.scheduled_time_utc}")
                return False

        return False

    async def _execute_sync(self, db: Session, schedule: LoanExposureSyncSchedule):
        """Execute a single sync operation."""
        sync_id = str(schedule.id)
        start_time = datetime.utcnow()

        try:
            logger.info(f"🔄 Starting sync: {schedule.name} (source={schedule.sync_source})")

            # Step 1: Fetch data from source
            loan_data = await self._fetch_from_source(schedule)
            if not loan_data:
                error_msg = f"No data fetched from {schedule.sync_source}"
                logger.warning(f"⚠️  {error_msg}")
                duration = int((datetime.utcnow() - start_time).total_seconds())
                LoanSyncSchedulerService.log_sync_result(
                    db=db,
                    schedule_id=sync_id,
                    status="failed",
                    total_records=0,
                    created_count=0,
                    updated_count=0,
                    skipped_count=0,
                    error_message=error_msg,
                    duration_seconds=duration,
                )
                return

            total_records = len(loan_data)
            logger.info(f"📥 Fetched {total_records} records from {schedule.sync_source}")

            # Step 2: POST to Phase 8.2 CSV endpoint
            sync_result = await self._ingest_via_phase_8_2(schedule, loan_data)
            if not sync_result:
                error_msg = "Failed to ingest via Phase 8.2 endpoint"
                logger.error(f"❌ {error_msg}")
                duration = int((datetime.utcnow() - start_time).total_seconds())
                LoanSyncSchedulerService.log_sync_result(
                    db=db,
                    schedule_id=sync_id,
                    status="failed",
                    total_records=total_records,
                    created_count=0,
                    updated_count=0,
                    skipped_count=total_records,
                    error_message=error_msg,
                    duration_seconds=duration,
                )
                return

            created = sync_result.get("created_count", 0)
            updated = sync_result.get("updated_count", 0)
            skipped = sync_result.get("skipped_count", 0)

            logger.info(
                f"✅ Ingestion complete: created={created}, updated={updated}, skipped={skipped}"
            )

            # Step 3: Check for policy violations
            alerts = LoanSyncSchedulerService.check_policy_violations(db, sync_id)
            logger.info(f"🚨 Detected {len(alerts)} policy violations")

            # Step 4: Log result
            duration = int((datetime.utcnow() - start_time).total_seconds())
            status = "success" if skipped == 0 else "partial_success"

            LoanSyncSchedulerService.log_sync_result(
                db=db,
                schedule_id=sync_id,
                status=status,
                total_records=total_records,
                created_count=created,
                updated_count=updated,
                skipped_count=skipped,
                error_message=sync_result.get("error_message"),
                alerts=alerts,
                duration_seconds=duration,
            )

            # Step 5: Send alerts
            if alerts and schedule.alert_email_addresses:
                await self._send_alert_emails(
                    schedule.alert_email_addresses,
                    schedule.name,
                    alerts,
                )

            logger.info(
                f"✅ Sync complete: {schedule.name} "
                f"(created={created}, updated={updated}, duration={duration}s)"
            )

        except Exception as e:
            logger.error(f"❌ Sync failed: {e}", exc_info=True)
            duration = int((datetime.utcnow() - start_time).total_seconds())
            LoanSyncSchedulerService.log_sync_result(
                db=db,
                schedule_id=sync_id,
                status="failed",
                total_records=0,
                created_count=0,
                updated_count=0,
                skipped_count=0,
                error_message=str(e),
                duration_seconds=duration,
            )

    async def _fetch_from_source(
        self, schedule: LoanExposureSyncSchedule
    ) -> Optional[List[dict]]:
        """Fetch loan data from source (bank API, CBS, etc.)."""
        try:
            if schedule.sync_source == "BANK_API":
                return await self._fetch_from_bank_api(schedule)
            elif schedule.sync_source == "FINACLE_CBS":
                return await self._fetch_from_finacle_cbs(schedule)
            elif schedule.sync_source == "CSV_UPLOAD":
                return None  # CSV uploads handled separately
            else:
                logger.error(f"Unknown sync_source: {schedule.sync_source}")
                return None

        except Exception as e:
            logger.error(f"Failed to fetch from {schedule.sync_source}: {e}", exc_info=True)
            return None

    async def _fetch_from_bank_api(self, schedule: LoanExposureSyncSchedule) -> Optional[List[dict]]:
        """Fetch from bank REST API."""
        if not schedule.source_config:
            logger.error("source_config not set for BANK_API")
            return None

        webhook_url = schedule.source_config.get("webhook_url")
        if not webhook_url:
            logger.error("webhook_url not in source_config")
            return None

        try:
            logger.info(f"📡 Calling bank API: {webhook_url}")

            response = await self.http_client.get(webhook_url)
            response.raise_for_status()

            data = response.json()

            # Expect response format:
            # { "loan_accounts": [...] } or just [...]
            if isinstance(data, dict) and "loan_accounts" in data:
                return data["loan_accounts"]
            elif isinstance(data, list):
                return data
            else:
                logger.error(f"Unexpected response format from bank API: {type(data)}")
                return None

        except Exception as e:
            logger.error(f"Bank API call failed: {e}")
            return None

    async def _fetch_from_finacle_cbs(self, schedule: LoanExposureSyncSchedule) -> Optional[List[dict]]:
        """Fetch from Finacle CBS (placeholder for future integration)."""
        logger.warning("Finacle CBS integration not yet implemented")
        # TODO: Implement direct Finacle CBS integration
        return None

    async def _ingest_via_phase_8_2(
        self, schedule: LoanExposureSyncSchedule, loan_data: List[dict]
    ) -> Optional[dict]:
        """Post data to Phase 8.2 CSV ingestion endpoint."""
        try:
            # Format as Phase 8.2 request
            payload = {
                "sync_source": schedule.sync_source,
                "source_reference": f"{schedule.name}_{datetime.utcnow().isoformat()}",
                "loan_accounts": loan_data,
            }

            # Call Phase 8.2 endpoint
            url = "http://localhost:8000/api/v1/loan-accounts/exposure-sync"
            # In production, use proper service account token
            headers = {"Authorization": "Bearer SERVICE_ACCOUNT_TOKEN"}

            logger.info(f"📤 Posting to Phase 8.2 endpoint: {len(loan_data)} records")

            response = await self.http_client.post(url, json=payload, headers=headers)
            response.raise_for_status()

            result = response.json()
            data = result.get("data", {})

            return {
                "created_count": data.get("created_count", 0),
                "updated_count": data.get("updated_count", 0),
                "skipped_count": data.get("skipped_count", 0),
                "error_message": None if not data.get("errors") else "; ".join(data.get("errors", [])),
            }

        except Exception as e:
            logger.error(f"Failed to ingest via Phase 8.2: {e}")
            return None

    async def _send_alert_emails(
        self, email_addresses: str, schedule_name: str, alerts: List[LoanExposureSyncAlertResponse]
    ):
        """Send alert emails to stakeholders."""
        try:
            recipients = [e.strip() for e in email_addresses.split(",")]

            from backend.app.services.email_service import get_email_service

            email_service = get_email_service()
            await email_service.send_loan_sync_alerts(
                schedule_name=schedule_name,
                alerts=alerts,
                recipients=recipients,
            )

        except Exception as e:
            logger.error(f"Failed to send alert emails: {e}")
