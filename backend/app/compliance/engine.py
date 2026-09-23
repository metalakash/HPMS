"""Compliance evaluation engine (Phase 5 Task 1)."""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from .models import (
    Covenant,
    ComplianceCheck,
    ComplianceCheckType,
    ComplianceAlert,
    AlertSeverity,
    AuditLogEntry,
    CovenantStatus,
)

logger = logging.getLogger(__name__)


class ComplianceEngine:
    """Evaluate covenant compliance and generate alerts."""

    def __init__(self):
        """Initialize compliance engine."""
        # In-memory storage (production: use database)
        self.covenants: Dict[UUID, Covenant] = {}
        self.checks: Dict[UUID, ComplianceCheck] = {}
        self.alerts: Dict[UUID, ComplianceAlert] = {}
        self.audit_logs: Dict[UUID, AuditLogEntry] = {}

    def register_covenant(
        self,
        project_id: UUID,
        title: str,
        description: str,
        terms: Dict,
        check_type: ComplianceCheckType,
        threshold: Optional[float] = None,
        due_date: Optional[datetime] = None,
    ) -> Covenant:
        """Register new covenant for project.

        Args:
            project_id: Project to register covenant for
            title: Covenant title
            description: Covenant description
            terms: Covenant terms/conditions
            check_type: Type of compliance check
            threshold: Numeric threshold (if applicable)
            due_date: Covenant expiration/renewal date

        Returns:
            Covenant object
        """
        try:
            covenant_id = uuid4()
            covenant = Covenant(
                covenant_id=covenant_id,
                project_id=project_id,
                title=title,
                description=description,
                terms=terms,
                check_type=check_type,
                threshold=threshold,
                due_date=due_date,
            )

            self.covenants[covenant_id] = covenant

            # Log action
            self._log_action(
                covenant_id,
                project_id,
                "register",
                details={"title": title},
            )

            logger.info(f"Registered covenant: {covenant_id} for project {project_id}")
            return covenant

        except Exception as e:
            logger.error(f"Error registering covenant: {e}")
            raise

    def perform_check(
        self,
        covenant_id: UUID,
        project_id: UUID,
        metric_value: Optional[float] = None,
        notes: str = "",
        performed_by: Optional[UUID] = None,
    ) -> Tuple[ComplianceCheck, Optional[ComplianceAlert]]:
        """Perform compliance check for covenant.

        Args:
            covenant_id: Covenant to check
            project_id: Associated project
            metric_value: Measured value (if threshold check)
            notes: Check notes/findings
            performed_by: User performing check

        Returns:
            Tuple of (ComplianceCheck, optional ComplianceAlert if breach)
        """
        try:
            if covenant_id not in self.covenants:
                logger.warning(f"Covenant not found: {covenant_id}")
                return None, None

            covenant = self.covenants[covenant_id]

            # Evaluate compliance
            is_compliant, alert = self._evaluate_covenant(
                covenant, metric_value, notes
            )

            # Record check
            check_id = uuid4()
            check = ComplianceCheck(
                check_id=check_id,
                covenant_id=covenant_id,
                project_id=project_id,
                check_type=covenant.check_type,
                is_compliant=is_compliant,
                metric_value=metric_value,
                threshold=covenant.threshold,
                notes=notes,
                performed_by=performed_by,
            )

            self.checks[check_id] = check

            # Store alert if breach
            if alert:
                self.alerts[alert.alert_id] = alert

            # Log action
            self._log_action(
                covenant_id,
                project_id,
                "check",
                actor_id=performed_by,
                details={
                    "metric_value": metric_value,
                    "is_compliant": is_compliant,
                },
                result="success" if is_compliant else "breach",
            )

            logger.info(
                f"Compliance check: {covenant_id} - {'COMPLIANT' if is_compliant else 'BREACH'}"
            )
            return check, alert

        except Exception as e:
            logger.error(f"Error performing compliance check: {e}")
            raise

    def _evaluate_covenant(
        self,
        covenant: Covenant,
        metric_value: Optional[float] = None,
        notes: str = "",
    ) -> Tuple[bool, Optional[ComplianceAlert]]:
        """Evaluate if covenant is in compliance.

        Args:
            covenant: Covenant to evaluate
            metric_value: Measured value
            notes: Check notes

        Returns:
            Tuple of (is_compliant, optional alert)
        """
        is_compliant = True
        alert = None

        if covenant.check_type == ComplianceCheckType.THRESHOLD:
            # Threshold-based check
            if metric_value is not None and covenant.threshold is not None:
                is_compliant = metric_value >= covenant.threshold

                if not is_compliant:
                    alert = ComplianceAlert(
                        alert_id=uuid4(),
                        covenant_id=covenant.covenant_id,
                        project_id=covenant.project_id,
                        severity=AlertSeverity.CRITICAL,
                        message=f"Covenant breach: {covenant.title} (threshold: {covenant.threshold}, actual: {metric_value})",
                        alert_type="breach",
                        data={
                            "covenant_title": covenant.title,
                            "threshold": covenant.threshold,
                            "metric_value": metric_value,
                            "variance": covenant.threshold - metric_value,
                        },
                    )

        elif covenant.check_type == ComplianceCheckType.DATE_BASED:
            # Date-based check (due date, renewal, etc)
            if covenant.due_date:
                days_until = (covenant.due_date - datetime.utcnow()).days

                if days_until < 0:
                    is_compliant = False
                    alert = ComplianceAlert(
                        alert_id=uuid4(),
                        covenant_id=covenant.covenant_id,
                        project_id=covenant.project_id,
                        severity=AlertSeverity.CRITICAL,
                        message=f"Covenant expired: {covenant.title} (expired {abs(days_until)} days ago)",
                        alert_type="expired",
                        data={
                            "covenant_title": covenant.title,
                            "due_date": covenant.due_date.isoformat(),
                            "days_overdue": abs(days_until),
                        },
                    )
                elif days_until < 30:
                    alert = ComplianceAlert(
                        alert_id=uuid4(),
                        covenant_id=covenant.covenant_id,
                        project_id=covenant.project_id,
                        severity=AlertSeverity.HIGH,
                        message=f"Covenant renewal due soon: {covenant.title} ({days_until} days)",
                        alert_type="due_date",
                        data={
                            "covenant_title": covenant.title,
                            "due_date": covenant.due_date.isoformat(),
                            "days_until": days_until,
                        },
                    )

        return is_compliant, alert

    def get_compliance_status(
        self, project_id: UUID
    ) -> Dict:
        """Get compliance status for project.

        Args:
            project_id: Project to check

        Returns:
            Compliance status dictionary
        """
        try:
            covenants = [
                c for c in self.covenants.values() if c.project_id == project_id
            ]
            checks = [c for c in self.checks.values() if c.project_id == project_id]
            alerts = [a for a in self.alerts.values() if a.project_id == project_id]

            # Count by status
            compliant_count = sum(
                1
                for c in checks
                if c.is_compliant
            )
            breach_count = sum(
                1
                for c in checks
                if not c.is_compliant
            )
            unacknowledged_alerts = sum(
                1
                for a in alerts
                if not a.acknowledged
            )

            return {
                "project_id": str(project_id),
                "total_covenants": len(covenants),
                "total_checks": len(checks),
                "compliant_checks": compliant_count,
                "breach_checks": breach_count,
                "compliance_rate": (
                    compliant_count / len(checks) * 100 if checks else 0
                ),
                "total_alerts": len(alerts),
                "unacknowledged_alerts": unacknowledged_alerts,
                "alerts_by_severity": self._count_alerts_by_severity(
                    project_id
                ),
            }

        except Exception as e:
            logger.error(f"Error getting compliance status: {e}")
            return {}

    def _count_alerts_by_severity(self, project_id: UUID) -> Dict:
        """Count alerts by severity level."""
        alerts = [a for a in self.alerts.values() if a.project_id == project_id]
        counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
        }

        for alert in alerts:
            counts[alert.severity.value] += 1

        return counts

    def acknowledge_alert(
        self, alert_id: UUID, acknowledged_by: UUID
    ) -> Optional[ComplianceAlert]:
        """Acknowledge a compliance alert.

        Args:
            alert_id: Alert to acknowledge
            acknowledged_by: User acknowledging

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

            # Log action
            self._log_action(
                alert.covenant_id,
                alert.project_id,
                "acknowledge_alert",
                actor_id=acknowledged_by,
                details={"alert_id": str(alert_id)},
            )

            logger.info(f"Alert acknowledged: {alert_id}")
            return alert

        except Exception as e:
            logger.error(f"Error acknowledging alert: {e}")
            return None

    def get_audit_trail(
        self, covenant_id: UUID, limit: int = 100
    ) -> List[AuditLogEntry]:
        """Get audit trail for covenant.

        Args:
            covenant_id: Covenant to get audit trail for
            limit: Maximum entries to return

        Returns:
            List of audit log entries
        """
        try:
            logs = [
                l for l in self.audit_logs.values()
                if l.covenant_id == covenant_id
            ]
            # Sort by timestamp, newest first
            logs = sorted(logs, key=lambda x: x.timestamp, reverse=True)
            return logs[:limit]

        except Exception as e:
            logger.error(f"Error getting audit trail: {e}")
            return []

    def _log_action(
        self,
        covenant_id: UUID,
        project_id: UUID,
        action: str,
        actor_id: Optional[UUID] = None,
        actor_name: str = "system",
        details: Optional[Dict] = None,
        result: str = "success",
    ) -> AuditLogEntry:
        """Log action to audit trail.

        Args:
            covenant_id: Associated covenant
            project_id: Associated project
            action: Action performed
            actor_id: User ID performing action
            actor_name: User/system name
            details: Action details
            result: Action result

        Returns:
            Created audit log entry
        """
        try:
            log_id = uuid4()
            log_entry = AuditLogEntry(
                log_id=log_id,
                covenant_id=covenant_id,
                project_id=project_id,
                action=action,
                actor_id=actor_id,
                actor_name=actor_name,
                details=details or {},
                result=result,
            )

            self.audit_logs[log_id] = log_entry
            return log_entry

        except Exception as e:
            logger.error(f"Error logging action: {e}")
            return None
