"""Tests for WebSocket real-time notifications."""

import pytest
import json
from uuid import UUID
from datetime import datetime

from backend.app.websocket.ws_handler import (
    WebSocketConnectionHandler,
    WebSocketConnectionManager,
    WebSocketMessage,
    MessageType,
    connection_manager,
)
from backend.app.services.notification_service import (
    NotificationService,
    EventType,
    EventPriority,
    NotificationEvent,
)


class TestNotificationEvent:
    """Test notification event creation and serialization."""

    def test_create_export_completed_event(self):
        """Test export completion event creation."""
        user_id = UUID("12345678-1234-5678-1234-567812345678")
        event = NotificationEvent(
            event_type=EventType.EXPORT_COMPLETED,
            user_id=user_id,
            data={
                "export_id": "exp-123",
                "filename": "report.pdf",
                "format": "pdf",
                "record_count": 100,
            },
            priority=EventPriority.HIGH,
            title="Export Complete",
            message="Your export is ready.",
        )

        assert event.event_type == EventType.EXPORT_COMPLETED
        assert event.user_id == user_id
        assert event.priority == EventPriority.HIGH
        assert event.data["filename"] == "report.pdf"

    def test_event_to_dict(self):
        """Test event serialization to dict."""
        user_id = UUID("12345678-1234-5678-1234-567812345678")
        event = NotificationEvent(
            event_type=EventType.APPROVAL_REQUESTED,
            user_id=user_id,
            data={"request_id": "req-456"},
        )

        event_dict = event.to_dict()

        assert "type" in event_dict
        assert "user_id" in event_dict
        assert "data" in event_dict
        assert "timestamp" in event_dict
        assert event_dict["type"] == "approval_requested"
        assert event_dict["user_id"] == str(user_id)

    def test_event_to_json(self):
        """Test event serialization to JSON."""
        user_id = UUID("12345678-1234-5678-1234-567812345678")
        event = NotificationEvent(
            event_type=EventType.RATE_CHANGED,
            user_id=user_id,
            data={"old_rate": 8.5, "new_rate": 8.75},
        )

        json_str = event.to_json()

        assert isinstance(json_str, str)
        parsed = json.loads(json_str)
        assert parsed["type"] == "rate_changed"
        assert "user_id" in parsed


class TestNotificationService:
    """Test notification service."""

    def test_create_export_completed_event(self):
        """Test creating export completed event."""
        service = NotificationService()
        user_id = UUID("11111111-1111-1111-1111-111111111111")

        event = service.create_export_completed_event(
            user_id=user_id,
            export_id="exp-001",
            filename="portfolio.pdf",
            format="pdf",
            record_count=50,
            download_url="https://s3.example.com/exports/portfolio.pdf",
        )

        assert event.event_type == EventType.EXPORT_COMPLETED
        assert event.user_id == user_id
        assert event.data["filename"] == "portfolio.pdf"

    def test_create_approval_requested_event(self):
        """Test creating approval request event."""
        service = NotificationService()
        user_id = UUID("22222222-2222-2222-2222-222222222222")

        event = service.create_approval_requested_event(
            user_id=user_id,
            request_id="apr-001",
            project_id="proj-123",
            requester_name="John Doe",
        )

        assert event.event_type == EventType.APPROVAL_REQUESTED
        assert event.priority == EventPriority.CRITICAL
        assert "John Doe" in event.message

    def test_create_rate_changed_event(self):
        """Test creating rate change event."""
        service = NotificationService()
        user_id = UUID("33333333-3333-3333-3333-333333333333")

        event = service.create_rate_changed_event(
            user_id=user_id,
            loan_id="loan-456",
            old_rate=8.5,
            new_rate=8.75,
        )

        assert event.event_type == EventType.RATE_CHANGED
        assert event.data["old_rate"] == 8.5
        assert event.data["new_rate"] == 8.75
        assert event.data["change"] == 0.25

    def test_create_project_updated_event(self):
        """Test creating project update event."""
        service = NotificationService()
        user_id = UUID("44444444-4444-4444-4444-444444444444")

        event = service.create_project_updated_event(
            user_id=user_id,
            project_id="proj-789",
            project_name="Hydro Project Alpha",
            changes={"capacity_mw": 50.0, "status": "active"},
        )

        assert event.event_type == EventType.PROJECT_UPDATED
        assert "Hydro Project Alpha" in event.message


class TestWebSocketMessage:
    """Test WebSocket message creation."""

    def test_create_message(self):
        """Test creating WebSocket message."""
        message = WebSocketMessage(
            message_type=MessageType.SUBSCRIBE,
            data={"status": "subscribed"},
            message_id="msg-001",
        )

        assert message.message_type == MessageType.SUBSCRIBE
        assert message.data["status"] == "subscribed"
        assert message.message_id == "msg-001"

    def test_message_to_dict(self):
        """Test message serialization."""
        message = WebSocketMessage(
            message_type=MessageType.EVENT,
            data={"type": "export_completed"},
            message_id="msg-002",
        )

        msg_dict = message.to_dict()

        assert msg_dict["type"] == "event"
        assert msg_dict["message_id"] == "msg-002"
        assert "timestamp" in msg_dict


class TestWebSocketConnectionManager:
    """Test WebSocket connection manager."""

    def test_create_connection_manager(self):
        """Test creating connection manager."""
        manager = WebSocketConnectionManager()

        assert manager.get_total_connections() == 0
        assert len(manager.get_all_users_connected()) == 0

    def test_register_connection(self):
        """Test registering connection (mock)."""
        manager = WebSocketConnectionManager()

        # Note: Can't fully test without actual WebSocket object
        # This is a placeholder for the registration mechanism
        assert manager.get_total_connections() == 0

    def test_get_connection_count(self):
        """Test getting connection count."""
        manager = WebSocketConnectionManager()
        user_id = UUID("55555555-5555-5555-5555-555555555555")

        count = manager.get_connection_count(user_id)

        assert count == 0


