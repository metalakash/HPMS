"""FastAPI authentication middleware and security utilities.

Handles JWT token validation, user context injection, and role-based access control.
"""

import logging
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta
import uuid

import jwt  # PyJWT: maintained; replaces python-jose (unmaintained, PYSEC-2026-4298)
from jwt import PyJWTError as JWTError
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.security.ldap_provider import ADUser, UserRole

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer()


class TokenManager:
    """Manage JWT token generation and validation."""

    ALGORITHM = "HS256"
    TOKEN_EXPIRY_MINUTES = settings.JWT_EXPIRY_MINUTES  # 480 (8 hours) unless set; it was fixed at 480 before
    CHALLENGE_EXPIRY_MINUTES = 5  # password accepted, second factor still owed
    CHALLENGE_TYPE = "mfa_challenge"

    @staticmethod
    def create_token(ad_user: ADUser, user_id: UUID, mfa_enrolment_pending: bool = False) -> str:
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
            "jti": uuid.uuid4().hex,  # this token's id, so signing out can revoke it
        }
        if mfa_enrolment_pending:
            payload["mfa_enrol"] = True  # the role requires MFA and it is not set up: only enrolment is open

        token = jwt.encode(
            payload,
            settings.JWT_SECRET_KEY,
            algorithm=TokenManager.ALGORITHM,
        )

        logger.info(f"Token created for user {ad_user.username}")
        return token

    @staticmethod
    def create_challenge_token(ad_user: ADUser, user_id: UUID) -> str:
        """Short-lived token proving the password was accepted. It is *not* an access token:
        ``verify_token`` rejects it, so it only works at ``/auth/login/mfa``."""
        payload = {
            **ad_user.to_dict(),
            "is_authenticated": False,
            "typ": TokenManager.CHALLENGE_TYPE,
            "sub": str(user_id),
            "exp": datetime.utcnow() + timedelta(minutes=TokenManager.CHALLENGE_EXPIRY_MINUTES),
            "iat": datetime.utcnow(),
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=TokenManager.ALGORITHM)

    @staticmethod
    def verify_challenge_token(token: str) -> Optional[dict]:
        """Payload of a valid, unexpired MFA challenge token; None for anything else (including access tokens)."""
        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[TokenManager.ALGORITHM])
        except JWTError:
            return None
        return payload if payload.get("typ") == TokenManager.CHALLENGE_TYPE else None

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
                options={"require": ["exp", "sub"]},
            )
            if payload.get("typ") == TokenManager.CHALLENGE_TYPE:
                logger.warning("MFA challenge token presented as an access token")
                return None
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


# While MFA enrolment is pending, only these paths answer: setting it up, and signing out
MFA_ENROLMENT_PATHS = ("/api/v1/mfa/", "/api/v1/auth/me", "/api/v1/auth/logout")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security),
                           db=Depends(get_db), request: Request = None) -> CurrentUser:
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
    if settings.DB_ROW_SECURITY and hasattr(db, "sync_session"):
        # From the next transaction on, PostgreSQL's row policies see this user (migration 033)
        from backend.app.security.db_row_security import describe_user
        describe_user(db, user.uuid, user.roles)
    if await _is_blocked(db, user.uuid):
        # A blocked account loses its open sessions at once, not when the token expires
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is disabled")
    if await _is_revoked(db, payload.get("jti")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Signed out; sign in again")
    path = request.url.path if request is not None else ""
    if payload.get("mfa_enrol") and not path.startswith(MFA_ENROLMENT_PATHS):
        # Enforced, not just flagged: the role requires two-step sign-in. Lifted the moment it is set up.
        if not await _mfa_enabled(db, user.uuid):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Your role requires two-step sign-in. Set it up on the Security page first.")

    return user


async def _is_blocked(db, user_id: UUID) -> bool:
    from sqlalchemy import select
    from backend.app.models.auth import User

    try:
        active = (await db.execute(select(User.is_active).where(User.id == user_id))).scalar_one_or_none()
    except Exception as error:  # the route will fail on the same database anyway; do not mask that with a 401
        logger.warning("Could not check account status: %s", error)
        return False
    return active is False


async def _mfa_enabled(db, user_id) -> bool:
    from sqlalchemy import select
    from backend.app.models.mfa import UserMFA

    try:
        return bool((await db.execute(select(UserMFA.is_mfa_enabled).where(UserMFA.user_id == user_id))).scalar())
    except Exception as error:
        logger.warning("Could not check MFA enrolment: %s", error)
        return False


async def _is_revoked(db, jti) -> bool:
    """Whether this token was signed out. Tokens issued before token ids existed cannot be revoked this way."""
    if not jti:
        return False
    from sqlalchemy import select
    from backend.app.models.auth import RevokedToken

    try:
        return (await db.execute(select(RevokedToken.jti).where(RevokedToken.jti == str(jti)))).first() is not None
    except Exception as error:
        logger.warning("Could not check token revocation: %s", error)
        return False


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
