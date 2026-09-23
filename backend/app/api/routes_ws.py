"""WebSocket endpoints for real-time notifications.

Persistent connections for push notifications and live updates.
"""

import logging
import asyncio
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthCredentials

from backend.app.security.auth_middleware import TokenManager
from backend.app.websocket.ws_handler import (
    WebSocketConnectionHandler,
    connection_manager,
    MessageType,
)
from backend.app.services.notification_service import notification_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])

# HTTP Bearer for WebSocket auth
security = HTTPBearer()


@router.websocket("/notifications")
async def websocket_notifications(websocket: WebSocket):
    """WebSocket endpoint for real-time notifications.

    Connection URL: ws://localhost:8000/ws/notifications?token=<JWT_TOKEN>

    Features:
    - Subscribe to real-time notifications
    - Auto-reconnect with pending message replay
    - Heartbeat to detect stale connections
    - Message acknowledgment

    Message Types:
    - subscribe: Subscribe to notifications
    - unsubscribe: Unsubscribe from notifications
    - ack: Acknowledge receipt of message
    - heartbeat: Server-sent heartbeat
    - event: Notification event
    - error: Error message

    Example JavaScript:
    ```javascript
    const ws = new WebSocket(
      `ws://localhost:8000/ws/notifications?token=${jwtToken}`
    );

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'event') {
        console.log('Notification:', message.data);
      }
    };

    ws.send(JSON.stringify({
      type: 'subscribe',
      message_id: 'msg-1'
    }));
    ```
    """

    # Extract JWT token from query parameters
    token = websocket.query_params.get("token")

    if not token:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Missing authentication token",
        )
        logger.warning("WebSocket connection rejected: no token")
        return

    # Validate JWT token
    try:
        payload = TokenManager.verify_token(token)
        user_id = payload.get("sub")

        if not user_id:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Invalid token payload",
            )
            logger.warning("WebSocket connection rejected: invalid token")
            return

        from uuid import UUID

        user_id = UUID(user_id)

    except Exception as e:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Invalid or expired token",
        )
        logger.warning(f"WebSocket connection rejected: {e}")
        return

    # Create connection handler
    handler = WebSocketConnectionHandler(websocket, user_id)

    try:
        # Accept connection
        await handler.accept()
        await connection_manager.register(handler)

        # Send welcome message
        await handler.send_message(
            MessageType.SUBSCRIBE,
            {
                "status": "connected",
                "user_id": str(user_id),
                "server_time": datetime.utcnow().isoformat() + "Z",
            },
        )

        # Start heartbeat task
        heartbeat_task = asyncio.create_task(heartbeat_loop(handler))

        # Auto-subscribe to notifications
        await handler.subscribe()

        # Main message receive loop
        while handler.connected:
            try:
                message = await handler.receive_message()

                if not message:
                    break

                message_type = message.get("type")
                message_id = message.get("message_id")

                if message_type == "subscribe":
                    await handler.subscribe()

                elif message_type == "unsubscribe":
                    await handler.unsubscribe()

                elif message_type == "ack":
                    # Client acknowledges receipt
                    await handler.acknowledge_message(message_id)
                    logger.debug(f"Message acknowledged: {message_id}")

                elif message_type == "ping":
                    # Client ping -> server pong
                    await handler.send_message(
                        MessageType.HEARTBEAT,
                        {"type": "pong"},
                    )

                else:
                    logger.warning(f"Unknown message type: {message_type}")

            except WebSocketDisconnect:
                break

            except Exception as e:
                logger.error(f"Error processing message: {e}")
                await handler.send_error(str(e))
                break

    except Exception as e:
        logger.error(f"WebSocket error: {e}")

    finally:
        # Cleanup
        heartbeat_task.cancel()
        await handler.unsubscribe()
        await handler.close()
        await connection_manager.unregister(handler)
        logger.info(f"WebSocket closed for user {user_id}")


async def heartbeat_loop(handler: WebSocketConnectionHandler) -> None:
    """Send periodic heartbeat to keep connection alive.

    Args:
        handler: Connection handler
    """

    heartbeat_interval = 30  # seconds

    try:
        while handler.connected:
            await asyncio.sleep(heartbeat_interval)
            await handler.send_heartbeat()

    except asyncio.CancelledError:
        logger.debug("Heartbeat task cancelled")

    except Exception as e:
        logger.error(f"Heartbeat error: {e}")


@router.get("/stats")
async def websocket_stats():
    """Get WebSocket connection statistics.

    Returns:
        Dictionary with connection metrics
    """

    total_connections = connection_manager.get_total_connections()
    active_users = connection_manager.get_all_users_connected()

    return {
        "total_connections": total_connections,
        "active_users": len(active_users),
        "notification_queue_size": sum(
            len(events) for events in notification_service.event_queue.values()
        ),
        "active_user_ids": [str(uid) for uid in active_users],
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/user/{user_id}/connections")
async def get_user_connections(user_id: str):
    """Get active connections for a user.

    Args:
        user_id: UUID string

    Returns:
        Connection information
    """

    from uuid import UUID

    try:
        uid = UUID(user_id)
        count = connection_manager.get_connection_count(uid)
        pending = len(notification_service.event_queue.get(uid, []))

        return {
            "user_id": user_id,
            "active_connections": count,
            "pending_notifications": pending,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

    except Exception as e:
        logger.error(f"Error getting user connections: {e}")
        return {
            "error": str(e),
            "user_id": user_id,
        }


@router.post("/broadcast-test")
async def broadcast_test_notification(
    user_id: str,
    message: str = "Test notification",
):
    """Send test notification to user (development only).

    Args:
        user_id: Target user UUID
        message: Test message

    Returns:
        Broadcast result
    """

    from uuid import UUID

    try:
        uid = UUID(user_id)

        event = notification_service.create_system_alert_event(
            user_id=uid,
            alert_type="test",
            message=message,
        )

        count = await notification_service.broadcast_to_user(event)

        return {
            "status": "sent",
            "user_id": user_id,
            "recipients": count,
            "message_id": event.id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

    except Exception as e:
        logger.error(f"Error broadcasting test notification: {e}")
        return {
            "error": str(e),
            "user_id": user_id,
        }
