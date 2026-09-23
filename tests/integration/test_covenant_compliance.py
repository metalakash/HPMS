"""Integration tests for covenant compliance engine (Phase 5 Task 1)."""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4, UUID

from backend.app.compliance.models import (
    Covenant,
    ComplianceCheck,
    ComplianceCheckType,
    ComplianceAlert,
    AlertSeverity,
    AuditLogEntry,
    CovenantStatus,
)
from backend.app.compliance.engine import ComplianceEngine
from backend.app.compliance.alerts import AlertManager
from backend.app.compliance.audit import AuditLogger


class TestCovenantModel:
    """Test Covenant data model."""

    def test_covenant_creation(self):
        """Test creating a covenant."""
        covenant_id = uuid4()
        project_id = uuid4()

        covenant = Covenant(
            covenant_id=covenant_id,
            project_id=project_id,
            title="Minimum Flow Requirement",
            description="Must maintain 50 cubic meters per second downstream flow",
            terms={"min_flow_cms": 50, "measurement_frequency": "daily"},
            check_type=ComplianceCheckType.THRESHOLD,
            threshold=50.0,
            due_date=datetime.utcnow() + timedelta(days=365),
        )

        assert covenant.covenant_id == covenant_id
        assert covenant.project_id == project_id
        assert covenant.title == "Minimum Flow Requirement"
        assert covenant.threshold == 50.0

    def test_covenant_to_dict(self):
        """Test converting covenant to dictionary."""
        covenant_id = uuid4()
        project_id = uuid4()

        covenant = Covenant(
            covenant_id=covenant_id,
            project_id=project_id,
            title="Test Covenant",
            description="Test",
            terms={"key": "value"},
            check_type=ComplianceCheckType.THRESHOLD,
            threshold=100.0,
        )

        covenant_dict = covenant.to_dict()

        assert covenant_dict["title"] == "Test Covenant"
        assert covenant_dict["threshold"] == 100.0
        assert "created_at" in covenant_dict


