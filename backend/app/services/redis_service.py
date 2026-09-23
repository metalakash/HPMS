"""Redis service for pub/sub and event queuing (Phase 4.5)."""

import logging
import json
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta

try:
    import redis
    from redis import Redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

from backend.app.config import settings

logger = logging.getLogger(__name__)


class RedisService:
    """Service for Redis pub/sub and event queue operations.

    Provides:
    - Event broadcasting via pub/sub channels
    - Persistent event queue with TTL
    - Fallback to None if Redis unavailable
    """

    def __init__(self, redis_url: str = None, enabled: bool = True):
        """Initialize Redis service.

        Args:
            redis_url: Redis connection URL (uses settings if None)
            enabled: Whether to use Redis (even if available)
        """
        self.enabled = enabled and REDIS_AVAILABLE
        self.redis_url = redis_url or getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
        self.client: Optional[Redis] = None
        self.pubsub = None

        # Configuration
        self.queue_ttl = getattr(settings, "REDIS_QUEUE_TTL", 604800)  # 7 days
        self.channel_prefix = getattr(settings, "REDIS_CHANNEL_PREFIX", "hpms_notifications:")
        self.queue_prefix = getattr(settings, "REDIS_QUEUE_PREFIX", "hpms_queue:")

        if self.enabled:
            try:
                self.client = redis.from_url(self.redis_url, decode_responses=True)
                # Test connection
                self.client.ping()
                logger.info(f"Redis connected: {self.redis_url}")
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}")
                self.client = None
                self.enabled = False

    def is_available(self) -> bool:
        """Check if Redis is available and connected.

        Returns:
            True if Redis is connected, False otherwise
        """
        if not self.enabled or self.client is None:
            return False

        try:
            self.client.ping()
            return True
        except Exception as e:
            logger.warning(f"Redis connection check failed: {e}")
            return False

    def publish_event(self, user_id: UUID, event_data: Dict[str, Any]) -> bool:
        """Publish event to user's notification channel.

        Args:
            user_id: Target user UUID
            event_data: Event data to publish (dict)

        Returns:
            True if published, False if Redis unavailable
        """
        if not self.is_available():
            logger.debug("Redis unavailable, event not published")
            return False

        try:
            channel = f"{self.channel_prefix}{user_id}"
            message = json.dumps(event_data)

            count = self.client.publish(channel, message)
            logger.debug(f"Event published to {channel}: {count} subscribers")

            return count > 0

        except Exception as e:
            logger.error(f"Error publishing event: {e}")
            return False

    def queue_event(self, user_id: UUID, event_data: Dict[str, Any]) -> bool:
        """Queue event for offline user (persistent storage).

        Args:
            user_id: Target user UUID
            event_data: Event data to queue (dict)

        Returns:
            True if queued, False if Redis unavailable
        """
        if not self.is_available():
            logger.debug("Redis unavailable, event not queued")
            return False

        try:
            queue_key = f"{self.queue_prefix}{user_id}"
            message = json.dumps(event_data)

            # Push to queue (list)
            self.client.rpush(queue_key, message)

            # Set expiration (TTL)
            self.client.expire(queue_key, self.queue_ttl)

            logger.debug(f"Event queued for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error queuing event: {e}")
            return False

    def get_pending_events(self, user_id: UUID, clear: bool = True) -> List[Dict[str, Any]]:
        """Retrieve pending events from queue.

        Args:
            user_id: Target user UUID
            clear: Whether to clear queue after retrieval

        Returns:
            List of pending events, or empty list if none
        """
        if not self.is_available():
            logger.debug("Redis unavailable, no pending events")
            return []

        try:
            queue_key = f"{self.queue_prefix}{user_id}"

            # Get all events from queue
            events_json = self.client.lrange(queue_key, 0, -1)

            # Clear queue if requested
            if clear and events_json:
                self.client.delete(queue_key)

            # Deserialize events
            events = []
            for event_json in events_json:
                try:
                    event = json.loads(event_json)
                    events.append(event)
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse queued event: {event_json}")

            logger.debug(f"Retrieved {len(events)} pending events for user {user_id}")
            return events

        except Exception as e:
            logger.error(f"Error getting pending events: {e}")
            return []

    def subscribe_channel(self, user_id: UUID) -> Optional[redis.pubsub.PubSub]:
        """Subscribe to user's notification channel.

        Args:
            user_id: Target user UUID

        Returns:
            PubSub object for listening to events, or None if unavailable
        """
        if not self.is_available():
            logger.debug("Redis unavailable, subscription failed")
            return None

        try:
            channel = f"{self.channel_prefix}{user_id}"
            pubsub = self.client.pubsub()
            pubsub.subscribe(channel)

            logger.debug(f"Subscribed to channel: {channel}")
            return pubsub

        except Exception as e:
            logger.error(f"Error subscribing to channel: {e}")
            return None

    def unsubscribe_channel(self, pubsub: redis.pubsub.PubSub, user_id: UUID) -> bool:
        """Unsubscribe from user's notification channel.

        Args:
            pubsub: PubSub object to unsubscribe
            user_id: Target user UUID

        Returns:
            True if successful, False otherwise
        """
        if pubsub is None:
            return False

        try:
            channel = f"{self.channel_prefix}{user_id}"
            pubsub.unsubscribe(channel)
            pubsub.close()

            logger.debug(f"Unsubscribed from channel: {channel}")
            return True

        except Exception as e:
            logger.error(f"Error unsubscribing from channel: {e}")
            return False

    def broadcast_to_role(self, role: str, event_data: Dict[str, Any]) -> int:
        """Broadcast event to all users with specific role.

        Note: Requires tracking role subscriptions (not implemented yet).

        Args:
            role: User role (admin, approver, etc.)
            event_data: Event data to broadcast

        Returns:
            Number of users notified (0 if not implemented)
        """
        # TODO: Implement role-based broadcasting
        # Would require tracking which user IDs have which roles
        # in Redis and publishing to multiple channels
        logger.info(f"Role-based broadcast placeholder for role: {role}")
        return 0

    def get_queue_size(self, user_id: UUID) -> int:
        """Get number of pending events for user.

        Args:
            user_id: Target user UUID

        Returns:
            Queue size, or 0 if unavailable
        """
        if not self.is_available():
            return 0

        try:
            queue_key = f"{self.queue_prefix}{user_id}"
            size = self.client.llen(queue_key)
            return size

        except Exception as e:
            logger.error(f"Error getting queue size: {e}")
            return 0

    def clear_queue(self, user_id: UUID) -> bool:
        """Clear all pending events for user.

        Args:
            user_id: Target user UUID

        Returns:
            True if cleared, False if error
        """
        if not self.is_available():
            return False

        try:
            queue_key = f"{self.queue_prefix}{user_id}"
            self.client.delete(queue_key)

            logger.debug(f"Cleared queue for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error clearing queue: {e}")
            return False

    def health_check(self) -> Dict[str, Any]:
        """Check Redis health and get statistics.

        Returns:
            Health status dictionary
        """
        status = {
            "redis_available": self.is_available(),
            "redis_enabled": self.enabled,
            "redis_url": self.redis_url if not self.is_available() else "***",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        if self.is_available():
            try:
                info = self.client.info()
                status["redis_version"] = info.get("redis_version")
                status["connected_clients"] = info.get("connected_clients")
                status["used_memory"] = info.get("used_memory_human")
                status["uptime_seconds"] = info.get("uptime_in_seconds")
            except Exception as e:
                logger.error(f"Error getting Redis info: {e}")

        return status

    def cleanup(self):
        """Clean up Redis connection."""
        if self.client:
            try:
                self.client.close()
                logger.info("Redis connection closed")
            except Exception as e:
                logger.error(f"Error closing Redis connection: {e}")


# Global instance
_redis_service: Optional[RedisService] = None


def get_redis_service() -> RedisService:
    """Get or create global Redis service.

    Returns:
        RedisService instance
    """
    global _redis_service
    if _redis_service is None:
        enabled = getattr(settings, "REDIS_ENABLED", False)
        _redis_service = RedisService(enabled=enabled)
    return _redis_service


def set_redis_service(service: RedisService) -> None:
    """Set global Redis service.

    Args:
        service: RedisService instance
    """
    global _redis_service
    _redis_service = service
