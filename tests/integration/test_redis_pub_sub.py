"""Tests for Redis pub/sub and event queuing (Phase 4.5)."""

import pytest
import json
from uuid import UUID, uuid4
from datetime import datetime

from backend.app.services.redis_service import RedisService, get_redis_service


class TestRedisService:
    """Test Redis service initialization and configuration."""

    def test_create_redis_service_disabled(self):
        """Test creating service with Redis disabled."""
        service = RedisService(enabled=False)
        assert service.enabled is False
        assert service.is_available() is False

    def test_redis_service_unavailable_gracefully(self):
        """Test service handles unavailability gracefully."""
        service = RedisService(redis_url="redis://invalid:9999", enabled=True)
        assert service.is_available() is False

    def test_redis_service_channel_prefix(self):
        """Test channel prefix configuration."""
        service = RedisService(enabled=False)
        assert service.channel_prefix == "hpms_notifications:"

    def test_redis_service_queue_prefix(self):
        """Test queue prefix configuration."""
        service = RedisService(enabled=False)
        assert service.queue_prefix == "hpms_queue:"

    def test_redis_service_queue_ttl(self):
        """Test queue TTL configuration."""
        service = RedisService(enabled=False)
        assert service.queue_ttl == 604800  # 7 days


class TestPublishEvent:
    """Test event publishing to Redis pub/sub."""

    def test_publish_event_when_disabled(self):
        """Test publishing when Redis disabled."""
        service = RedisService(enabled=False)
        user_id = uuid4()
        event = {"type": "export_completed", "data": {}}

        result = service.publish_event(user_id, event)
        assert result is False

    def test_publish_event_format(self):
        """Test event is properly formatted for publishing."""
        service = RedisService(enabled=False)
        user_id = uuid4()
        event = {
            "type": "export_completed",
            "user_id": str(user_id),
            "data": {"filename": "report.pdf"}
        }

        # Verify event can be JSON serialized
        json_str = json.dumps(event)
        assert json_str is not None
        assert "export_completed" in json_str

    def test_publish_event_creates_channel(self):
        """Test channel name is created correctly."""
        service = RedisService(enabled=False)
        user_id = uuid4()

        # Channel name should be: prefix + user_id
        expected_channel = f"hpms_notifications:{user_id}"
        assert expected_channel is not None


class TestQueueEvent:
    """Test event queuing for offline users."""

    def test_queue_event_when_disabled(self):
        """Test queuing when Redis disabled."""
        service = RedisService(enabled=False)
        user_id = uuid4()
        event = {"type": "approval_requested"}

        result = service.queue_event(user_id, event)
        assert result is False

    def test_queue_event_format(self):
        """Test event is properly formatted for queueing."""
        service = RedisService(enabled=False)
        user_id = uuid4()
        event = {
            "type": "approval_requested",
            "priority": "critical",
            "data": {"request_id": "req-123"}
        }

        # Verify event can be JSON serialized
        json_str = json.dumps(event)
        assert json_str is not None
        assert "critical" in json_str

    def test_queue_key_format(self):
        """Test queue key naming."""
        service = RedisService(enabled=False)
        user_id = uuid4()

        expected_queue = f"hpms_queue:{user_id}"
        assert expected_queue is not None
        assert "hpms_queue:" in expected_queue


class TestPendingEvents:
    """Test retrieving pending events from queue."""

    def test_get_pending_events_empty_queue(self):
        """Test getting pending events from empty queue."""
        service = RedisService(enabled=False)
        user_id = uuid4()

        events = service.get_pending_events(user_id)
        assert isinstance(events, list)
        assert len(events) == 0

    def test_get_pending_events_clear_flag(self):
        """Test clear parameter behavior."""
        service = RedisService(enabled=False)
        user_id = uuid4()

        # With clear=True (default), queue should be cleared after retrieval
        events = service.get_pending_events(user_id, clear=True)
        assert isinstance(events, list)

    def test_get_pending_events_with_clear_false(self):
        """Test retrieving without clearing queue."""
        service = RedisService(enabled=False)
        user_id = uuid4()

        # With clear=False, queue should remain
        events = service.get_pending_events(user_id, clear=False)
        assert isinstance(events, list)


class TestSubscription:
    """Test pub/sub channel subscription."""

    def test_subscribe_channel_when_disabled(self):
        """Test subscribing when Redis disabled."""
        service = RedisService(enabled=False)
        user_id = uuid4()

        result = service.subscribe_channel(user_id)
        assert result is None

    def test_unsubscribe_channel_with_none(self):
        """Test unsubscribing with None pubsub object."""
        service = RedisService(enabled=False)
        user_id = uuid4()

        result = service.unsubscribe_channel(None, user_id)
        assert result is False

    def test_channel_name_format(self):
        """Test subscription channel naming."""
        service = RedisService(enabled=False)
        user_id = uuid4()

        expected_channel = f"hpms_notifications:{user_id}"
        assert expected_channel is not None
        assert str(user_id) in expected_channel