class TestComplianceEngine:
    """Test compliance evaluation engine."""

    def test_engine_initialization(self):
        """Test engine initialization."""
        engine = ComplianceEngine()

        assert len(engine.covenants) == 0
        assert len(engine.checks) == 0
        assert len(engine.alerts) == 0

    def test_register_covenant(self):
        """Test registering a covenant."""
        engine = ComplianceEngine()
        project_id = uuid4()

        covenant = engine.register_covenant(
            project_id=project_id,
            title="Environmental Flow",
            description="Minimum environmental flow requirements",
            terms={"min_flow": 25},
            check_type=ComplianceCheckType.THRESHOLD,
            threshold=25.0,
        )

        assert covenant is not None
        assert covenant.title == "Environmental Flow"
        assert covenant.project_id == project_id
        assert covenant.covenant_id in engine.covenants

    def test_perform_check_compliant(self):
        """Test performing a compliant check."""
        engine = ComplianceEngine()
        project_id = uuid4()

        covenant = engine.register_covenant(
            project_id=project_id,
            title="Flow Requirement",
            description="Test",
            terms={"min_flow": 50},
            check_type=ComplianceCheckType.THRESHOLD,
            threshold=50.0,
        )

        # Perform check with value >= threshold
        check, alert = engine.perform_check(
            covenant_id=covenant.covenant_id,
            project_id=project_id,
            metric_value=55.0,
            notes="Regular monitoring",
        )

        assert check is not None
        assert check.is_compliant is True
        assert alert is None  # No alert when compliant

    def test_perform_check_breach(self):
        """Test performing a check that breaches covenant."""
        engine = ComplianceEngine()
        project_id = uuid4()

        covenant = engine.register_covenant(
            project_id=project_id,
            title="Flow Requirement",
            description="Test",
            terms={"min_flow": 50},
            check_type=ComplianceCheckType.THRESHOLD,
            threshold=50.0,
        )

        # Perform check with value < threshold
        check, alert = engine.perform_check(
            covenant_id=covenant.covenant_id,
            project_id=project_id,
            metric_value=40.0,
            notes="Low flow detected",
        )

        assert check is not None
        assert check.is_compliant is False
        assert alert is not None
        assert alert.severity == AlertSeverity.CRITICAL
        assert "breach" in alert.message.lower()

    def test_date_based_covenant_not_expired(self):
        """Test date-based covenant that is not expired."""
        engine = ComplianceEngine()
        project_id = uuid4()

        due_date = datetime.utcnow() + timedelta(days=30)
        covenant = engine.register_covenant(
            project_id=project_id,
            title="Permit Renewal",
            description="Environmental permit renewal",
            terms={"permit_type": "environmental"},
            check_type=ComplianceCheckType.DATE_BASED,
            due_date=due_date,
        )

        check, alert = engine.perform_check(
            covenant_id=covenant.covenant_id,
            project_id=project_id,
        )

        # Should have warning alert (within 30 days)
        assert alert is not None
        assert alert.severity == AlertSeverity.HIGH
        assert "renewal" in alert.message.lower()

    def test_date_based_covenant_expired(self):
        """Test date-based covenant that is expired."""
        engine = ComplianceEngine()
        project_id = uuid4()

        due_date = datetime.utcnow() - timedelta(days=5)
        covenant = engine.register_covenant(
            project_id=project_id,
            title="Permit Renewal",
            description="Environmental permit renewal",
            terms={"permit_type": "environmental"},
            check_type=ComplianceCheckType.DATE_BASED,
            due_date=due_date,
        )

        check, alert = engine.perform_check(
            covenant_id=covenant.covenant_id,
            project_id=project_id,
        )

        assert alert is not None
        assert alert.severity == AlertSeverity.CRITICAL
        assert "expired" in alert.message.lower()
        assert check.is_compliant is False

    def test_get_compliance_status(self):
        """Test getting project compliance status."""
        engine = ComplianceEngine()
        project_id = uuid4()

        # Register multiple covenants
        for i in range(3):
            covenant = engine.register_covenant(
                project_id=project_id,
                title=f"Covenant {i}",
                description="Test",
                terms={},
                check_type=ComplianceCheckType.THRESHOLD,
                threshold=50.0,
            )

            # Perform checks
            if i == 0:
                engine.perform_check(
                    covenant_id=covenant.covenant_id,
                    project_id=project_id,
                    metric_value=55.0,
                )
            else:
                engine.perform_check(
                    covenant_id=covenant.covenant_id,
                    project_id=project_id,
                    metric_value=40.0,
                )

        status = engine.get_compliance_status(project_id)

        assert status["total_covenants"] == 3
        assert status["total_checks"] == 3
        assert status["compliant_checks"] == 1
        assert status["breach_checks"] == 2

    def test_acknowledge_alert(self):
        """Test acknowledging a compliance alert."""
        engine = ComplianceEngine()
        project_id = uuid4()

        covenant = engine.register_covenant(
            project_id=project_id,
            title="Flow",
            description="Test",
            terms={},
            check_type=ComplianceCheckType.THRESHOLD,
            threshold=50.0,
        )

        check, alert = engine.perform_check(
            covenant_id=covenant.covenant_id,
            project_id=project_id,
            metric_value=40.0,
        )

        user_id = uuid4()
        ack_alert = engine.acknowledge_alert(alert.alert_id, user_id)

        assert ack_alert.acknowledged is True
        assert ack_alert.acknowledged_by == user_id
        assert ack_alert.acknowledged_at is not None

    def test_audit_trail_logging(self):
        """Test audit trail captures all actions."""
        engine = ComplianceEngine()
        project_id = uuid4()

        covenant = engine.register_covenant(
            project_id=project_id,
            title="Test Covenant",
            description="Test",
            terms={},
            check_type=ComplianceCheckType.THRESHOLD,
            threshold=50.0,
        )

        # Get audit trail
        trail = engine.get_audit_trail(covenant.covenant_id)

        assert len(trail) > 0
        assert trail[0].action == "register"
        assert trail[0].project_id == project_id


