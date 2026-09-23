"""Covenant compliance models (Phase 5 Task 1)."""

import logging
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from uuid import UUID

logger = logging.getLogger(__name__)


class CovenantStatus(str, Enum):
    """Covenant status."""
    ACTIVE = "active"
    BREACHED = "breached"
    WARNING = "warning"
    COMPLIANT = "compliant"
    EXPIRED = "expired"
    WAIVED = "waived"


class ComplianceCheckType(str, Enum):
    """Type of compliance check."""
    THRESHOLD = "threshold"
    DATE_BASED = "date_based"
    CUSTOM_RULE = "custom_rule"
    DOCUMENT_REQUIRED = "document_required"


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class Covenant:
    """Represents a project covenant."""

    def __init__(
        self,
        covenant_id: UUID,
        project_id: UUID,
        title: str,
        description: str,
        terms: Dict[str, Any],
        check_type: ComplianceCheckType,
        threshold: Optional[float] = None,
        due_date: Optional[datetime] = None,
        created_at: datetime = None,
    ):
        """Initialize covenant.

        Args:
            covenant_id: Unique covenant identifier
            project_id: Associated project
            title: Covenant name
            description: Detailed description
            terms: Covenant-specific terms/conditions
            check_type: How compliance is checked
            threshold: Numeric threshold (if applicable)
            due_date: Date covenant expires/renews
            created_at: Creation timestamp
        """
        self.covenant_id = covenant_id
        self.project_id = project_id
        self.title = title
        self.description = description
        self.terms = terms
        self.check_type = check_type
        self.threshold = threshold
        self.due_date = due_date
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            "covenant_id": str(self.covenant_id),
            "project_id": str(self.project_id),
            "title": self.title,
            "description": self.description,
            "terms": self.terms,
            "check_type": self.check_type.value,
            "threshold": self.threshold,
            "due_date": self.due_date.isoformat() + "Z" if self.due_date else None,
            "created_at": self.created_at.isoformat() + "Z",
            "updated_at": self.updated_at.isoformat() + "Z",
        }


class ComplianceCheck:
    """Record of a compliance check execution."""

    def __init__(
        self,
        check_id: UUID,
        covenant_id: UUID,
        project_id: UUID,
        check_type: ComplianceCheckType,
        is_compliant: bool,
        metric_value: Optional[float] = None,
        threshold: Optional[float] = None,
        notes: str = "",
        performed_by: Optional[UUID] = None,
        checked_at: datetime = None,
    ):
        """Initialize compliance check record.

        Args:
            check_id: Unique check identifier
            covenant_id: Associated covenant
            project_id: Associated project
            check_type: Type of check performed
            is_compliant: Whether compliance passed
            metric_value: Measured value
            threshold: Comparison threshold
            notes: Check details/findings
            performed_by: User who performed check
            checked_at: Check timestamp
        """
        self.check_id = check_id
        self.covenant_id = covenant_id
        self.project_id = project_id
        self.check_type = check_type
        self.is_compliant = is_compliant
        self.metric_value = metric_value
        self.threshold = threshold
        self.notes = notes
        self.performed_by = performed_by
        self.checked_at = checked_at or datetime.utcnow()

    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            "check_id": str(self.check_id),
            "covenant_id": str(self.covenant_id),
            "project_id": str(self.project_id),
            "check_type": self.check_type.value,
            "is_compliant": self.is_compliant,
            "metric_value": self.metric_value,
            "threshold": self.threshold,
            "notes": self.notes,
            "performed_by": str(self.performed_by) if self.performed_by else None,
            "checked_at": self.checked_at.isoformat() + "Z",
        }


class ComplianceAlert:
    """Compliance breach or warning alert."""

    def __init__(
        self,
        alert_id: UUID,
        covenant_id: UUID,
        project_id: UUID,
        severity: AlertSeverity,
        message: str,
        alert_type: str = "breach",
        data: Optional[Dict] = None,
        acknowledged: bool = False,
        acknowledged_by: Optional[UUID] = None,
        acknowledged_at: Optional[datetime] = None,
        created_at: datetime = None,
    ):
        """Initialize compliance alert.

        Args:
            alert_id: Unique alert identifier
            covenant_id: Associated covenant
            project_id: Associated project
            severity: Alert severity (critical, high, medium, low, info)
            message: Alert message
            alert_type: Type of alert (breach, warning, due_date, etc)
            data: Additional alert data
            acknowledged: Whether alert acknowledged
            acknowledged_by: User who acknowledged
            acknowledged_at: Acknowledgment timestamp
            created_at: Alert creation timestamp
        """
        self.alert_id = alert_id
        self.covenant_id = covenant_id
        self.project_id = project_id
        self.severity = severity
        self.message = message
        self.alert_type = alert_type
        self.data = data or {}
        self.acknowledged = acknowledged
        self.acknowledged_by = acknowledged_by
        self.acknowledged_at = acknowledged_at
        self.created_at = created_at or datetime.utcnow()

    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            "alert_id": str(self.alert_id),
            "covenant_id": str(self.covenant_id),
            "project_id": str(self.project_id),
            "severity": self.severity.value,
            "message": self.message,
            "alert_type": self.alert_type,
            "data": self.data,
            "acknowledged": self.acknowledged,
            "acknowledged_by": str(self.acknowledged_by) if self.acknowledged_by else None,
            "acknowledged_at": self.acknowledged_at.isoformat() + "Z" if self.acknowledged_at else None,
            "created_at": self.created_at.isoformat() + "Z",
        }


class AuditLogEntry:
    """Immutable audit log entry for covenant actions."""

    def __init__(
        self,
        log_id: UUID,
        covenant_id: UUID,
        project_id: UUID,
        action: str,
        actor_id: Optional[UUID] = None,
        actor_name: str = "system",
        details: Optional[Dict] = None,
        result: str = "success",
        timestamp: datetime = None,
    ):
        """Initialize audit log entry.

        Args:
            log_id: Unique log entry identifier
            covenant_id: Associated covenant
            project_id: Associated project
            action: Action performed (check, alert, remediate, review, etc)
            actor_id: User ID who performed action
            actor_name: User name/system name
            details: Action details
            result: Action result (success, failure, pending)
            timestamp: Action timestamp
        """
        self.log_id = log_id
        self.covenant_id = covenant_id
        self.project_id = project_id
        self.action = action
        self.actor_id = actor_id
        self.actor_name = actor_name
        self.details = details or {}
        self.result = result
        self.timestamp = timestamp or datetime.utcnow()

    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            "log_id": str(self.log_id),
            "covenant_id": str(self.covenant_id),
            "project_id": str(self.project_id),
            "action": self.action,
            "actor_id": str(self.actor_id) if self.actor_id else None,
            "actor_name": self.actor_name,
            "details": self.details,
            "result": self.result,
            "timestamp": self.timestamp.isoformat() + "Z",
        }
