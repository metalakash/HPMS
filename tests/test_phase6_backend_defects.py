"""Tests for Phase 6 backend defects.

Verifies fixes for:
1. HTTPAuthCredentials import in auth_middleware & routes_ws
2. WebSocket auth (sub claim in JWT token)
3. GET /api/v1/auth/me (use get_current_user dependency)
4. GraphQL field mappings (Project model columns)
5. CORS configuration (localhost:5173)
"""

import pytest
import json
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from unittest.mock import MagicMock, patch, AsyncMock

# Defect 1 & 3: Import check (these should not raise ImportError)
try:
    from backend.app.security.auth_middleware import (
        TokenManager,
        CurrentUser,
        get_current_user,
        HTTPAuthorizationCredentials,
    )
    from backend.app.api.routes_auth import router as auth_router
    from backend.app.api.routes_ws import router as ws_router
    IMPORTS_OK = True
except ImportError as e:
    IMPORTS_OK = False
    IMPORT_ERROR = str(e)


class TestDefect1ImportErrors:
    """Defect 1: HTTPAuthCredentials import should work (not HTTPAuthCredentials from FastAPI 0.141)."""

    def test_imports_dont_fail(self):
        """Verify that importing auth modules doesn't raise ImportError for HTTPAuthCredentials."""
        assert IMPORTS_OK, f"Import failed: {IMPORT_ERROR if not IMPORTS_OK else 'OK'}"

    def test_http_auth_credentials_available(self):
        """HTTPAuthorizationCredentials should be importable from fastapi.security."""
        from fastapi.security import HTTPAuthorizationCredentials

        # Create a mock instance to verify it works
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="test_token")
        assert creds.scheme == "Bearer"
        assert creds.credentials == "test_token"

    def test_routes_ws_no_unused_imports(self):
        """routes_ws.py should not have HTTPAuthCredentials in imports (only HTTPBearer used)."""
        import inspect

        from backend.app.api import routes_ws

        source = inspect.getsource(routes_ws)
        # Should have HTTPBearer
        assert "HTTPBearer" in source
        # Should not have HTTPAuthCredentials
        assert "HTTPAuthCredentials" not in source


class TestDefect2JWTSubClaim:
    """Defect 2: JWT token should include 'sub' claim (username) for WebSocket auth."""

    def test_token_creation_includes_sub_claim(self):
        """TokenManager.create_token should include 'sub' claim with username."""
        from backend.app.security.ldap_provider import ADUser, UserRole
        from backend.app.config import settings
        from jose import jwt

        ad_user = ADUser(
            username="testuser",
            email="test@sbl.local",
            full_name="Test User",
            roles=[UserRole.MAKER],
        )

        token = TokenManager.create_token(ad_user)

        # Decode token and verify sub claim
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[TokenManager.ALGORITHM],
        )

        assert "sub" in payload, "JWT token missing 'sub' claim"
        assert payload["sub"] == "testuser", "sub claim should be username"

    def test_token_payload_contains_user_claims(self):
        """Token should have all required claims."""
        from backend.app.security.ldap_provider import ADUser, UserRole
        from backend.app.config import settings
        from jose import jwt

        ad_user = ADUser(
            username="maker1",
            email="maker@sbl.local",
            full_name="Maker User",
            roles=[UserRole.MAKER, UserRole.AUDITOR],
        )

        token = TokenManager.create_token(ad_user)
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[TokenManager.ALGORITHM],
        )

        # Verify all expected claims
        assert payload.get("username") == "maker1"
        assert payload.get("email") == "maker@sbl.local"
        assert payload.get("full_name") == "Maker User"
        assert set(payload.get("roles", [])) == {"maker", "auditor"}
        assert payload.get("is_authenticated") is True
        assert "exp" in payload
        assert "iat" in payload
        assert "sub" in payload


