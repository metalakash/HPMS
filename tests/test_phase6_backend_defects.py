"""Behavioural tests for the Phase 6 backend fixes the web frontend depends on.

These drive the real FastAPI app through TestClient (no database needed):
auth identity, /auth/me, the notifications WebSocket, route protection,
GraphQL wiring and error handling.
"""

import importlib
import pkgutil
import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from starlette.websockets import WebSocketDisconnect

from backend.app.config import settings
from backend.app.security.auth_middleware import CurrentUser, TokenManager
from backend.app.security.ldap_provider import ADUser, UserRole

# TrustedHostMiddleware rejects TestClient's default "testserver" host.
BASE_URL = "http://localhost"


@pytest.fixture(scope="module")
def client():
    from backend.app.main import app

    with TestClient(app, base_url=BASE_URL) as c:
        yield c


def make_token(role: UserRole = UserRole.MAKER, user_id: uuid.UUID | None = None, username: str = "tester") -> str:
    ad_user = ADUser(username=username, email=f"{username}@sbl.local", full_name="Test User", roles=[role])
    return TokenManager.create_token(ad_user, user_id or uuid.uuid4())


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestAppLoads:
    def test_every_backend_module_imports(self):
        import backend.app as root

        failures = []
        for module in pkgutil.walk_packages(root.__path__, "backend.app."):
            try:
                importlib.import_module(module.name)
            except Exception as e:  # pragma: no cover - reported below
                failures.append(f"{module.name}: {e!r}")
        assert failures == []

    def test_all_mappers_configure(self):
        from sqlalchemy.orm import configure_mappers

        import backend.app.models  # noqa: F401  registers every model

        configure_mappers()

    def test_table_names_match_migrations(self):
        from backend.app.models import Base

        expected = {
            "projects", "loan_accounts", "consortium_facilities", "consortium_members",
            "documents", "document_versions", "user", "project_owner", "user_mfa", "export_job",
        }
        assert expected <= set(Base.metadata.tables)


class TestTokenIdentity:
    def test_sub_is_db_user_uuid(self):
        user_id = uuid.uuid4()
        payload = TokenManager.verify_token(make_token(user_id=user_id, username="alice"))

        assert payload["sub"] == str(user_id)
        assert payload["username"] == "alice"

    def test_current_user_exposes_uuid(self):
        user_id = uuid.uuid4()
        user = CurrentUser(TokenManager.verify_token(make_token(user_id=user_id)))

        assert user.id == str(user_id)
        assert user.uuid == user_id

    def test_current_user_uuid_none_for_malformed_sub(self):
        assert CurrentUser({"sub": "not-a-uuid"}).uuid is None
        assert CurrentUser({}).uuid is None


class TestAuthMe:
    def test_reads_bearer_header(self, client):
        user_id = uuid.uuid4()
        r = client.get("/api/v1/auth/me", headers=auth(make_token(UserRole.APPROVER, user_id, "appr")))

        assert r.status_code == 200
        body = r.json()
        assert body["id"] == str(user_id)
        assert body["username"] == "appr"
        assert body["roles"] == ["approver"]

    def test_query_param_token_is_not_accepted(self, client):
        r = client.get("/api/v1/auth/me", params={"token": make_token()})
        assert r.status_code in (401, 403)

    def test_token_without_uuid_sub_is_rejected(self, client):
        legacy = jwt.encode(
            {"sub": "username-not-uuid", "username": "x", "roles": ["maker"], "is_authenticated": True,
             "exp": datetime.utcnow() + timedelta(minutes=5)},
            settings.JWT_SECRET_KEY,
            algorithm="HS256",
        )
        r = client.get("/api/v1/auth/me", headers=auth(legacy))
        assert r.status_code == 401


class TestLogin:
    def test_login_syncs_user_and_uses_its_id(self, client, monkeypatch):
        from backend.app.api import routes_auth

        db_id = uuid.uuid4()

        async def fake_sync_user(db, ad_user):
            return SimpleNamespace(id=db_id, is_active=True)

        monkeypatch.setattr(routes_auth, "sync_user", fake_sync_user)
        r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})

        assert r.status_code == 200
        body = r.json()
        assert body["user"]["id"] == str(db_id)
        assert TokenManager.verify_token(body["access_token"])["sub"] == str(db_id)

    def test_disabled_account_is_refused(self, client, monkeypatch):
        from backend.app.api import routes_auth

        async def fake_sync_user(db, ad_user):
            return SimpleNamespace(id=uuid.uuid4(), is_active=False)

        monkeypatch.setattr(routes_auth, "sync_user", fake_sync_user)
        r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
        assert r.status_code == 403

    def test_bad_password_is_401(self, client):
        r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401


