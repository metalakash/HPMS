"""Tests for LDAP authentication and JWT token management."""

import pytest
from uuid import uuid4
from backend.app.security.ldap_provider import (
    LocalDevAuthProvider,
    LDAPAuthProvider,
    UserRole,
    ADUser,
)
from backend.app.security.auth_middleware import (
    TokenManager,
    CurrentUser,
)


class TestLocalDevAuthProvider:
    """Test local dev authentication (no AD required)."""

    @pytest.fixture
    def auth_provider(self):
        return LocalDevAuthProvider()

    @pytest.mark.asyncio
    async def test_admin_login(self, auth_provider):
        """Test admin user login."""
        user = await auth_provider.authenticate("admin", "admin123")

        assert user is not None
        assert user.username == "admin"
        assert user.email == "admin@sbl.local"
        assert UserRole.ADMIN in user.roles

    @pytest.mark.asyncio
    async def test_maker_login(self, auth_provider):
        """Test maker user login."""
        user = await auth_provider.authenticate("maker", "maker123")

        assert user is not None
        assert user.username == "maker"
        assert UserRole.MAKER in user.roles

    @pytest.mark.asyncio
    async def test_approver_login(self, auth_provider):
        """Test approver user login."""
        user = await auth_provider.authenticate("approver", "approver123")

        assert user is not None
        assert user.username == "approver"
        assert UserRole.APPROVER in user.roles

    @pytest.mark.asyncio
    async def test_auditor_login(self, auth_provider):
        """Test auditor user login."""
        user = await auth_provider.authenticate("auditor", "auditor123")

        assert user is not None
        assert user.username == "auditor"
        assert UserRole.AUDITOR in user.roles

    @pytest.mark.asyncio
    async def test_guest_login(self, auth_provider):
        """Test guest user login."""
        user = await auth_provider.authenticate("guest", "guest123")

        assert user is not None
        assert user.username == "guest"
        assert UserRole.GUEST in user.roles

    @pytest.mark.asyncio
    async def test_invalid_username(self, auth_provider):
        """Test login with invalid username."""
        user = await auth_provider.authenticate("invalid_user", "any_password")

        assert user is None

    @pytest.mark.asyncio
    async def test_invalid_password(self, auth_provider):
        """Test login with invalid password."""
        user = await auth_provider.authenticate("admin", "wrong_password")

        assert user is None

    @pytest.mark.asyncio
    async def test_empty_credentials(self, auth_provider):
        """Test login with empty credentials."""
        user = await auth_provider.authenticate("", "")

        assert user is None


class TestADUser:
    """Test ADUser model and methods."""

    def test_ad_user_creation(self):
        """Test creating AD user."""
        user = ADUser(
            username="john.doe",
            email="john.doe@sbl.local",
            full_name="John Doe",
            roles=[UserRole.MAKER],
        )

        assert user.username == "john.doe"
        assert user.email == "john.doe@sbl.local"
        assert user.full_name == "John Doe"
        assert user.is_authenticated is True

    def test_user_has_role(self):
        """Test role checking."""
        user = ADUser(
            username="test",
            email="test@sbl.local",
            full_name="Test User",
            roles=[UserRole.MAKER, UserRole.APPROVER],
        )

        assert user.has_role(UserRole.MAKER) is True
        assert user.has_role(UserRole.APPROVER) is True
        assert user.has_role(UserRole.ADMIN) is False

    def test_admin_bypasses_role_checks(self):
        """Test that admin role bypasses role checks."""
        user = ADUser(
            username="admin",
            email="admin@sbl.local",
            full_name="Admin User",
            roles=[UserRole.ADMIN],
        )

        # Admin should pass any role check
        assert user.has_role(UserRole.ADMIN) is True
        assert user.has_role(UserRole.MAKER) is True  # Bypass
        assert user.has_role(UserRole.AUDITOR) is True  # Bypass

    def test_user_has_any_role(self):
        """Test checking for any of multiple roles."""
        user = ADUser(
            username="test",
            email="test@sbl.local",
            full_name="Test User",
            roles=[UserRole.MAKER],
        )

        assert user.has_any_role([UserRole.MAKER, UserRole.APPROVER]) is True
        assert user.has_any_role([UserRole.ADMIN, UserRole.AUDITOR]) is False

    def test_user_to_dict(self):
        """Test serialization to dict."""
        user = ADUser(
            username="john.doe",
            email="john.doe@sbl.local",
            full_name="John Doe",
            roles=[UserRole.MAKER],
        )

        user_dict = user.to_dict()
        assert user_dict["username"] == "john.doe"
        assert user_dict["email"] == "john.doe@sbl.local"
        assert user_dict["full_name"] == "John Doe"
        assert user_dict["roles"] == ["maker"]
        assert user_dict["is_authenticated"] is True