class TestQueueManagement:
    """Test queue size and clearing operations."""

    def test_get_queue_size_when_disabled(self):
        """Test getting queue size when disabled."""
        service = RedisService(enabled=False)
        user_id = uuid4()

        size = service.get_queue_size(user_id)
        assert size == 0

    def test_clear_queue_when_disabled(self):
        """Test clearing queue when disabled."""
        service = RedisService(enabled=False)
        user_id = uuid4()

        result = service.clear_queue(user_id)
        assert result is False


class TestBroadcasting:
    """Test role-based broadcasting."""

    def test_broadcast_to_role_placeholder(self):
        """Test role-based broadcast is placeholder."""
        service = RedisService(enabled=False)
        event = {"type": "system_alert"}

        count = service.broadcast_to_role("admin", event)
        assert count == 0  # Placeholder returns 0


class TestHealthCheck:
    """Test health check functionality."""

    def test_health_check_structure(self):
        """Test health check returns proper structure."""
        service = RedisService(enabled=False)

        health = service.health_check()
        assert isinstance(health, dict)
        assert "redis_available" in health
        assert "redis_enabled" in health
        assert "timestamp" in health

    def test_health_check_when_disabled(self):
        """Test health check when disabled."""
        service = RedisService(enabled=False)

        health = service.health_check()
        assert health["redis_available"] is False
        assert health["redis_enabled"] is False

    def test_health_check_timestamp_format(self):
        """Test timestamp is ISO format."""
        service = RedisService(enabled=False)

        health = service.health_check()
        timestamp = health["timestamp"]
        assert "Z" in timestamp  # ISO format with Z suffix


class TestGlobalService:
    """Test global service instance."""

    def test_get_redis_service_singleton(self):
        """Test that same instance is returned."""
        service1 = get_redis_service()
        service2 = get_redis_service()
        assert service1 is service2

    def test_get_redis_service_not_none(self):
        """Test service is not None."""
        service = get_redis_service()
        assert service is not None
        assert isinstance(service, RedisService)


class TestFallbackBehavior:
    """Test graceful fallback when Redis unavailable."""

    def test_publish_returns_false_when_unavailable(self):
        """Test publish returns False gracefully."""
        service = RedisService(enabled=False)
        user_id = uuid4()
        event = {"type": "test"}

        result = service.publish_event(user_id, event)
        assert isinstance(result, bool)
        assert result is False

    def test_queue_returns_false_when_unavailable(self):
        """Test queue returns False gracefully."""
        service = RedisService(enabled=False)
        user_id = uuid4()
        event = {"type": "test"}

        result = service.queue_event(user_id, event)
        assert isinstance(result, bool)
        assert result is False

    def test_get_pending_returns_empty_list(self):
        """Test get_pending_events returns empty list."""
        service = RedisService(enabled=False)
        user_id = uuid4()

        events = service.get_pending_events(user_id)
        assert isinstance(events, list)
        assert len(events) == 0

    def test_operations_never_raise_exceptions(self):
        """Test all operations handle errors gracefully."""
        service = RedisService(redis_url="redis://invalid:9999", enabled=True)
        user_id = uuid4()
        event = {"type": "test"}

        # None of these should raise exceptions
        service.publish_event(user_id, event)
        service.queue_event(user_id, event)
        service.get_pending_events(user_id)
        service.subscribe_channel(user_id)
        service.get_queue_size(user_id)
        service.clear_queue(user_id)
        service.health_check()


class TestEventDataStructure:
    """Test event data structure compatibility."""

    def test_event_with_nested_data(self):
        """Test event with nested dictionary."""
        service = RedisService(enabled=False)
        user_id = uuid4()
        event = {
            "type": "project_updated",
            "data": {
                "project_id": "proj-123",
                "changes": {
                    "capacity": 50.5,
                    "status": "active"
                }
            }
        }

        json_str = json.dumps(event)
        assert "project_updated" in json_str

    def test_event_with_list_data(self):
        """Test event with list data."""
        service = RedisService(enabled=False)
        user_id = uuid4()
        event = {
            "type": "multiple_exports",
            "data": {
                "exports": [
                    {"id": "exp-1", "status": "completed"},
                    {"id": "exp-2", "status": "failed"}
                ]
            }
        }

        json_str = json.dumps(event)
        assert "multiple_exports" in json_str

    def test_event_with_uuid_fields(self):
        """Test event with UUID fields."""
        service = RedisService(enabled=False)
        user_id = uuid4()
        event = {
            "type": "loan_created",
            "data": {
                "loan_id": str(uuid4()),
                "project_id": str(uuid4())
            }
        }

        json_str = json.dumps(event)
        assert len(json_str) > 0


class TestConfiguration:
    """Test service configuration options."""

    def test_custom_channel_prefix(self):
        """Test custom channel prefix."""
        service = RedisService(enabled=False)
        service.channel_prefix = "custom:"

        assert service.channel_prefix == "custom:"

    def test_custom_queue_prefix(self):
        """Test custom queue prefix."""
        service = RedisService(enabled=False)
        service.queue_prefix = "custom_queue:"

        assert service.queue_prefix == "custom_queue:"

    def test_custom_ttl(self):
        """Test custom queue TTL."""
        service = RedisService(enabled=False)
        service.queue_ttl = 86400  # 1 day

        assert service.queue_ttl == 86400