class TestNotificationsWebSocket:
    def test_valid_token_connects(self, client):
        user_id = uuid.uuid4()
        with client.websocket_connect(f"ws://localhost/ws/notifications?token={make_token(user_id=user_id)}") as ws:
            welcome = ws.receive_json()
            assert welcome["data"]["status"] == "connected"
            assert welcome["data"]["user_id"] == str(user_id)

            ws.send_json({"type": "ping", "message_id": "p1"})
            # Drain the subscription confirmation, then expect the pong
            messages = [ws.receive_json() for _ in range(2)]
            assert any(m["data"].get("type") == "pong" for m in messages)

    @pytest.mark.parametrize(
        "query",
        ["", "?token=garbage", "?token=" + jwt.encode({"username": "x"}, "wrong-secret", algorithm="HS256")],
    )
    def test_bad_tokens_are_refused(self, client, query):
        with pytest.raises(WebSocketDisconnect) as exc:
            with client.websocket_connect(f"ws://localhost/ws/notifications{query}") as ws:
                ws.receive_json()
        assert exc.value.code == 1008

    def test_admin_endpoints_need_admin(self, client):
        assert client.get("/ws/stats").status_code in (401, 403)
        assert client.get("/ws/stats", headers=auth(make_token(UserRole.MAKER))).status_code == 403
        assert client.get("/ws/stats", headers=auth(make_token(UserRole.ADMIN))).status_code == 200

    def test_broadcast_reaches_connected_user(self, client):
        user_id = uuid.uuid4()
        with client.websocket_connect(f"ws://localhost/ws/notifications?token={make_token(user_id=user_id)}") as ws:
            ws.receive_json()  # welcome
            ws.receive_json()  # subscribed

            r = client.post(
                "/ws/broadcast-test",
                params={"user_id": str(user_id), "message": "hello"},
                headers=auth(make_token(UserRole.ADMIN)),
            )
            assert r.status_code == 200
            assert r.json()["recipients"] >= 1

            event = ws.receive_json()
            assert event["type"] == "event"
            assert event["data"]["type"] == "system_alert"
            assert event["data"]["message"] == "hello"


class TestRoutesRequireAuth:
    @pytest.mark.parametrize(
        "method,path",
        [
            ("get", "/api/v1/projects"),
            ("get", f"/api/v1/projects/{uuid.uuid4()}"),
            ("post", "/api/v1/projects"),
            ("patch", f"/api/v1/projects/{uuid.uuid4()}"),
            ("get", f"/api/v1/projects/{uuid.uuid4()}/loan-accounts"),
            ("get", "/api/v1/loan-accounts"),
            ("get", f"/api/v1/loan-accounts/{uuid.uuid4()}"),
            ("post", "/api/v1/loan-accounts/sync"),
            ("post", "/api/v1/reports/export"),
            ("post", "/graphql"),
            ("get", "/api/v1/i18n/preferences"),
        ],
    )
    def test_anonymous_is_rejected(self, client, method, path):
        r = getattr(client, method)(path)
        assert r.status_code in (401, 403), r.text

    def test_cbs_sync_is_admin_only(self, client):
        r = client.post("/api/v1/loan-accounts/sync", headers=auth(make_token(UserRole.MAKER)))
        assert r.status_code == 403

    @pytest.mark.parametrize("path", ["/api/v1/reports/pdf/portfolio", "/api/v1/reports/pdf/covenant"])
    def test_portfolio_reports_need_admin_or_auditor(self, client, path):
        r = client.post(path, headers=auth(make_token(UserRole.MAKER)))
        assert r.status_code == 403

    def test_create_project_requires_maker(self, client):
        body = {
            "project_code": "X-1", "name_en": "X", "name_np": "X", "province": "Gandaki",
            "district": "Kaski", "installed_capacity_mw": "10", "project_stage": "feasibility",
            "pipeline_status": "under_review",
        }
        r = client.post("/api/v1/projects", json=body, headers=auth(make_token(UserRole.GUEST)))
        assert r.status_code == 403


class TestErrorHandling:
    def test_http_errors_keep_their_status(self, client):
        r = client.get("/api/v1/i18n/translate/definitely_not_a_key")
        assert r.status_code == 404
        assert "not found" in r.json()["detail"]

    def test_cors_allows_vite_dev_server(self, client):
        r = client.options(
            "/api/v1/projects",
            headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
        )
        assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"


class TestGraphQLSchema:
    def test_example_queries_validate(self):
        from graphql import parse, validate

        from backend.app.api.routes_graphql import EXAMPLE_QUERIES
        from backend.app.schemas.graphql_schema import schema

        for name, query in EXAMPLE_QUERIES.items():
            assert validate(schema._schema, parse(query)) == [], name

    def test_project_type_matches_model_columns(self):
        from backend.app.models.project import Project
        from backend.app.schemas.graphql_schema import ProjectType

        columns = set(Project.__table__.columns.keys())
        fields = {f for f in ProjectType.__annotations__}
        assert fields <= columns, fields - columns

    def test_resolvers_refuse_missing_user_context(self):
        import asyncio

        from backend.app.schemas.graphql_schema import schema

        result = asyncio.run(schema.execute("{ portfolioMetrics { totalProjects } }", context_value={}))
        assert result.errors and "Not authenticated" in str(result.errors[0])
