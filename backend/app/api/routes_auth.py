"""Authentication endpoints for login and token management."""

import logging
from typing import Optional, Union
from pydantic import BaseModel

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi import APIRouter, HTTPException, Request, status, Depends
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.config import settings
from backend.app.security.auth_selection import build_auth_provider
from backend.app.middleware.security import client_ip
from backend.app.models.mfa import UserMFA
from backend.app.security.ldap_provider import ADUser, UserRole
from backend.app.services.mfa_service import MFAService
from backend.app.models.auth import User, UserRole as DBUserRole
from backend.app.security.auth_middleware import TokenManager, CurrentUser, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])

# None when neither Active Directory nor an explicitly allowed demo provider is configured
auth_provider = build_auth_provider(settings)


async def sync_user(db: AsyncSession, ad_user: ADUser) -> User:
    """Create or refresh the DB user row for an authenticated AD user.

    Other tables (MFA, preferences, notifications) reference ``user.id``,
    so every login must resolve to a row.
    """

    result = await db.execute(select(User).where(User.username == ad_user.username))
    user = result.scalar_one_or_none()
    default_role = DBUserRole(ad_user.roles[0].value) if ad_user.roles else DBUserRole.GUEST

    if user is None:
        user = User(username=ad_user.username, created_by="auth")
        db.add(user)

    user.email = ad_user.email
    user.full_name = ad_user.full_name
    user.ad_distinguished_name = ad_user.ad_distinguished_name
    user.is_ad_synced = settings.USE_LDAP
    user.default_role = default_role
    user.last_login_at = date.today()
    user.updated_by = "auth"

    await db.commit()
    await db.refresh(user)
    return user


class LoginRequest(BaseModel):
    """User login request."""
    username: str
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "username": "john.doe",
                "password": "my_secure_password"
            }
        }


class TokenResponse(BaseModel):
    """Login response with JWT token."""
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: dict
    # True when the user's role should have MFA but they have not enrolled; the UI should prompt them to
    mfa_enrollment_required: bool = False


class MFAChallengeResponse(BaseModel):
    """Password accepted, second factor required: finish at POST /auth/login/mfa."""
    mfa_required: bool = True
    mfa_token: str
    expires_in_seconds: int
    methods: list[str] = ["totp", "backup_code"]


class MFALoginRequest(BaseModel):
    mfa_token: str
    code: str  # 6-digit authenticator code, or a backup code like ABCD-1234

    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
                "expires_in_seconds": 28800,
                "user": {
                    "username": "john.doe",
                    "email": "john.doe@sbl.local",
                    "full_name": "John Doe",
                    "roles": ["maker"]
                }
            }
        }


@router.post("/login", response_model=Union[TokenResponse, MFAChallengeResponse])
async def login(request: LoginRequest, http_request: Request, db: AsyncSession = Depends(get_db)):
    """Authenticate user via Active Directory or local dev auth.

    **Phase 3:** Replaces X-User-ID header authentication.

    **Request:**
    - username: Active Directory username (e.g., "john.doe")
    - password: AD password

    **Response:**
    - access_token: JWT token for subsequent requests
    - token_type: Always "bearer"
    - expires_in_seconds: Token validity (8 hours)
    - user: User details (username, email, full_name, roles)

    **Header for subsequent requests:**
    ```
    Authorization: Bearer {access_token}
    ```

    **Error Responses:**
    - 401: Invalid username or password
    - 503: AD server unavailable (dev fallback used)
    """

    if auth_provider is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No authentication provider is configured",
        )

    # Throttling and lockout come before the password is even checked (services/signin_guard.py)
    from backend.app.services import signin_guard
    source_ip = client_ip(http_request.scope, settings.TRUSTED_PROXY_HOPS)
    try:
        await signin_guard.check(db, request.username, source_ip)
    except signin_guard.SignInRefused as refused:
        logger.warning(f"Sign-in refused for {request.username} from {source_ip}: over the failure limit")
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(refused),
                            headers={"Retry-After": str(refused.minutes * 60)})

    # Attempt authentication
    ad_user = await auth_provider.authenticate(request.username, request.password)

    if ad_user is None:
        logger.warning(f"Login failed for user: {request.username}")
        await signin_guard.record(db, request.username, source_ip, "bad_credentials")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    try:
        user = await sync_user(db, ad_user)
    except SQLAlchemyError as e:
        await db.rollback()
        logger.error(f"Could not sync user {request.username} to database: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="User store unavailable",
        )

    if not user.is_active:
        await signin_guard.record(db, request.username, source_ip, "disabled")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )
    if getattr(user, "role_override", None):
        # An admin set this user's role in HPMS; it wins over the directory's until cleared
        ad_user.roles = [UserRole(user.role_override)]

    user_mfa = (await db.execute(select(UserMFA).where(UserMFA.user_id == user.id))).scalar_one_or_none()
    if user_mfa is not None and user_mfa.is_mfa_enabled:
        # Fail closed: MFA is on, so a password alone never yields a session (even if the seed is missing)
        if user_mfa.locked_until is not None and user_mfa.locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                                detail="Too many failed codes. Try again later.")
        logger.info(f"Password accepted for {request.username}; second factor required")
        await signin_guard.record(db, request.username, source_ip, "password_accepted")
        return MFAChallengeResponse(
            mfa_token=TokenManager.create_challenge_token(ad_user, user.id),
            expires_in_seconds=TokenManager.CHALLENGE_EXPIRY_MINUTES * 60,
        )

    await signin_guard.record(db, request.username, source_ip, "success")
    return _issue_token(ad_user, user, mfa_enrollment_required=_needs_enrollment(ad_user))


