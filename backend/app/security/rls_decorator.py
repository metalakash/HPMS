"""RLS decorators for protecting endpoints with row-level security."""

import logging
from functools import wraps
from typing import Callable, Optional
from uuid import UUID

from fastapi import HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.security.rls_service import RLSService

logger = logging.getLogger(__name__)


def require_project_access(
    project_id_param: str = "project_id",
):
    """Decorator to require access to a specific project.

    Args:
        project_id_param: Name of route parameter containing project ID

    Usage:
        @router.get("/projects/{project_id}")
        @require_project_access("project_id")
        async def get_project(
            project_id: UUID,
            user: CurrentUser = Depends(get_current_user),
            db: AsyncSession = Depends(get_db),
        ):
            ...
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract user and db from kwargs (passed by FastAPI)
            user = kwargs.get("user")
            db = kwargs.get("db")
            project_id = kwargs.get(project_id_param)

            if not user or not db or not project_id:
                logger.error(f"RLS check missing parameters: user={user}, db={db}, project_id={project_id}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="RLS check failed",
                )

            # Check access
            can_access = await RLSService.can_view_project(db, user, project_id)
            if not can_access:
                logger.warning(
                    f"RLS denial: user {user.username} attempted access to "
                    f"project {project_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not have permission to view this project",
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_project_update(
    project_id_param: str = "project_id",
):
    """Decorator to require permission to update a project.

    Args:
        project_id_param: Name of route parameter containing project ID
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user = kwargs.get("user")
            db = kwargs.get("db")
            project_id = kwargs.get(project_id_param)

            if not user or not db or not project_id:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="RLS check failed",
                )

            # Check update permission
            can_update = await RLSService.can_update_project(db, user, project_id)
            if not can_update:
                logger.warning(
                    f"RLS denial: user {user.username} attempted update to "
                    f"project {project_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not have permission to update this project",
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_project_delete(
    project_id_param: str = "project_id",
):
    """Decorator to require permission to delete a project.

    Args:
        project_id_param: Name of route parameter containing project ID
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user = kwargs.get("user")
            db = kwargs.get("db")
            project_id = kwargs.get(project_id_param)

            if not user or not db or not project_id:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="RLS check failed",
                )

            # Check delete permission
            can_delete = await RLSService.can_delete_project(db, user, project_id)
            if not can_delete:
                logger.warning(
                    f"RLS denial: user {user.username} attempted delete of "
                    f"project {project_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Only admins can delete projects",
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


async def get_authorized_projects_filter(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> tuple[CurrentUser, AsyncSession, list]:
    """Dependency to get authorized project IDs for filtering list queries.

    Returns:
        (user, db, authorized_project_ids)
    """

    authorized_ids = await RLSService.get_authorized_project_ids(db, user)
    return user, db, authorized_ids