class TestTokenManager:
    """Test JWT token generation and validation."""

    def test_create_token(self):
        """Test token creation."""
        user = ADUser(
            username="test_user",
            email="test@sbl.local",
            full_name="Test User",
            roles=[UserRole.MAKER],
        )

        token = TokenManager.create_token(user, uuid4())

        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    def test_verify_token_success(self):
        """Test token verification."""
        user = ADUser(
            username="test_user",
            email="test@sbl.local",
            full_name="Test User",
            roles=[UserRole.MAKER],
        )

        token = TokenManager.create_token(user, uuid4())
        payload = TokenManager.verify_token(token)

        assert payload is not None
        assert payload["username"] == "test_user"
        assert payload["email"] == "test@sbl.local"
        assert payload["full_name"] == "Test User"
        assert "maker" in payload["roles"]
        assert payload["is_authenticated"] is True

    def test_verify_invalid_token(self):
        """Test verification of invalid token."""
        invalid_token = "invalid.token.here"
        payload = TokenManager.verify_token(invalid_token)

        assert payload is None

    def test_verify_tampered_token(self):
        """Test verification of tampered token."""
        user = ADUser(
            username="test_user",
            email="test@sbl.local",
            full_name="Test User",
            roles=[UserRole.MAKER],
        )

        token = TokenManager.create_token(user, uuid4())
        # Tamper with token
        tampered_token = token[:-10] + "tampered!!"

        payload = TokenManager.verify_token(tampered_token)
        assert payload is None


class TestCurrentUser:
    """Test CurrentUser dependency model."""

    def test_current_user_from_token_payload(self):
        """Test creating CurrentUser from token payload."""
        payload = {
            "username": "john.doe",
            "email": "john.doe@sbl.local",
            "full_name": "John Doe",
            "roles": ["maker", "approver"],
            "is_authenticated": True,
        }

        current_user = CurrentUser(payload)

        assert current_user.username == "john.doe"
        assert current_user.email == "john.doe@sbl.local"
        assert current_user.full_name == "John Doe"
        assert UserRole.MAKER in current_user.roles
        assert UserRole.APPROVER in current_user.roles

    def test_current_user_role_checks(self):
        """Test role checking in CurrentUser."""
        payload = {
            "username": "test",
            "email": "test@sbl.local",
            "full_name": "Test",
            "roles": ["maker"],
            "is_authenticated": True,
        }

        current_user = CurrentUser(payload)

        assert current_user.has_role(UserRole.MAKER) is True
        assert current_user.has_role(UserRole.ADMIN) is False

    def test_current_user_has_any_role(self):
        """Test checking any role in CurrentUser."""
        payload = {
            "username": "test",
            "email": "test@sbl.local",
            "full_name": "Test",
            "roles": ["maker"],
            "is_authenticated": True,
        }

        current_user = CurrentUser(payload)

        assert current_user.has_any_role([UserRole.MAKER, UserRole.APPROVER]) is True
        assert current_user.has_any_role([UserRole.ADMIN, UserRole.AUDITOR]) is False