class TestComplianceAlert:
    """Test alert functionality."""

    def test_alert_creation(self):
        """Test creating a compliance alert."""
        alert_id = uuid4()
        covenant_id = uuid4()
        project_id = uuid4()

        alert = ComplianceAlert(
            alert_id=alert_id,
            covenant_id=covenant_id,
            project_id=project_id,
            severity=AlertSeverity.CRITICAL,
            message="Covenant breach detected",
            alert_type="breach",
            data={"threshold": 50, "actual": 40},
        )

        assert alert.alert_id == alert_id
        assert alert.severity == AlertSeverity.CRITICAL
        assert alert.acknowledged is False

    def test_alert_to_dict(self):
        """Test converting alert to dictionary."""
        alert = ComplianceAlert(
            alert_id=uuid4(),
            covenant_id=uuid4(),
            project_id=uuid4(),
            severity=AlertSeverity.HIGH,
            message="Test alert",
            alert_type="warning",
        )

        alert_dict = alert.to_dict()

        assert alert_dict["severity"] == "high"
        assert alert_dict["message"] == "Test alert"
        assert "created_at" in alert_dict


class TestAlertManager:
    """Test alert management."""

    def test_alert_manager_initialization(self):
        """Test alert manager initialization."""
        manager = AlertManager()

        assert len(manager.alerts) == 0
        assert len(manager.subscribers) == 5  # 5 severity levels

    def test_add_alert(self):
        """Test adding alert to manager."""
        manager = AlertManager()

        alert = ComplianceAlert(
            alert_id=uuid4(),
            covenant_id=uuid4(),
            project_id=uuid4(),
            severity=AlertSeverity.CRITICAL,
            message="Test",
        )

        added = manager.add_alert(alert)

        assert added is not None
        assert alert.alert_id in manager.alerts

    def test_get_active_alerts(self):
        """Test retrieving active (unacknowledged) alerts."""
        manager = AlertManager()
        project_id = uuid4()

        # Add multiple alerts
        for i in range(3):
            alert = ComplianceAlert(
                alert_id=uuid4(),
                covenant_id=uuid4(),
                project_id=project_id,
                severity=AlertSeverity.HIGH if i == 0 else AlertSeverity.MEDIUM,
                message=f"Alert {i}",
            )
            manager.add_alert(alert)

        # Acknowledge one
        alerts = list(manager.alerts.values())
        manager.acknowledge_alert(alerts[0].alert_id, uuid4())

        # Get active alerts
        active = manager.get_active_alerts(project_id)

        assert len(active) == 2  # Only unacknowledged
        assert all(not a.acknowledged for a in active)

    def test_get_alerts_by_severity(self):
        """Test filtering alerts by severity."""
        manager = AlertManager()
        project_id = uuid4()

        # Add alerts with different severities
        for severity in [AlertSeverity.CRITICAL, AlertSeverity.HIGH, AlertSeverity.MEDIUM]:
            alert = ComplianceAlert(
                alert_id=uuid4(),
                covenant_id=uuid4(),
                project_id=project_id,
                severity=severity,
                message=f"Alert {severity.value}",
            )
            manager.add_alert(alert)

        critical = manager.get_alerts_by_severity(project_id, AlertSeverity.CRITICAL)

        assert len(critical) == 1
        assert critical[0].severity == AlertSeverity.CRITICAL

    def test_alert_subscriber_notification(self):
        """Test alert subscribers are notified."""
        manager = AlertManager()

        received_alerts = []

        def callback(alert: ComplianceAlert):
            received_alerts.append(alert)

        manager.subscribe(AlertSeverity.CRITICAL.value, callback)

        alert = ComplianceAlert(
            alert_id=uuid4(),
            covenant_id=uuid4(),
            project_id=uuid4(),
            severity=AlertSeverity.CRITICAL,
            message="Test",
        )

        manager.add_alert(alert)

        assert len(received_alerts) == 1
        assert received_alerts[0].alert_id == alert.alert_id


