"""Notification service for real-time WebSocket updates.

Handles event broadcasting and notification queuing.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum
from uuid import UUID
import json

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """Real-time event types."""
    EXPORT_COMPLETED = "export_completed"
    EXPORT_FAILED = "export_failed"
    APPROVAL_REQUESTED = "approval_requested"
    APPROVAL_COMPLETED = "approval_completed"
    RATE_CHANGED = "rate_changed"
    PROJECT_UPDATED = "project_updated"
    LOAN_UPDATED = "loan_updated"
    USER_LOGGED_IN = "user_logged_in"
    USER_LOGGED_OUT = "user_logged_out"
    SYSTEM_ALERT = "system_alert"


class EventPriority(str, Enum):
    """Event priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class NotificationEvent:
    """Represents a notification event."""

    def __init__(
        self,
        event_type: EventType,
        user_id: UUID,
        data: Dict[str, Any],
        priority: EventPriority = EventPriority.MEDIUM,
        title: Optional[str] = None,
        message: Optional[str] = None,
    ):
        """Initialize notification event.

        Args:
            event_type: Type of event
            user_id: Target user ID
            data: Event payload data
            priority: Event priority
            title: Human-readable title
            message: Human-readable message
        """

        self.event_type = event_type
        self.user_id = user_id
        self.data = data
        self.priority = priority
        self.title = title or str(event_type.value)
        self.message = message or "New notification"
        self.timestamp = datetime.utcnow()
        self.id = f"{user_id}:{event_type.value}:{self.timestamp.timestamp()}"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization.

        Returns:
            Dictionary representation of event
        """

        return {
            "id": self.id,
            "type": self.event_type.value,
            "user_id": str(self.user_id),
            "data": self.data,
            "priority": self.priority.value,
            "title": self.title,
            "message": self.message,
            "timestamp": self.timestamp.isoformat() + "Z",
        }

    def to_json(self) -> str:
        """Convert to JSON string.

        Returns:
            JSON representation
        """

        return json.dumps(self.to_dict())

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "NotificationEvent":
        """Create event from dictionary.

        Args:
            data: Dictionary with event data

        Returns:
            NotificationEvent instance
        """

        try:
            event = NotificationEvent(
                event_type=EventType(data.get("type", "system_alert")),
                user_id=UUID(data.get("user_id")),
                data=data.get("data", {}),
                priority=EventPriority(data.get("priority", "medium")),
                title=data.get("title"),
                message=data.get("message"),
            )
            event.timestamp = datetime.fromisoformat(
                data.get("timestamp", "").replace("Z", "+00:00")
            )
            return event
        except Exception as e:
            logger.error(f"Error creating event from dict: {e}")
            raise


class NotificationService:
    """Service for managing real-time notifications."""

    def __init__(self):
        """Initialize notification service."""

        self.event_queue: Dict[UUID, List[NotificationEvent]] = {}
        self.subscribers: Dict[UUID, List[Any]] = {}

    def create_export_completed_event(
        self,
        user_id: UUID,
        export_id: str,
        filename: str,
        format: str,
        record_count: int,
        download_url: Optional[str] = None,
    ) -> NotificationEvent:
        """Create export completion event.

        Args:
            user_id: Target user
            export_id: Export job ID
            filename: Generated filename
            format: Export format (csv, excel, pdf)
            record_count: Number of records exported
            download_url: Presigned download URL

        Returns:
            NotificationEvent
        """

        return NotificationEvent(
            event_type=EventType.EXPORT_COMPLETED,
            user_id=user_id,
            data={
                "export_id": export_id,
                "filename": filename,
                "format": format,
                "record_count": record_count,
                "download_url": download_url,
            },
            priority=EventPriority.HIGH,
            title=f"Export Complete",
            message=f"Your {format.upper()} export ({filename}) is ready to download.",
        )

    def create_export_failed_event(
        self,
        user_id: UUID,
        export_id: str,
        reason: str,
    ) -> NotificationEvent:
        """Create export failure event.

        Args:
            user_id: Target user
            export_id: Export job ID
            reason: Failure reason

        Returns:
            NotificationEvent
        """

        return NotificationEvent(
            event_type=EventType.EXPORT_FAILED,
            user_id=user_id,
            data={
                "export_id": export_id,
                "reason": reason,
            },
            priority=EventPriority.HIGH,
            title="Export Failed",
            message=f"Export failed: {reason}",
        )

    def create_approval_requested_event(
        self,
        user_id: UUID,
        request_id: str,
        project_id: str,
        requester_name: str,
    ) -> NotificationEvent:
        """Create approval request event.

        Args:
            user_id: Target approver user
            request_id: Approval request ID
            project_id: Associated project
            requester_name: Name of requester

        Returns:
            NotificationEvent
        """

        return NotificationEvent(
            event_type=EventType.APPROVAL_REQUESTED,
            user_id=user_id,
            data={
                "request_id": request_id,
                "project_id": project_id,
                "requester_name": requester_name,
            },
            priority=EventPriority.CRITICAL,
            title="Approval Requested",
            message=f"{requester_name} requested approval for a project.",
        )

    def create_approval_completed_event(
        self,
        user_id: UUID,
        request_id: str,
        approved: bool,
        approver_name: str,
    ) -> NotificationEvent:
        """Create approval completion event.

        Args:
            user_id: Target user
            request_id: Approval request ID
            approved: Whether approved or rejected
            approver_name: Name of approver

        Returns:
            NotificationEvent
        """

        action = "Approved" if approved else "Rejected"
        return NotificationEvent(
            event_type=EventType.APPROVAL_COMPLETED,
            user_id=user_id,
            data={
                "request_id": request_id,
                "approved": approved,
                "approver_name": approver_name,
            },
            priority=EventPriority.HIGH,
            title=f"Approval {action}",
            message=f"{approver_name} {action.lower()} the approval request.",
        )

    def create_rate_changed_event(
        self,
        user_id: UUID,
        loan_id: str,
        old_rate: float,
        new_rate: float,
    ) -> NotificationEvent:
        """Create rate change event.

        Args:
            user_id: Target user
            loan_id: Loan account ID
            old_rate: Previous rate
            new_rate: New rate

        Returns:
            NotificationEvent
        """

        return NotificationEvent(
            event_type=EventType.RATE_CHANGED,
            user_id=user_id,
            data={
                "loan_id": loan_id,
                "old_rate": old_rate,
                "new_rate": new_rate,
                "change": new_rate - old_rate,
            },
            priority=EventPriority.MEDIUM,
            title="Rate Updated",
            message=f"Interest rate changed from {old_rate}% to {new_rate}%.",
        )

    def create_project_updated_event(
        self,
        user_id: UUID,
        project_id: str,
        project_name: str,
        changes: Dict[str, Any],
    ) -> NotificationEvent:
        """Create project update event.

        Args:
            user_id: Target user
            project_id: Project ID
            project_name: Project name
            changes: Dictionary of changed fields

        Returns:
            NotificationEvent
        """

        return NotificationEvent(
            event_type=EventType.PROJECT_UPDATED,
            user_id=user_id,
            data={
                "project_id": project_id,
                "project_name": project_name,
                "changes": changes,
            },
            priority=EventPriority.MEDIUM,
            title="Project Updated",
            message=f"Project '{project_name}' was updated.",
        )

    def create_system_alert_event(
        self,
        user_id: UUID,
        alert_type: str,
        message: str,
    ) -> NotificationEvent:
        """Create system alert event.

        Args:
            user_id: Target user
            alert_type: Type of alert
            message: Alert message

        Returns:
            NotificationEvent
        """

        return NotificationEvent(
            event_type=EventType.SYSTEM_ALERT,
            user_id=user_id,
            data={
                "alert_type": alert_type,
            },
            priority=EventPriority.HIGH,
            title=f"System Alert: {alert_type}",
            message=message,
        )

    async def queue_event(self, event: NotificationEvent) -> None:
        """Queue event for user.

        Args:
            event: Event to queue
        """

        user_id = event.user_id

        if user_id not in self.event_queue:
            self.event_queue[user_id] = []

        self.event_queue[user_id].append(event)
        logger.info(f"Event queued for {user_id}: {event.event_type.value}")

    async def get_pending_events(self, user_id: UUID) -> List[NotificationEvent]:
        """Get and clear pending events for user.

        Args:
            user_id: Target user

        Returns:
            List of queued events
        """

        events = self.event_queue.get(user_id, [])
        self.event_queue[user_id] = []
        return events

    async def subscribe(self, user_id: UUID, websocket: Any) -> None:
        """Subscribe user to notifications.

        Args:
            user_id: User ID
            websocket: WebSocket connection object
        """

        if user_id not in self.subscribers:
            self.subscribers[user_id] = []

        self.subscribers[user_id].append(websocket)
        logger.info(f"User {user_id} subscribed to notifications")

    async def unsubscribe(self, user_id: UUID, websocket: Any) -> None:
        """Unsubscribe user from notifications.

        Args:
            user_id: User ID
            websocket: WebSocket connection object
        """

        if user_id in self.subscribers:
            try:
                self.subscribers[user_id].remove(websocket)
                logger.info(f"User {user_id} unsubscribed from notifications")
            except ValueError:
                pass

    async def broadcast_to_user(
        self,
        event: NotificationEvent,
    ) -> int:
        """Broadcast event to all connections of a user.

        Args:
            event: Event to broadcast

        Returns:
            Number of recipients who received the event
        """

        user_id = event.user_id
        websockets = self.subscribers.get(user_id, [])

        if not websockets:
            # No active connections, queue for later
            await self.queue_event(event)
            logger.info(f"Event queued (no active subscribers): {event.event_type.value}")
            return 0

        count = 0
        for websocket in websockets:
            try:
                await websocket.send_json(event.to_dict())
                count += 1
            except Exception as e:
                logger.error(f"Error sending notification: {e}")
                # Connection might be dead, remove it
                try:
                    await self.unsubscribe(user_id, websocket)
                except Exception:
                    pass

        logger.info(f"Event broadcast to {count} subscribers")
        return count

    async def broadcast_to_role(
        self,
        event: NotificationEvent,
        role: str,
        user_ids: List[UUID],
    ) -> int:
        """Broadcast event to all users with a specific role.

        Args:
            event: Event to broadcast
            role: Target role
            user_ids: List of user IDs with that role

        Returns:
            Number of recipients
        """

        count = 0
        for user_id in user_ids:
            event.user_id = user_id
            count += await self.broadcast_to_user(event)

        return count

    def get_connection_count(self, user_id: UUID) -> int:
        """Get number of active connections for user.

        Args:
            user_id: User ID

        Returns:
            Number of connections
        """

        return len(self.subscribers.get(user_id, []))

    def get_total_connections(self) -> int:
        """Get total number of active connections.

        Returns:
            Total connection count
        """

        return sum(len(conns) for conns in self.subscribers.values())


# Global instance
notification_service = NotificationService()