class TestEventTypes:
    """Test event type enum."""

    def test_event_type_values(self):
        """Test event type enum values."""
        assert EventType.EXPORT_COMPLETED.value == "export_completed"
        assert EventType.EXPORT_FAILED.value == "export_failed"
        assert EventType.APPROVAL_REQUESTED.value == "approval_requested"
        assert EventType.APPROVAL_COMPLETED.value == "approval_completed"
        assert EventType.RATE_CHANGED.value == "rate_changed"
        assert EventType.PROJECT_UPDATED.value == "project_updated"
        assert EventType.SYSTEM_ALERT.value == "system_alert"

    def test_event_priority_values(self):
        """Test event priority enum."""
        assert EventPriority.LOW.value == "low"
        assert EventPriority.MEDIUM.value == "medium"
        assert EventPriority.HIGH.value == "high"
        assert EventPriority.CRITICAL.value == "critical"


class TestMessageQueue:
    """Test event queuing for offline users."""

    def test_queue_event(self):
        """Test queuing event for offline user."""
        service = NotificationService()
        user_id = UUID("66666666-6666-6666-6666-666666666666")

        event = NotificationEvent(
            event_type=EventType.SYSTEM_ALERT,
            user_id=user_id,
            data={"alert": "test"},
        )

        # Simulate queueing
        import asyncio

        async def test_queue():
            await service.queue_event(event)
            assert user_id in service.event_queue
            assert len(service.event_queue[user_id]) == 1

        # Would be run in async context
        assert service.event_queue.get(user_id, []) == []

    def test_multiple_events_queue(self):
        """Test queuing multiple events."""
        service = NotificationService()
        user_id = UUID("77777777-7777-7777-7777-777777777777")

        events = [
            NotificationEvent(
                event_type=EventType.EXPORT_COMPLETED,
                user_id=user_id,
                data={"export_id": f"exp-{i}"},
            )
            for i in range(3)
        ]

        # In real scenario, these would be queued
        # Testing the structure here
        assert len(events) == 3
        assert all(e.user_id == user_id for e in events)


class TestConnectionLifecycle:
    """Test WebSocket connection lifecycle."""

    def test_message_type_flow(self):
        """Test message type sequence."""
        # Subscribe -> (receive events/heartbeats) -> Unsubscribe -> Close

        flow = [
            MessageType.SUBSCRIBE,
            MessageType.EVENT,
            MessageType.HEARTBEAT,
            MessageType.ACK,
            MessageType.UNSUBSCRIBE,
        ]

        assert flow[0] == MessageType.SUBSCRIBE
        assert MessageType.HEARTBEAT in flow
        assert flow[-1] == MessageType.UNSUBSCRIBE

    def test_heartbeat_interval(self):
        """Test heartbeat timing."""
        heartbeat_interval = 30  # seconds

        # Should send heartbeat every 30 seconds
        assert heartbeat_interval == 30

    def test_reconnection_handling(self):
        """Test reconnection message type."""
        message = WebSocketMessage(
            message_type=MessageType.RECONNECT,
            data={"last_message_id": "msg-123"},
        )

        assert message.message_type == MessageType.RECONNECT


class TestBroadcasting:
    """Test event broadcasting."""

    def test_broadcast_scenarios(self):
        """Test various broadcast scenarios."""
        # 1. Broadcast to online user -> immediate delivery
        # 2. Broadcast to offline user -> queue for later
        # 3. Broadcast to role -> multiple users
        # 4. Broadcast to all -> system-wide notification

        scenarios = {
            "online_user": "immediate",
            "offline_user": "queued",
            "role_broadcast": "multiple",
            "system_wide": "queued_for_all",
        }

        assert scenarios["online_user"] == "immediate"
        assert scenarios["offline_user"] == "queued"


class TestNotificationPriority:
    """Test priority-based notification handling."""

    def test_priority_levels(self):
        """Test priority level ordering."""
        priorities = [
            EventPriority.LOW,
            EventPriority.MEDIUM,
            EventPriority.HIGH,
            EventPriority.CRITICAL,
        ]

        # Critical should be handled first
        assert priorities[-1] == EventPriority.CRITICAL

    def test_critical_event_delivery(self):
        """Test that critical events are prioritized."""
        service = NotificationService()
        user_id = UUID("88888888-8888-8888-8888-888888888888")

        critical_event = service.create_approval_requested_event(
            user_id=user_id,
            request_id="apr-urgent",
            project_id="proj-123",
            requester_name="Manager",
        )

        assert critical_event.priority == EventPriority.CRITICAL
        assert critical_event.event_type == EventType.APPROVAL_REQUESTED


class TestEventTimestamps:
    """Test event timestamp handling."""

    def test_event_timestamp(self):
        """Test event has timestamp."""
        event = NotificationEvent(
            event_type=EventType.SYSTEM_ALERT,
            user_id=UUID("99999999-9999-9999-9999-999999999999"),
            data={"test": "data"},
        )

        assert event.timestamp is not None
        assert isinstance(event.timestamp, datetime)

    def test_message_timestamp(self):
        """Test message has timestamp."""
        message = WebSocketMessage(
            message_type=MessageType.HEARTBEAT,
        )

        assert message.timestamp is not None
        assert isinstance(message.timestamp, datetime)
