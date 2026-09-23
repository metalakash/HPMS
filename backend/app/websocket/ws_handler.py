"""WebSocket connection handler for real-time notifications.

Manages persistent connections, message routing, and reconnection logic.
"""

import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from uuid import UUID
from enum import Enum

from fastapi import WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.services.notification_service import (
    notification_service,
    NotificationEvent,
)

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    """WebSocket message types."""
    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"
    ACK = "ack"
    HEARTBEAT = "heartbeat"
    EVENT = "event"
    ERROR = "error"
    RECONNECT = "reconnect"


class WebSocketMessage:
    """Represents a WebSocket message."""

    def __init__(
        self,
        message_type: MessageType,
        data: Optional[Dict[str, Any]] = None,
        message_id: Optional[str] = None,
    ):
        """Initialize message.

        Args:
            message_type: Type of message
            data: Message payload
            message_id: Unique message ID for acknowledgment
        """

        self.message_type = message_type
        self.data = data or {}
        self.message_id = message_id
        self.timestamp = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary.

        Returns:
            Dictionary representation
        """

        return {
            "type": self.message_type.value,
            "data": self.data,
            "message_id": self.message_id,
            "timestamp": self.timestamp.isoformat() + "Z",
        }


class WebSocketConnectionHandler:
    """Handles WebSocket connections and subscriptions."""

    def __init__(self, websocket: WebSocket, user_id: UUID):
        """Initialize connection handler.

        Args:
            websocket: FastAPI WebSocket connection
            user_id: Authenticated user ID
        """

        self.websocket = websocket
        self.user_id = user_id
        self.connected = False
        self.connected_at = None
        self.last_heartbeat = None
        self.message_counter = 0
        self.subscribed = False
        self.pending_messages: asyncio.Queue = asyncio.Queue()

    async def accept(self) -> None:
        """Accept WebSocket connection.

        Raises:
            WebSocketDisconnect: If connection fails
        """

        try:
            await self.websocket.accept()
            self.connected = True
            self.connected_at = datetime.utcnow()
            logger.info(f"WebSocket connected for user {self.user_id}")

        except Exception as e:
            logger.error(f"Failed to accept WebSocket: {e}")
            raise

    async def close(self, code: int = 1000) -> None:
        """Close WebSocket connection.

        Args:
            code: Close code (1000 = normal closure)
        """

        if self.connected:
            try:
                await self.websocket.close(code=code)
                self.connected = False
                logger.info(f"WebSocket closed for user {self.user_id}")

            except Exception as e:
                logger.error(f"Error closing WebSocket: {e}")

    async def subscribe(self) -> None:
        """Subscribe user to notifications.

        Registers connection with notification service.
        """

        try:
            await notification_service.subscribe(self.user_id, self.websocket)
            self.subscribed = True

            # Send pending events that accumulated while offline
            pending = await notification_service.get_pending_events(self.user_id)
            for event in pending:
                await self.send_event(event)

            # Send subscription confirmation
            await self.send_message(
                MessageType.SUBSCRIBE,
                {
                    "status": "subscribed",
                    "user_id": str(self.user_id),
                    "pending_events": len(pending),
                },
            )

            logger.info(f"User {self.user_id} subscribed to notifications")

        except Exception as e:
            logger.error(f"Error subscribing: {e}")
            await self.send_error("Subscription failed")

    async def unsubscribe(self) -> None:
        """Unsubscribe user from notifications."""

        try:
            await notification_service.unsubscribe(self.user_id, self.websocket)
            self.subscribed = False

            await self.send_message(
                MessageType.UNSUBSCRIBE,
                {"status": "unsubscribed"},
            )

            logger.info(f"User {self.user_id} unsubscribed from notifications")

        except Exception as e:
            logger.error(f"Error unsubscribing: {e}")

    async def send_message(
        self,
        message_type: MessageType,
        data: Dict[str, Any],
        message_id: Optional[str] = None,
    ) -> None:
        """Send message to client.

        Args:
            message_type: Type of message
            data: Message payload
            message_id: Unique message ID for acknowledgment
        """

        try:
            if not self.connected:
                logger.warning("Cannot send message: connection closed")
                return

            message = WebSocketMessage(message_type, data, message_id)
            await self.websocket.send_json(message.to_dict())
            self.message_counter += 1

        except Exception as e:
            logger.error(f"Error sending message: {e}")
            self.connected = False

    async def send_event(self, event: NotificationEvent) -> None:
        """Send notification event to client.

        Args:
            event: Notification event
        """

        await self.send_message(
            MessageType.EVENT,
            event.to_dict(),
            message_id=event.id,
        )

    async def send_error(self, error_message: str) -> None:
        """Send error message to client.

        Args:
            error_message: Error description
        """

        await self.send_message(
            MessageType.ERROR,
            {"error": error_message},
        )

    async def send_heartbeat(self) -> None:
        """Send heartbeat to keep connection alive."""

        try:
            await self.send_message(
                MessageType.HEARTBEAT,
                {
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "connection_duration": (
                        (datetime.utcnow() - self.connected_at).total_seconds()
                        if self.connected_at
                        else 0
                    ),
                },
            )
            self.last_heartbeat = datetime.utcnow()

        except Exception as e:
            logger.error(f"Error sending heartbeat: {e}")
            self.connected = False

    async def receive_message(self) -> Optional[Dict[str, Any]]:
        """Receive message from client.

        Returns:
            Parsed message dictionary or None if disconnected
        """

        try:
            message = await self.websocket.receive_json()
            return message

        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for user {self.user_id}")
            self.connected = False
            return None

        except Exception as e:
            logger.error(f"Error receiving message: {e}")
            self.connected = False
            return None

    async def acknowledge_message(self, message_id: str) -> None:
        """Send acknowledgment for received message.

        Args:
            message_id: ID of message to acknowledge
        """

        await self.send_message(
            MessageType.ACK,
            {"message_id": message_id},
        )

    def get_connection_info(self) -> Dict[str, Any]:
        """Get connection metadata.

        Returns:
            Dictionary with connection info
        """

        return {
            "user_id": str(self.user_id),
            "connected": self.connected,
            "connected_at": self.connected_at.isoformat() if self.connected_at else None,
            "subscribed": self.subscribed,
            "last_heartbeat": (
                self.last_heartbeat.isoformat() if self.last_heartbeat else None
            ),
            "messages_sent": self.message_counter,
            "connection_duration": (
                (datetime.utcnow() - self.connected_at).total_seconds()
                if self.connected_at
                else 0
            ),
        }


class WebSocketConnectionManager:
    """Manages multiple WebSocket connections globally."""

    def __init__(self):
        """Initialize connection manager."""

        self.active_connections: Dict[UUID, list] = {}
        self.lock = asyncio.Lock()

    async def register(self, handler: WebSocketConnectionHandler) -> None:
        """Register new connection.

        Args:
            handler: Connection handler
        """

        async with self.lock:
            user_id = handler.user_id
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []

            self.active_connections[user_id].append(handler)
            logger.info(
                f"Connection registered for {user_id}. "
                f"Active connections: {len(self.active_connections[user_id])}"
            )

    async def unregister(self, handler: WebSocketConnectionHandler) -> None:
        """Unregister connection.

        Args:
            handler: Connection handler
        """

        async with self.lock:
            user_id = handler.user_id
            if user_id in self.active_connections:
                try:
                    self.active_connections[user_id].remove(handler)
                    if not self.active_connections[user_id]:
                        del self.active_connections[user_id]
                    logger.info(f"Connection unregistered for {user_id}")

                except ValueError:
                    pass

    def get_connection_count(self, user_id: UUID) -> int:
        """Get number of active connections for user.

        Args:
            user_id: User ID

        Returns:
            Number of connections
        """

        return len(self.active_connections.get(user_id, []))

    def get_total_connections(self) -> int:
        """Get total number of active connections.

        Returns:
            Total connection count
        """

        return sum(
            len(handlers) for handlers in self.active_connections.values()
        )

    def get_all_users_connected(self) -> list:
        """Get list of all users with active connections.

        Returns:
            List of user IDs
        """

        return list(self.active_connections.keys())


# Global connection manager
connection_manager = WebSocketConnectionManager()
