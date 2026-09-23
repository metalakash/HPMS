"""Audit logging for compliance (Phase 5 Task 1)."""

import logging
from typing import Dict, List, Optional
from uuid import UUID
from datetime import datetime

from .models import AuditLogEntry

logger = logging.getLogger(__name__)


class AuditLogger:
    """Immutable audit trail logging."""

    def __init__(self):
        """Initialize audit logger."""
        self.logs: Dict[UUID, AuditLogEntry] = {}

    def log(
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
            actor_id: User ID
            actor_name: User/system name
            details: Action details
            result: Action result (success, failure, pending)

        Returns:
            Created audit log entry
        """
        try:
            entry = AuditLogEntry(
                log_id=__import__('uuid').uuid4(),
                covenant_id=covenant_id,
                project_id=project_id,
                action=action,
                actor_id=actor_id,
                actor_name=actor_name,
                details=details or {},
                result=result,
            )

            self.logs[entry.log_id] = entry

            logger.info(
                f"Audit log: {action} for covenant {covenant_id} by {actor_name}"
            )
            return entry

        except Exception as e:
            logger.error(f"Error logging audit entry: {e}")
            raise

    def get_trail(
        self, covenant_id: UUID, limit: int = 100, offset: int = 0
    ) -> List[AuditLogEntry]:
        """Get audit trail for covenant.

        Args:
            covenant_id: Covenant to get trail for
            limit: Maximum entries
            offset: Pagination offset

        Returns:
            List of audit entries, newest first
        """
        try:
            entries = [
                e for e in self.logs.values()
                if e.covenant_id == covenant_id
            ]

            # Sort by timestamp, newest first
            entries = sorted(entries, key=lambda x: x.timestamp, reverse=True)

            return entries[offset : offset + limit]

        except Exception as e:
            logger.error(f"Error retrieving audit trail: {e}")
            return []

    def get_trail_by_action(
        self, covenant_id: UUID, action: str, limit: int = 50
    ) -> List[AuditLogEntry]:
        """Get audit entries for specific action.

        Args:
            covenant_id: Covenant to filter
            action: Action type to find
            limit: Maximum entries

        Returns:
            List of matching entries
        """
        try:
            entries = [
                e for e in self.logs.values()
                if e.covenant_id == covenant_id and e.action == action
            ]

            entries = sorted(entries, key=lambda x: x.timestamp, reverse=True)
            return entries[:limit]

        except Exception as e:
            logger.error(f"Error retrieving action audit trail: {e}")
            return []

    def get_trail_by_actor(
        self, actor_id: UUID, limit: int = 50
    ) -> List[AuditLogEntry]:
        """Get audit entries for specific actor.

        Args:
            actor_id: User ID to filter
            limit: Maximum entries

        Returns:
            List of entries by actor
        """
        try:
            entries = [
                e for e in self.logs.values()
                if e.actor_id == actor_id
            ]

            entries = sorted(entries, key=lambda x: x.timestamp, reverse=True)
            return entries[:limit]

        except Exception as e:
            logger.error(f"Error retrieving actor audit trail: {e}")
            return []

    def export_trail(
        self, covenant_id: UUID, format: str = "json"
    ) -> str:
        """Export audit trail in format.

        Args:
            covenant_id: Covenant to export
            format: Export format (json, csv)

        Returns:
            Formatted export string
        """
        try:
            entries = self.get_trail(covenant_id, limit=10000)

            if format == "csv":
                lines = [
                    "timestamp,action,actor_name,result,details"
                ]
                for e in entries:
                    details_str = str(e.details).replace('"', '""')
                    lines.append(
                        f'{e.timestamp.isoformat()},"{e.action}","{e.actor_name}","{e.result}","{details_str}"'
                    )
                return "\n".join(lines)
            else:
                import json
                return json.dumps(
                    [e.to_dict() for e in entries],
                    indent=2
                )

        except Exception as e:
            logger.error(f"Error exporting audit trail: {e}")
            return ""
