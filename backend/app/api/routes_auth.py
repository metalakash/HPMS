"""Authentication endpoints for login and token management."""

import logging
from typing import Optional
from pydantic import BaseModel

from datetime import date

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.config import settings
from backend.app.security.ldap_provider import ADUser, LDAPAuthProvider, LocalDevAuthProvider
from backend.app.models.auth import User, UserRole as DBUserRole
from backend.app.security.auth_middleware import TokenManager, CurrentUser, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])

# Initialize auth providers
if settings.USE_LDAP:
    auth_provider = LDAPAuthProvider(
        ad_server=settings.AD_SERVER,
        ad_domain=settings.AD_DOMAIN,
        ad_base_dn=settings.AD_BASE_DN,
        service_account_username=settings.AD_SERVICE_ACCOUNT_USERNAME,
        service_account_password=settings.AD_SERVICE_ACCOUNT_PASSWORD,
    )
else:
    auth_provider = LocalDevAuthProvider()


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


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
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

    # Attempt authentication
    ad_user = await auth_provider.authenticate(request.username, request.password)

    if ad_user is None:
        logger.warning(f"Login failed for user: {request.username}")
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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # Create JWT token
    token = TokenManager.create_token(ad_user, user.id)

    logger.info(f"Login successful for user: {request.username} with roles: {[r.value for r in ad_user.roles]}")

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_seconds=TokenManager.TOKEN_EXPIRY_MINUTES * 60,
        user={"id": str(user.id), **ad_user.to_dict()},
    )


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
async def logout():
    """Logout endpoint (stateless, token-based).

    **Phase 3 Note:**
    Logout is client-side (delete token). Server doesn't maintain session state.
    Token remains valid until expiry. For immediate revocation, use token blacklist (Phase 4).

    **Response:** Confirmation message
    """

    return {"message": "Logout successful. Please discard your token."}