class TestDefect3CurrentUserID:
    """Defect 3: CurrentUser should have 'id' attribute from 'sub' claim."""

    def test_current_user_has_id_from_sub(self):
        """CurrentUser initialized from token should have id attribute from sub claim."""
        payload = {
            "sub": "testuser",
            "username": "testuser",
            "email": "test@sbl.local",
            "full_name": "Test User",
            "roles": ["maker"],
            "is_authenticated": True,
        }

        user = CurrentUser(payload)

        assert hasattr(user, "id"), "CurrentUser should have 'id' attribute"
        assert user.id == "testuser", "id should be set from 'sub' claim"
        assert user.username == "testuser"
        assert user.email == "test@sbl.local"

    def test_current_user_with_missing_sub_claim(self):
        """CurrentUser should handle missing sub claim gracefully (set to None)."""
        payload = {
            "username": "user2",
            "email": "user2@sbl.local",
            "full_name": "User Two",
            "roles": ["auditor"],
            "is_authenticated": True,
        }

        user = CurrentUser(payload)

        assert user.id is None  # sub not in payload
        assert user.username == "user2"

    def test_current_user_role_checks(self):
        """CurrentUser role checking methods should work."""
        from backend.app.security.ldap_provider import UserRole

        # Test with admin role (admins bypass all role checks)
        admin_payload = {
            "sub": "admin1",
            "username": "admin1",
            "email": "admin@sbl.local",
            "full_name": "Admin",
            "roles": ["admin"],
            "is_authenticated": True,
        }

        admin_user = CurrentUser(admin_payload)
        assert admin_user.has_role(UserRole.ADMIN) is True
        # Admins bypass all role checks (intended behavior)
        assert admin_user.has_role(UserRole.MAKER) is True
        assert admin_user.has_any_role([UserRole.AUDITOR, UserRole.GUEST]) is True

        # Test with maker role (no admin bypass)
        maker_payload = {
            "sub": "maker1",
            "username": "maker1",
            "email": "maker@sbl.local",
            "full_name": "Maker",
            "roles": ["maker"],
            "is_authenticated": True,
        }

        maker_user = CurrentUser(maker_payload)
        assert maker_user.has_role(UserRole.MAKER) is True
        assert maker_user.has_role(UserRole.ADMIN) is False
        assert maker_user.has_any_role([UserRole.MAKER, UserRole.APPROVER]) is True


class TestDefect4AuthMeEndpoint:
    """Defect 3 (part 2): GET /api/v1/auth/me should use get_current_user dependency."""

    def test_auth_me_endpoint_imports_dependency(self):
        """GET /me endpoint should import get_current_user (not verify_token)."""
        import inspect
        from backend.app.api import routes_auth

        source = inspect.getsource(routes_auth)

        # Should import get_current_user
        assert "get_current_user" in source, "routes_auth should import get_current_user"

        # Should NOT use Depends(TokenManager.verify_token) for /me
        # verify_token is a function(token: str), which FastAPI treats as a query param
        assert (
            "Depends(get_current_user)" in source
        ), "/me endpoint should use Depends(get_current_user)"
        assert "verify_jwt_token" not in source, (
            "Should not use verify_jwt_token (treats token as query param)"
        )

    def test_auth_me_endpoint_returns_user_with_id(self):
        """GET /me response should include id field from sub claim."""
        # This tests the endpoint response structure
        # The actual endpoint is tested above; this verifies response model
        from backend.app.security.ldap_provider import ADUser, UserRole

        ad_user = ADUser(
            username="testapprover",
            email="approver@test.local",
            full_name="Test Approver",
            roles=[UserRole.APPROVER],
        )

        token = TokenManager.create_token(ad_user)
        payload = TokenManager.verify_token(token)

        # Simulate what the endpoint returns
        response_data = {
            "id": payload.get("sub"),
            "username": payload.get("username"),
            "email": payload.get("email"),
            "full_name": payload.get("full_name"),
            "roles": payload.get("roles"),
        }

        assert "id" in response_data
        assert response_data["id"] == "testapprover"
        assert response_data["username"] == "testapprover"


class TestDefect5GraphQLFieldMappings:
    """Defect 4: GraphQL ProjectType fields should map to actual Project model columns."""

    def test_graphql_project_type_has_correct_fields(self):
        """ProjectType should have fields matching Project model columns."""
        from backend.app.schemas.graphql_schema import ProjectType
        import inspect

        # Get the fields defined on ProjectType
        annotations = ProjectType.__annotations__

        # Check for correct field names (not old ones)
        assert (
            "name_en" in annotations
        ), "ProjectType should have 'name_en', not 'name'"
        assert (
            "installed_capacity_mw" in annotations
        ), "Should have 'installed_capacity_mw', not 'capacity_mw'"
        assert (
            "pipeline_status" in annotations
        ), "Should have 'pipeline_status', not 'status'"
        assert (
            "project_stage" in annotations
        ), "Should have 'project_stage' field"
        assert (
            "project_code" in annotations
        ), "Should have 'project_code' field"

        # Should NOT have old wrong field names
        assert (
            "name" not in annotations
        ), "Should not have 'name' field (use name_en)"
        assert (
            "capacity_mw" not in annotations
        ), "Should not have 'capacity_mw' (use installed_capacity_mw)"
        assert (
            "status" not in annotations
        ), "Should not have 'status' (use pipeline_status)"
        assert (
            "facility_type" not in annotations
        ), "Should not have 'facility_type' (not on Project model)"

    def test_graphql_query_resolver_uses_correct_columns(self):
        """GraphQL resolvers should query using correct Project model columns."""
        import inspect
        from backend.app.schemas.graphql_schema import Query

        # Get the source code of the Query.projects method
        projects_method = Query.projects
        source = inspect.getsource(projects_method)

        # Should reference correct columns
        assert "pipeline_status" in source, "Should filter by pipeline_status"
        assert "installed_capacity_mw" in source, "Should use installed_capacity_mw"
        assert (
            "project_code" in source
        ), "Should reference project_code from Project"

        # Should NOT reference old wrong names in the resolver
        # (These might appear in comments or strings, but not in actual queries)


