"""Row-Level Security (RLS) service for data authorization.

Enforces user-scoped visibility: users see only authorized projects.
"""

import logging
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from backend.app.models.project import Project
from backend.app.models.auth import User, ProjectOwner, UserRole
from backend.app.security.auth_middleware import CurrentUser

logger = logging.getLogger(__name__)


class RLSService:
    """Manage row-level security authorization."""

    @staticmethod
    async def get_authorized_project_ids(
        db: AsyncSession,
        user: CurrentUser,
    ) -> List[UUID]:
        """Get list of project IDs the user can access.

        Authorization rules:
        - ADMIN: All projects
        - MAKER: Projects they created + consortium projects
        - APPROVER: Projects with pending approvals for them
        - AUDITOR: All projects (read-only)
        - GUEST: No projects

        Args:
            db: Database session
            user: Current authenticated user

        Returns:
            List of project UUIDs user can access
        """

        # Admin and auditor see all
        if user.has_any_role([UserRole.ADMIN, UserRole.AUDITOR]):
            query = select(Project.id)
            result = await db.execute(query)
            return [row[0] for row in result.all()]

        # Guest sees nothing
        if user.has_role(UserRole.GUEST):
            return []

        # Maker/Approver see projects they own or are members of
        authorized_ids = []

        # Get projects where user is owner (direct or via consortium)
        owner_query = select(ProjectOwner.project_id).where(
            ProjectOwner.user_id == user.user_id
        )
        owner_result = await db.execute(owner_query)
        authorized_ids.extend([row[0] for row in owner_result.all()])

        # Approvers also see projects with pending approvals for them
        if user.has_role(UserRole.APPROVER):
            from backend.app.models.governance import ApprovalRequest
            approval_query = select(Project.id).where(
                and_(
                    ApprovalRequest.approver_id == user.user_id,
                    ApprovalRequest.status == "pending",
                )
            ).distinct()
            approval_result = await db.execute(approval_query)
            authorized_ids.extend([row[0] for row in approval_result.all()])

        return list(set(authorized_ids))  # Remove duplicates

    @staticmethod
    async def can_view_project(
        db: AsyncSession,
        user: CurrentUser,
        project_id: UUID,
    ) -> bool:
        """Check if user can view a specific project.

        Args:
            db: Database session
            user: Current user
            project_id: Project to check access for

        Returns:
            True if user can access project, False otherwise
        """

        # Admin and auditor can view all
        if user.has_any_role([UserRole.ADMIN, UserRole.AUDITOR]):
            return True

        # Guest cannot view anything
        if user.has_role(UserRole.GUEST):
            return False

        # Check if user is project owner
        authorized_ids = await RLSService.get_authorized_project_ids(db, user)
        return project_id in authorized_ids

    @staticmethod
    async def can_create_project(user: CurrentUser) -> bool:
        """Check if user can create projects.

        Args:
            user: Current user

        Returns:
            True if user can create, False otherwise
        """

        # Only admin and maker can create
        return user.has_any_role([UserRole.ADMIN, UserRole.MAKER])

    @staticmethod
    async def can_approve_project(user: CurrentUser) -> bool:
        """Check if user can approve projects.

        Args:
            user: Current user

        Returns:
            True if user can approve, False otherwise
        """

        # Only admin and approver can approve
        return user.has_any_role([UserRole.ADMIN, UserRole.APPROVER])

    @staticmethod
    async def can_update_project(
        db: AsyncSession,
        user: CurrentUser,
        project_id: UUID,
    ) -> bool:
        """Check if user can update a project.

        Args:
            db: Database session
            user: Current user
            project_id: Project to update

        Returns:
            True if user can update, False otherwise
        """

        # Admin can update any project
        if user.has_role(UserRole.ADMIN):
            return True

        # Maker can update projects they own
        if user.has_role(UserRole.MAKER):
            owner_query = select(ProjectOwner).where(
                and_(
                    ProjectOwner.user_id == user.user_id,
                    ProjectOwner.project_id == project_id,
                )
            )
            result = await db.execute(owner_query)
            return result.scalar_one_or_none() is not None

        return False

    @staticmethod
    async def can_delete_project(
        db: AsyncSession,
        user: CurrentUser,
        project_id: UUID,
    ) -> bool:
        """Check if user can delete a project.

        Args:
            db: Database session
            user: Current user
            project_id: Project to delete

        Returns:
            True if user can delete, False otherwise
        """

        # Only admin can delete
        if not user.has_role(UserRole.ADMIN):
            return False

        return True

    @staticmethod
    async def assign_project_ownership(
        db: AsyncSession,
        user_id: UUID,
        project_id: UUID,
        ownership_type: str = "direct",
    ) -> ProjectOwner:
        """Assign project ownership to a user.

        Args:
            db: Database session
            user_id: User to assign ownership to
            project_id: Project to assign
            ownership_type: Type of ownership (direct, consortium_member, lead_bank)

        Returns:
            Created ProjectOwner record
        """

        owner = ProjectOwner(
            user_id=user_id,
            project_id=project_id,
            ownership_type=ownership_type,
        )

        db.add(owner)
        await db.flush()

        logger.info(
            f"Assigned {ownership_type} project ownership: "
            f"user_id={user_id}, project_id={project_id}"
        )

        return owner

    @staticmethod
    async def remove_project_ownership(
        db: AsyncSession,
        user_id: UUID,
        project_id: UUID,
    ) -> bool:
        """Remove project ownership from a user.

        Args:
            db: Database session
            user_id: User to remove ownership from
            project_id: Project to remove

        Returns:
            True if ownership was removed, False if not found
        """

        query = select(ProjectOwner).where(
            and_(
                ProjectOwner.user_id == user_id,
                ProjectOwner.project_id == project_id,
            )
        )

        result = await db.execute(query)
        owner = result.scalar_one_or_none()

        if owner is None:
            return False

        await db.delete(owner)
        await db.flush()

        logger.info(
            f"Removed project ownership: "
            f"user_id={user_id}, project_id={project_id}"
        )

        return True

    @staticmethod
    def apply_rls_filter(query, user: CurrentUser, authorized_ids: List[UUID]):
        """Apply RLS filter to a query.

        Args:
            query: SQLAlchemy query to filter
            user: Current user
            authorized_ids: List of authorized project IDs

        Returns:
            Filtered query
        """

        # Admin/auditor see all
        if user.has_any_role([UserRole.ADMIN, UserRole.AUDITOR]):
            return query

        # Guest sees nothing
        if user.has_role(UserRole.GUEST):
            return query.where(Project.id == None)  # Empty result

        # Filter to authorized projects
        return query.where(Project.id.in_(authorized_ids))