class TestAuditLogger:
    """Test audit logging functionality."""

    def test_audit_logger_initialization(self):
        """Test audit logger initialization."""
        logger = AuditLogger()

        assert len(logger.logs) == 0

    def test_log_action(self):
        """Test logging an action."""
        logger = AuditLogger()
        covenant_id = uuid4()
        project_id = uuid4()
        actor_id = uuid4()

        entry = logger.log(
            covenant_id=covenant_id,
            project_id=project_id,
            action="compliance_check",
            actor_id=actor_id,
            actor_name="Inspector John",
            details={"metric": 50, "status": "pass"},
        )

        assert entry is not None
        assert entry.action == "compliance_check"
        assert entry.actor_name == "Inspector John"
        assert entry.log_id in logger.logs

    def test_get_trail(self):
        """Test retrieving audit trail."""
        logger = AuditLogger()
        covenant_id = uuid4()
        project_id = uuid4()

        # Log multiple actions
        for i in range(5):
            logger.log(
                covenant_id=covenant_id,
                project_id=project_id,
                action=f"action_{i}",
                actor_name="system",
            )

        trail = logger.get_trail(covenant_id)

        assert len(trail) == 5
        assert trail[0].action == "action_4"  # Newest first

    def test_get_trail_by_action(self):
        """Test retrieving trail filtered by action."""
        logger = AuditLogger()
        covenant_id = uuid4()
        project_id = uuid4()

        # Log different actions
        logger.log(covenant_id, project_id, "check")
        logger.log(covenant_id, project_id, "alert")
        logger.log(covenant_id, project_id, "check")
        logger.log(covenant_id, project_id, "check")

        check_trail = logger.get_trail_by_action(covenant_id, "check")

        assert len(check_trail) == 3
        assert all(e.action == "check" for e in check_trail)

    def test_get_trail_by_actor(self):
        """Test retrieving trail filtered by actor."""
        logger = AuditLogger()
        actor1 = uuid4()
        actor2 = uuid4()

        logger.log(uuid4(), uuid4(), "action1", actor_id=actor1)
        logger.log(uuid4(), uuid4(), "action2", actor_id=actor2)
        logger.log(uuid4(), uuid4(), "action3", actor_id=actor1)

        actor1_trail = logger.get_trail_by_actor(actor1)

        assert len(actor1_trail) == 2
        assert all(e.actor_id == actor1 for e in actor1_trail)

    def test_export_trail_json(self):
        """Test exporting audit trail as JSON."""
        logger = AuditLogger()
        covenant_id = uuid4()
        project_id = uuid4()

        logger.log(covenant_id, project_id, "check", actor_name="system")
        logger.log(covenant_id, project_id, "alert", actor_name="system")

        exported = logger.export_trail(covenant_id, format="json")

        assert exported is not None
        assert "check" in exported
        assert "alert" in exported
        assert "[" in exported  # JSON array

    def test_export_trail_csv(self):
        """Test exporting audit trail as CSV."""
        logger = AuditLogger()
        covenant_id = uuid4()
        project_id = uuid4()

        logger.log(covenant_id, project_id, "check", actor_name="system")
        logger.log(covenant_id, project_id, "alert", actor_name="system")

        exported = logger.export_trail(covenant_id, format="csv")

        assert exported is not None
        assert "action" in exported
        assert "check" in exported
        assert "alert" in exported
        assert "\n" in exported  # CSV lines


