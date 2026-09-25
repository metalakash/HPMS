"""FastAPI authentication middleware and security utilities.

Handles JWT token validation, user context injection, and role-based access control.
"""

import logging
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.app.config import settings
from backend.app.security.ldap_provider import ADUser, UserRole

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer()


class TokenManager:
    """Manage JWT token generation and validation."""

    ALGORITHM = "HS256"
    TOKEN_EXPIRY_MINUTES = 480  # 8 hours

    @staticmethod
    def create_token(ad_user: ADUser, user_id: UUID) -> str:
        """Create JWT token from AD user.

        Args:
            ad_user: Authenticated AD user
            user_id: Primary key of the user's row in the ``user`` table

        Returns:
            JWT token string
        """

        payload = {
            **ad_user.to_dict(),
            # JWT subject: the DB user id. DB rows (MFA, preferences) and
            # WebSocket routing are keyed by this UUID, not the AD username.
            "sub": str(user_id),
            "exp": datetime.utcnow() + timedelta(minutes=TokenManager.TOKEN_EXPIRY_MINUTES),
            "iat": datetime.utcnow(),
        }

        token = jwt.encode(
            payload,
            settings.JWT_SECRET_KEY,
            algorithm=TokenManager.ALGORITHM,
        )

        logger.info(f"Token created for user {ad_user.username}")
        return token

    @staticmethod
    def verify_token(token: str) -> Optional[dict]:
        """Verify and decode JWT token.

        Args:
            token: JWT token string

        Returns:
            Decoded payload dict, or None if invalid
        """

        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[TokenManager.ALGORITHM],
            )
            return payload
        except JWTError as e:
            logger.warning(f"Token verification failed: {e}")
            return None


class CurrentUser:
    """Dependency to inject current authenticated user into endpoints."""

    def __init__(self, token_payload: dict):
        self.id = token_payload.get("sub")  # JWT subject claim (DB user UUID)
        self.username = token_payload.get("username")
        self.email = token_payload.get("email")
        self.full_name = token_payload.get("full_name")
        self.roles = [UserRole(r) for r in token_payload.get("roles", [])]
        self.is_authenticated = token_payload.get("is_authenticated", False)

    @property
    def uuid(self) -> Optional[UUID]:
        """The user id as a UUID, for DB queries. None if the claim is missing or malformed."""
        try:
            return UUID(self.id) if self.id else None
        except ValueError:
            return None

    def has_role(self, role: UserRole) -> bool:
        """Check if user has a specific role."""
        return role in self.roles or UserRole.ADMIN in self.roles

    def has_any_role(self, roles: list) -> bool:
        """Check if user has any of the specified roles."""
        return any(self.has_role(r) for r in roles)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    """Dependency to extract and validate current user from JWT token.

    Args:
        credentials: HTTP Bearer token

    Returns:
        CurrentUser object

    Raises:
        HTTPException: 401 if token invalid or expired
    """

    token = credentials.credentials
    payload = TokenManager.verify_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = CurrentUser(payload)
    if not user.is_authenticated or user.uuid is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated",
        )

    return user


async def get_current_user_optional(request: Request) -> Optional[CurrentUser]:
    """Optional dependency (for public endpoints).

    Returns CurrentUser if token present and valid, None otherwise.
    """

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    payload = TokenManager.verify_token(token)

    if payload is None:
        return None

    return CurrentUser(payload)


def require_role(*roles: UserRole):
    """Dependency factory to require specific roles.

    Args:
        *roles: One or more UserRole enums required

    Returns:
        Dependency function
    """

    async def check_role(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not user.has_any_role(list(roles)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User lacks required role: {[r.value for r in roles]}",
            )
        return user

    return check_role


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency to require admin role."""

    if not user.has_role(UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user


def require_maker_or_approver(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency to require maker or approver role."""

    if not user.has_any_role([UserRole.MAKER, UserRole.APPROVER]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Maker or Approver role required",
        )
    return user
