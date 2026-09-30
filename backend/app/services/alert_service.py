"""Alert and remediation service for license/PPA/insurance expiry."""
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import List, Dict, Any
import logging

from backend.app.models.operations import PPAAgreement, WaterLicense
from backend.app.models.financial import LoanAccount

logger = logging.getLogger(__name__)


class AlertService:
    """Service for detecting and managing expiry alerts."""

    # Expiry thresholds (in days)
    CRITICAL_THRESHOLD = 30  # Red alert: expiring within 30 days
    WARNING_THRESHOLD = 90   # Yellow alert: expiring within 90 days

    @staticmethod
    async def get_expiry_alerts(
        db: AsyncSession,
        project_id: str,
    ) -> Dict[str, Any]:
        """Get all expiry alerts for a project.

        Args:
            db: Database session
            project_id: Project ID

        Returns:
            Dict with grouped alerts (critical, warning, ok) and action buttons
        """
        try:
            alerts = []
            today = datetime.utcnow().date()

            # Check PPA expiry
            ppa_alerts = await AlertService._check_ppa_expiry(db, project_id, today)
            alerts.extend(ppa_alerts)

            # Check water license expiry
            license_alerts = await AlertService._check_water_license_expiry(db, project_id, today)
            alerts.extend(license_alerts)

            # Check insurance (from loan accounts - if expiry_date field exists)
            # TODO: Implement when insurance data model is available

            # Group by urgency
            critical = [a for a in alerts if a["urgency"] == "critical"]
            warning = [a for a in alerts if a["urgency"] == "warning"]
            ok = [a for a in alerts if a["urgency"] == "ok"]

            # Sort by days remaining (ascending)
            for group in [critical, warning, ok]:
                group.sort(key=lambda x: x["days_remaining"])

            return {
                "project_id": project_id,
                "alert_date": today.isoformat(),
                "total_alerts": len(alerts),
                "critical_count": len(critical),
                "warning_count": len(warning),
                "ok_count": len(ok),
                "alerts": {
                    "critical": critical,
                    "warning": warning,
                    "ok": ok,
                },
            }

        except Exception as e:
            logger.error(f"Error fetching expiry alerts: {e}")
            raise

    @staticmethod
    async def initiate_renewal_workflow(
        db: AsyncSession,
        alert_id: str,
        action_type: str,
        remarks: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """Initiate renewal workflow for an alert.

        Args:
            db: Database session
            alert_id: Alert ID (encoded as 'entity_type:entity_id')
            action_type: RENEWAL, ESCALATE, NOTIFY, etc.
            remarks: User remarks/comments
            user_id: Current user ID

        Returns:
            Dict with workflow task details and next steps
        """
        try:
            # Parse alert_id (e.g., "PPA:abc-123" or "LICENSE:xyz-456")
            entity_type, entity_id = alert_id.split(":")

            # Create workflow task (audit logged)
            workflow_task = {
                "task_id": f"renewal_{entity_type}_{entity_id}",
                "entity_type": entity_type,
                "entity_id": entity_id,
                "action": action_type,
                "status": "initiated",
                "created_by": user_id,
                "remarks": remarks,
                "created_at": datetime.utcnow().isoformat(),
            }

            # TODO: Persist workflow_task to database (via WorkflowService)

            return {
                "task_id": workflow_task["task_id"],
                "status": "initiated",
                "message": f"{action_type} workflow initiated for {entity_type}",
                "next_steps": AlertService._get_renewal_next_steps(entity_type, action_type),
            }

        except Exception as e:
            logger.error(f"Error initiating renewal workflow: {e}")
            raise

    @staticmethod
    async def _check_ppa_expiry(
        db: AsyncSession,
        project_id: str,
        today: datetime.date,
    ) -> List[Dict[str, Any]]:
        """Check for PPA expiry alerts."""
        stmt = (
            select(PPAAgreement)
            .where(PPAAgreement.project_id == project_id)
            .where(PPAAgreement.status.in_(["active", "renewed"]))
        )
        result = await db.execute(stmt)
        agreements = result.scalars().all()

        alerts = []
        for ppa in agreements:
            if not ppa.expiry_date_ad:
                continue

            days_remaining = (ppa.expiry_date_ad - today).days

            urgency = AlertService._get_urgency(days_remaining)

            if days_remaining <= AlertService.WARNING_THRESHOLD:
                alerts.append({
                    "alert_id": f"PPA:{ppa.id}",
                    "entity_type": "PPA",
                    "entity_id": str(ppa.id),
                    "description": f"PPA Agreement {ppa.agreement_number} expiring",
                    "expiry_date": ppa.expiry_date_ad.isoformat(),
                    "days_remaining": days_remaining,
                    "urgency": urgency,
                    "purchaser": ppa.purchaser,
                    "action_available": [
                        {"type": "RENEWAL", "label": "Initiate Renewal"},
                        {"type": "ESCALATE", "label": "Escalate to Legal"},
                    ],
                })

        return alerts

    @staticmethod
    async def _check_water_license_expiry(
        db: AsyncSession,
        project_id: str,
        today: datetime.date,
    ) -> List[Dict[str, Any]]:
        """Check for water license expiry alerts."""
        stmt = (
            select(WaterLicense)
            .where(WaterLicense.project_id == project_id)
            .where(WaterLicense.status != "expired")
        )
        result = await db.execute(stmt)
        licenses = result.scalars().all()

        alerts = []
        for license in licenses:
            if not license.validity_to_ad:
                continue

            days_remaining = (license.validity_to_ad - today).days

            urgency = AlertService._get_urgency(days_remaining)

            if days_remaining <= AlertService.WARNING_THRESHOLD:
                alerts.append({
                    "alert_id": f"LICENSE:{license.id}",
                    "entity_type": "WATER_LICENSE",
                    "entity_id": str(license.id),
                    "description": f"Water License {license.license_number} expiring",
                    "expiry_date": license.validity_to_ad.isoformat(),
                    "days_remaining": days_remaining,
                    "urgency": urgency,
                    "authority": license.issuing_authority,
                    "action_available": [
                        {"type": "RENEWAL", "label": "Initiate Renewal"},
                        {"type": "ESCALATE", "label": "Escalate to DoHAG"},
                    ],
                })

        return alerts

    @staticmethod
    def _get_urgency(days_remaining: int) -> str:
        """Determine urgency based on days remaining."""
        if days_remaining < 0:
            return "expired"
        elif days_remaining <= AlertService.CRITICAL_THRESHOLD:
            return "critical"
        elif days_remaining <= AlertService.WARNING_THRESHOLD:
            return "warning"
        else:
            return "ok"

    @staticmethod
    def _get_renewal_next_steps(entity_type: str, action_type: str) -> List[str]:
        """Get renewal workflow next steps."""
        steps = {
            "RENEWAL": [
                "Prepare renewal application",
                "Gather required documents",
                "Submit to relevant authority",
                "Track approval status",
            ],
            "ESCALATE": [
                "Notify legal team",
                "Prepare escalation note",
                "Schedule meeting with authority",
            ],
            "NOTIFY": [
                "Send notification to relevant parties",
                "Document response",
                "Follow up if needed",
            ],
        }
        return steps.get(action_type, [])