class TestComplianceIntegration:
    """Integration tests for complete compliance workflows."""

    def test_full_compliance_workflow(self):
        """Test complete compliance check workflow."""
        engine = ComplianceEngine()
        project_id = uuid4()
        user_id = uuid4()

        # Register covenant
        covenant = engine.register_covenant(
            project_id=project_id,
            title="Environmental Flow",
            description="Minimum downstream flow",
            terms={"min_flow": 50},
            check_type=ComplianceCheckType.THRESHOLD,
            threshold=50.0,
        )

        # Perform failing check
        check, alert = engine.perform_check(
            covenant_id=covenant.covenant_id,
            project_id=project_id,
            metric_value=40.0,
            performed_by=user_id,
            notes="Flow monitoring",
        )

        assert check.is_compliant is False
        assert alert is not None

        # Acknowledge alert
        ack = engine.acknowledge_alert(alert.alert_id, user_id)
        assert ack.acknowledged is True

        # Check audit trail
        trail = engine.get_audit_trail(covenant.covenant_id)
        assert len(trail) >= 3  # register, check, acknowledge_alert
        actions = [e.action for e in trail]
        assert "register" in actions
        assert "check" in actions
        assert "acknowledge_alert" in actions

    def test_multiple_projects_isolation(self):
        """Test compliance isolation between projects."""
        engine = ComplianceEngine()
        project1 = uuid4()
        project2 = uuid4()

        # Register covenants in different projects
        cov1 = engine.register_covenant(
            project_id=project1,
            title="Covenant 1",
            description="Test",
            terms={},
            check_type=ComplianceCheckType.THRESHOLD,
            threshold=50.0,
        )

        cov2 = engine.register_covenant(
            project_id=project2,
            title="Covenant 2",
            description="Test",
            terms={},
            check_type=ComplianceCheckType.THRESHOLD,
            threshold=50.0,
        )

        # Perform checks
        engine.perform_check(cov1.covenant_id, project1, 55.0)
        engine.perform_check(cov2.covenant_id, project2, 40.0)

        # Get status
        status1 = engine.get_compliance_status(project1)
        status2 = engine.get_compliance_status(project2)

        assert status1["compliant_checks"] == 1
        assert status2["breach_checks"] == 1

    def test_error_handling_invalid_covenant(self):
        """Test error handling for invalid covenant ID."""
        engine = ComplianceEngine()
        invalid_id = uuid4()
        project_id = uuid4()

        result = engine.perform_check(
            covenant_id=invalid_id,
            project_id=project_id,
            metric_value=50.0,
        )

        assert result == (None, None)

    def test_compliance_rate_calculation(self):
        """Test compliance rate calculation."""
        engine = ComplianceEngine()
        project_id = uuid4()

        # Create 10 covenants with 70% compliance
        for i in range(10):
            covenant = engine.register_covenant(
                project_id=project_id,
                title=f"Covenant {i}",
                description="Test",
                terms={},
                check_type=ComplianceCheckType.THRESHOLD,
                threshold=50.0,
            )

            # 7 compliant, 3 breaches
            value = 55.0 if i < 7 else 40.0
            engine.perform_check(covenant.covenant_id, project_id, value)

        status = engine.get_compliance_status(project_id)

        assert status["compliance_rate"] == 70.0

    def test_alert_severity_distribution(self):
        """Test alert severity counting."""
        engine = ComplianceEngine()
        project_id = uuid4()

        # Create covenants with different breach scenarios
        # CRITICAL: threshold breach
        cov1 = engine.register_covenant(
            project_id=project_id,
            title="Flow",
            description="Test",
            terms={},
            check_type=ComplianceCheckType.THRESHOLD,
            threshold=50.0,
        )
        engine.perform_check(cov1.covenant_id, project_id, 40.0)

        # HIGH: date-based near expiry
        cov2 = engine.register_covenant(
            project_id=project_id,
            title="Permit",
            description="Test",
            terms={},
            check_type=ComplianceCheckType.DATE_BASED,
            due_date=datetime.utcnow() + timedelta(days=15),
        )
        engine.perform_check(cov2.covenant_id, project_id)

        status = engine.get_compliance_status(project_id)
        alerts = status["alerts_by_severity"]

        assert alerts["critical"] >= 1
        assert alerts["high"] >= 1
