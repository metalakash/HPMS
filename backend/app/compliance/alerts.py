"""Alert management for compliance (Phase 5 Task 1)."""

import logging
from typing import Dict, List, Optional
from uuid import UUID
from datetime import datetime

from .models import ComplianceAlert, AlertSeverity

logger = logging.getLogger(__name__)


class AlertManager:
    """Manage compliance alerts and notifications."""

    def __init__(self):
        """Initialize alert manager."""
        self.alerts: Dict[UUID, ComplianceAlert] = {}
        self.subscribers: Dict[str, List[callable]] = {
            "critical": [],
            "high": [],
            "medium": [],
            "low": [],
            "info": [],
        }

    def add_alert(self, alert: ComplianceAlert) -> ComplianceAlert:
        """Add alert to system.

        Args:
            alert: Alert to add

        Returns:
            Added alert
        """
        try:
            self.alerts[alert.alert_id] = alert

            # Trigger subscribers
            self._notify_subscribers(alert)

            logger.info(f"Alert added: {alert.alert_id} ({alert.severity.value})")
            return alert

        except Exception as e:
            logger.error(f"Error adding alert: {e}")
            raise

    def get_active_alerts(self, project_id: UUID) -> List[ComplianceAlert]:
        """Get unacknowledged alerts for project.

        Args:
            project_id: Project to get alerts for

        Returns:
            List of active alerts
        """
        return [
            a for a in self.alerts.values()
            if a.project_id == project_id and not a.acknowledged
        ]

    def get_alerts_by_severity(
        self, project_id: UUID, severity: AlertSeverity
    ) -> List[ComplianceAlert]:
        """Get alerts filtered by severity.

        Args:
            project_id: Project to filter
            severity: Severity level

        Returns:
            List of alerts matching severity
        """
        return [
            a for a in self.alerts.values()
            if a.project_id == project_id and a.severity == severity
        ]

    def acknowledge_alert(
        self, alert_id: UUID, acknowledged_by: UUID
    ) -> Optional[ComplianceAlert]:
        """Acknowledge alert.

        Args:
            alert_id: Alert to acknowledge
            acknowledged_by: User ID

        Returns:
            Updated alert or None
        """
        try:
            if alert_id not in self.alerts:
                logger.warning(f"Alert not found: {alert_id}")
                return None

            alert = self.alerts[alert_id]
            alert.acknowledged = True
            alert.acknowledged_by = acknowledged_by
            alert.acknowledged_at = datetime.utcnow()

            logger.info(f"Alert acknowledged: {alert_id}")
            return alert

        except Exception as e:
            logger.error(f"Error acknowledging alert: {e}")
            return None

    def subscribe(self, severity: str, callback: callable) -> None:
        """Subscribe to alerts of specific severity.

        Args:
            severity: Severity level to watch
            callback: Function to call when alert triggered
        """
        if severity in self.subscribers:
            self.subscribers[severity].append(callback)
            logger.info(f"Subscriber registered for severity: {severity}")

    def _notify_subscribers(self, alert: ComplianceAlert) -> None:
        """Notify subscribers of new alert.

        Args:
            alert: Alert that was created
        """
        severity = alert.severity.value

        if severity in self.subscribers:
            for callback in self.subscribers[severity]:
                try:
                    callback(alert)
                except Exception as e:
                    logger.error(f"Error in alert subscriber callback: {e}")
