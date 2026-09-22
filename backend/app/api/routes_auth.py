"""Authentication endpoints for login and token management."""

import logging
from typing import Optional
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.config import settings
from backend.app.security.ldap_provider import LDAPAuthProvider, LocalDevAuthProvider
from backend.app.security.auth_middleware import TokenManager

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

    # Create JWT token
    token = TokenManager.create_token(ad_user)

    logger.info(f"Login successful for user: {request.username} with roles: {[r.value for r in ad_user.roles]}")

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_seconds=TokenManager.TOKEN_EXPIRY_MINUTES * 60,
        user=ad_user.to_dict(),
    )


@router.get("/me")
async def get_current_user_info(
    current_user: dict = Depends(TokenManager.verify_token),
):
    """Get information about the current authenticated user.

    **Response:**
    - username: AD username
    - email: Email address
    - full_name: Display name
    - roles: List of assigned roles

    **Authorization:**
    - Requires valid Bearer token
    """

    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    return {
        "username": current_user.get("username"),
        "email": current_user.get("email"),
        "full_name": current_user.get("full_name"),
        "roles": current_user.get("roles"),
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