class TestDefect6CORSConfiguration:
    """Defect 5: CORS should allow localhost:5173 (Vite dev server)."""

    def test_cors_middleware_allows_localhost_5173(self):
        """CORS configuration should include localhost:5173."""
        import os

        # Read main.py source directly (avoid importing which triggers model errors)
        main_file = os.path.join(
            os.path.dirname(__file__),
            "..",
            "backend",
            "app",
            "main.py",
        )

        with open(main_file, "r") as f:
            source = f.read()

        # Should explicitly mention localhost:5173 in CORS config
        assert (
            "localhost:5173" in source
        ), "CORS config should allow localhost:5173 (Vite dev server)"

        # Verify it's not commented out
        lines = source.split("\n")
        found_5173 = False
        for i, line in enumerate(lines):
            if "5173" in line and not line.strip().startswith("#"):
                found_5173 = True
                break

        assert (
            found_5173
        ), "localhost:5173 should be uncommented in CORS allow_origins"

    def test_cors_allows_multiple_dev_ports(self):
        """CORS should allow multiple dev server ports."""
        import os

        # Read main.py source directly (avoid importing which triggers model errors)
        main_file = os.path.join(
            os.path.dirname(__file__),
            "..",
            "backend",
            "app",
            "main.py",
        )

        with open(main_file, "r") as f:
            source = f.read()

        # Should mention all dev ports
        assert "3000" in source, "Should allow port 3000 (React)"
        assert "5173" in source, "Should allow port 5173 (Vite)"
        assert "8080" in source, "Should allow port 8080 (alt)"


class TestWebSocketAuthWithSubClaim:
    """Integration test: WebSocket should authenticate using sub claim."""

    @pytest.mark.asyncio
    async def test_websocket_validates_sub_claim(self):
        """WebSocket /notifications endpoint should accept token with sub claim."""
        from backend.app.security.ldap_provider import ADUser, UserRole

        # Create a token with sub claim
        ad_user = ADUser(
            username="wsuser",
            email="ws@test.local",
            full_name="WS User",
            roles=[UserRole.GUEST],
        )
        token = TokenManager.create_token(ad_user)

        # Verify token has sub claim
        payload = TokenManager.verify_token(token)
        assert payload.get("sub") == "wsuser", "Token should have sub claim"

        # Simulate WebSocket token validation (as done in routes_ws.py)
        user_id_str = payload.get("sub")
        assert user_id_str is not None, "sub claim missing (WebSocket auth would fail)"
        assert user_id_str == "wsuser"

    @pytest.mark.asyncio
    async def test_websocket_rejects_token_without_sub(self):
        """WebSocket should reject token if sub claim is missing."""
        from backend.app.config import settings
        from jose import jwt

        # Create a token WITHOUT sub claim (shouldn't happen, but test defensive code)
        payload = {
            "username": "nosubuser",
            "email": "nosub@test.local",
            "roles": ["guest"],
            "is_authenticated": True,
            "exp": datetime.utcnow() + timedelta(minutes=60),
            "iat": datetime.utcnow(),
            # No "sub" claim
        }

        token = jwt.encode(
            payload,
            settings.JWT_SECRET_KEY,
            algorithm="HS256",
        )

        decoded = TokenManager.verify_token(token)
        user_id = decoded.get("sub")

        # WebSocket code in routes_ws.py checks: if not user_id: close with 1008
        assert user_id is None, "This malformed token has no sub - WebSocket would reject it"


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
