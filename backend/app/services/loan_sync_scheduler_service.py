"""Loan exposure sync scheduler service (Phase 8.3 Option B)."""

import logging
import uuid
from datetime import datetime, time
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.financial import (
    LoanExposureSyncSchedule,
    LoanExposureSyncHistory,
    LoanAccount,
)
from backend.app.models.project import Project
from backend.app.schemas.loan import (
    LoanExposureSyncScheduleRequest,
    LoanExposureSyncScheduleResponse,
    LoanExposureSyncAlertResponse,
)

logger = logging.getLogger(__name__)


class LoanSyncSchedulerService:
    """Service for managing automatic loan exposure sync schedules."""

    @staticmethod
    def create_schedule(
        db: Session,
        request: LoanExposureSyncScheduleRequest,
        user_id: str,
    ) -> LoanExposureSyncScheduleResponse:
        """Create a new sync schedule."""

        schedule = LoanExposureSyncSchedule(
            id=uuid.uuid4(),
            name=request.name,
            description=request.description,
            frequency=request.frequency,
            scheduled_time_utc=request.scheduled_time_utc,
            day_of_week=request.day_of_week,
            sync_source=request.sync_source,
            source_config=request.source_config,
            alert_on_dscr_below=request.alert_on_dscr_below,
            alert_on_ltv_above=request.alert_on_ltv_above,
            alert_on_concentration_above=request.alert_on_concentration_above,
            alert_email_addresses=request.alert_email_addresses,
            is_active="Y",
            created_by=user_id,
            updated_by=user_id,
        )

        db.add(schedule)
        db.commit()

        logger.info(f"✅ Created sync schedule: {schedule.id} ({schedule.name})")

        return LoanSyncSchedulerService._to_response(schedule)

    @staticmethod
    def get_schedule(db: Session, schedule_id: str) -> Optional[LoanExposureSyncScheduleResponse]:
        """Get a sync schedule by ID."""

        try:
            sid = uuid.UUID(schedule_id)
        except ValueError:
            return None

        result = db.execute(
            select(LoanExposureSyncSchedule).where(LoanExposureSyncSchedule.id == sid)
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            return None

        return LoanSyncSchedulerService._to_response(schedule)

    @staticmethod
    def list_schedules(
        db: Session,
        is_active: Optional[str] = None,
        sync_source: Optional[str] = None,
    ) -> List[LoanExposureSyncScheduleResponse]:
        """List all sync schedules with optional filters."""

        query = select(LoanExposureSyncSchedule)

        if is_active is not None:
            query = query.where(LoanExposureSyncSchedule.is_active == is_active)

        if sync_source:
            query = query.where(LoanExposureSyncSchedule.sync_source == sync_source)

        result = db.execute(query.order_by(LoanExposureSyncSchedule.created_at.desc()))
        schedules = result.scalars().all()

        return [LoanSyncSchedulerService._to_response(s) for s in schedules]

    @staticmethod
    def update_schedule(
        db: Session,
        schedule_id: str,
        request: LoanExposureSyncScheduleRequest,
        user_id: str,
    ) -> Optional[LoanExposureSyncScheduleResponse]:
        """Update an existing sync schedule."""

        try:
            sid = uuid.UUID(schedule_id)
        except ValueError:
            return None

        result = db.execute(
            select(LoanExposureSyncSchedule).where(LoanExposureSyncSchedule.id == sid)
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            return None

        schedule.name = request.name
        schedule.description = request.description
        schedule.frequency = request.frequency
        schedule.scheduled_time_utc = request.scheduled_time_utc
        schedule.day_of_week = request.day_of_week
        schedule.sync_source = request.sync_source
        schedule.source_config = request.source_config
        schedule.alert_on_dscr_below = request.alert_on_dscr_below
        schedule.alert_on_ltv_above = request.alert_on_ltv_above
        schedule.alert_on_concentration_above = request.alert_on_concentration_above
        schedule.alert_email_addresses = request.alert_email_addresses
        schedule.updated_by = user_id

        db.add(schedule)
        db.commit()

        logger.info(f"✅ Updated sync schedule: {schedule.id}")

        return LoanSyncSchedulerService._to_response(schedule)

    @staticmethod
    def toggle_schedule(
        db: Session,
        schedule_id: str,
        is_active: str,
        user_id: str,
    ) -> Optional[LoanExposureSyncScheduleResponse]:
        """Enable/disable a sync schedule."""

        try:
            sid = uuid.UUID(schedule_id)
        except ValueError:
            return None

        result = db.execute(
            select(LoanExposureSyncSchedule).where(LoanExposureSyncSchedule.id == sid)
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            return None

        schedule.is_active = is_active
        schedule.updated_by = user_id

        db.add(schedule)
        db.commit()

        logger.info(f"✅ Toggled sync schedule: {schedule.id} (active={is_active})")

        return LoanSyncSchedulerService._to_response(schedule)

    @staticmethod
    def log_sync_result(
        db: Session,
        schedule_id: str,
        status: str,
        total_records: int,
        created_count: int,
        updated_count: int,
        skipped_count: int,
        error_message: Optional[str] = None,
        alerts: Optional[List[LoanExposureSyncAlertResponse]] = None,
        duration_seconds: Optional[int] = None,
    ) -> str:
        """Log the result of a sync operation to history."""

        try:
            sid = uuid.UUID(schedule_id)
        except ValueError:
            return ""

        # Update schedule's last sync info
        result = db.execute(
            select(LoanExposureSyncSchedule).where(LoanExposureSyncSchedule.id == sid)
        )
        schedule = result.scalar_one_or_none()

        if schedule:
            schedule.last_sync_at = datetime.utcnow().isoformat()
            schedule.last_sync_status = status
            schedule.last_sync_record_count = created_count + updated_count
            schedule.last_sync_error = error_message
            db.add(schedule)

        # Create history entry
        history = LoanExposureSyncHistory(
            id=uuid.uuid4(),
            schedule_id=sid,
            sync_source=schedule.sync_source if schedule else "UNKNOWN",
            status=status,
            total_records=total_records,
            created_count=created_count,
            updated_count=updated_count,
            skipped_count=skipped_count,
            error_message=error_message,
            alerts_triggered=[a.dict() for a in alerts] if alerts else [],
            started_at=None,  # Would be set by caller
            completed_at=datetime.utcnow().isoformat(),
            duration_seconds=duration_seconds,
        )

        db.add(history)
        db.commit()

        logger.info(f"📋 Logged sync result: {history.id} (status={status})")

        return str(history.id)

    @staticmethod
    def check_policy_violations(
        db: Session,
        schedule_id: str,
    ) -> List[LoanExposureSyncAlertResponse]:
        """Check for policy violations after a sync (DSCR, LTV, concentration)."""

        try:
            sid = uuid.UUID(schedule_id)
        except ValueError:
            return []

        result = db.execute(
            select(LoanExposureSyncSchedule).where(LoanExposureSyncSchedule.id == sid)
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            return []

        alerts = []

        # Check DSCR violations
        if schedule.alert_on_dscr_below:
            loans_dscr = db.execute(
                select(LoanAccount, Project.project_code).join(Project).where(
                    LoanAccount.dscr < schedule.alert_on_dscr_below
                )
            ).all()

            for loan, project_code in loans_dscr:
                alert = LoanExposureSyncAlertResponse(
                    alert_type="dscr_violation",
                    severity="high" if loan.dscr < Decimal("1.0") else "medium",
                    project_id=str(loan.project_id),
                    project_code=project_code,
                    current_value=loan.dscr or Decimal("0"),
                    threshold_value=schedule.alert_on_dscr_below,
                    message=f"Project {project_code}: DSCR {loan.dscr} below threshold {schedule.alert_on_dscr_below}",
                    timestamp=datetime.utcnow().isoformat(),
                )
                alerts.append(alert)

        # Check LTV violations
        if schedule.alert_on_ltv_above:
            loans_ltv = db.execute(
                select(LoanAccount, Project.project_code).join(Project).where(
                    LoanAccount.ltv > schedule.alert_on_ltv_above
                )
            ).all()

            for loan, project_code in loans_ltv:
                alert = LoanExposureSyncAlertResponse(
                    alert_type="ltv_violation",
                    severity="medium",
                    project_id=str(loan.project_id),
                    project_code=project_code,
                    current_value=loan.ltv or Decimal("0"),
                    threshold_value=schedule.alert_on_ltv_above,
                    message=f"Project {project_code}: LTV {loan.ltv}% above threshold {schedule.alert_on_ltv_above}%",
                    timestamp=datetime.utcnow().isoformat(),
                )
                alerts.append(alert)

        # Check concentration violations (% of total exposure to single developer)
        if schedule.alert_on_concentration_above:
            # This would require developer tracking; simplified here
            pass

        return alerts

    @staticmethod
    def _to_response(schedule: LoanExposureSyncSchedule) -> LoanExposureSyncScheduleResponse:
        """Convert model to response schema."""

        return LoanExposureSyncScheduleResponse(
            id=str(schedule.id),
            name=schedule.name,
            description=schedule.description,
            frequency=schedule.frequency,
            scheduled_time_utc=schedule.scheduled_time_utc,
            day_of_week=schedule.day_of_week,
            sync_source=schedule.sync_source,
            source_config=schedule.source_config,
            is_active=schedule.is_active,
            last_sync_at=schedule.last_sync_at,
            last_sync_status=schedule.last_sync_status,
            last_sync_record_count=schedule.last_sync_record_count or 0,
            last_sync_error=schedule.last_sync_error,
            alert_on_dscr_below=schedule.alert_on_dscr_below,
            alert_on_ltv_above=schedule.alert_on_ltv_above,
            alert_on_concentration_above=schedule.alert_on_concentration_above,
            alert_email_addresses=schedule.alert_email_addresses,
            created_at=schedule.created_at.isoformat() if schedule.created_at else None,
            updated_at=schedule.updated_at.isoformat() if schedule.updated_at else None,
        )