def _needs_enrollment(ad_user: ADUser) -> bool:
    required = {r.strip().lower() for r in settings.MFA_REQUIRED_ROLES.split(",") if r.strip()}
    return bool(required & {r.value for r in ad_user.roles})


def _issue_token(ad_user: ADUser, user: User, mfa_enrollment_required: bool = False) -> TokenResponse:
    token = TokenManager.create_token(ad_user, user.id, mfa_enrolment_pending=mfa_enrollment_required)
    logger.info(f"Login successful for user: {ad_user.username} with roles: {[r.value for r in ad_user.roles]}")
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_seconds=TokenManager.TOKEN_EXPIRY_MINUTES * 60,
        user={"id": str(user.id), **ad_user.to_dict()},
        mfa_enrollment_required=mfa_enrollment_required,
    )


@router.post("/login/mfa", response_model=TokenResponse)
async def login_mfa(body: MFALoginRequest, http_request: Request, db: AsyncSession = Depends(get_db)):
    """Second login step: the challenge token from ``/login`` plus a TOTP or backup code.

    Five wrong codes lock the account for 15 minutes (429). A TOTP code works once.
    """
    bad_session = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign-in session expired; sign in again")
    payload = TokenManager.verify_challenge_token(body.mfa_token)
    if payload is None:
        raise bad_session
    try:
        user_id = UUID(payload["sub"])
    except (KeyError, ValueError):
        raise bad_session

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    user_mfa = (await db.execute(select(UserMFA).where(UserMFA.user_id == user_id))).scalar_one_or_none()
    if user is None or not user.is_active or user_mfa is None or not user_mfa.is_mfa_enabled:
        raise bad_session

    outcome = await MFAService.verify_second_factor(
        db, user_mfa, body.code, ip=client_ip(http_request.scope, settings.TRUSTED_PROXY_HOPS))
    await db.commit()  # failed-attempt counters and spent backup codes must persist even when we then refuse
    if outcome == "locked":
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Too many failed codes. Try again later.")
    if outcome != "ok":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid code")

    ad_user = ADUser(user.username, payload.get("email"), payload.get("full_name"),
                     [UserRole(r) for r in payload.get("roles", [])])
    from backend.app.services import signin_guard
    await signin_guard.record(db, user.username, client_ip(http_request.scope, settings.TRUSTED_PROXY_HOPS), "success")
    return _issue_token(ad_user, user)


@router.get("/me")
async def get_current_user_info(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get information about the current authenticated user.

    **Response:**
    - id: User UUID (from sub claim)
    - username: AD username
    - email: Email address
    - full_name: Display name
    - roles: List of assigned roles

    **Authorization:**
    - Requires valid Bearer token in Authorization header
    """

    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "roles": [r.value for r in current_user.roles],
    }


@router.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False)),
                 db: AsyncSession = Depends(get_db)):
    """Sign out: the presented token is revoked at once, not left valid until it expires.

    Answers 200 whatever is presented, so a client can always clear its own session.
    """
    from backend.app.models.auth import RevokedToken
    from sqlalchemy import delete as sql_delete

    payload = TokenManager.verify_token(credentials.credentials) if credentials else None
    if payload and payload.get("jti") and payload.get("exp"):
        expires = datetime.fromtimestamp(int(payload["exp"]), tz=timezone.utc)
        await db.execute(sql_delete(RevokedToken).where(RevokedToken.expires_at < datetime.now(timezone.utc)))
        await db.merge(RevokedToken(jti=str(payload["jti"])[:64], expires_at=expires))
        await db.commit()
        logger.info(f"Signed out {payload.get('username')}; token revoked")
    return {"message": "Signed out"}
