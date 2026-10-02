"""Built-in demo accounts must not be reachable on a deployed system by accident."""

import logging
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.security.auth_selection import build_auth_provider, dev_auth_allowed
from backend.app.security.ldap_provider import LDAPAuthProvider, LocalDevAuthProvider


def cfg(use_ldap=False, allow=None, debug=False):
    return SimpleNamespace(USE_LDAP=use_ldap, ALLOW_DEV_AUTH=allow, DEBUG=debug, AD_SERVER="ad", AD_DOMAIN="d",
                           AD_BASE_DN="dc=d", AD_SERVICE_ACCOUNT_USERNAME="", AD_SERVICE_ACCOUNT_PASSWORD="")


@pytest.mark.parametrize("use_ldap,allow,debug,expected", [
    (False, None, True, True),     # local development default
    (False, None, False, False),   # deployed, nothing set: refused (the Render case)
    (False, True, False, True),    # explicit opt-in for a demo
    (False, False, True, False),   # explicit opt-out even in debug
    (True, True, True, False),     # AD always wins; demo accounts never available
    (True, None, False, False),
])
def test_dev_auth_matrix(use_ldap, allow, debug, expected):
    assert dev_auth_allowed(use_ldap, allow, debug) is expected


def test_provider_choice():
    assert isinstance(build_auth_provider(cfg(use_ldap=True)), LDAPAuthProvider)
    assert isinstance(build_auth_provider(cfg(debug=True)), LocalDevAuthProvider)
    assert build_auth_provider(cfg(debug=False)) is None


def test_enabling_demo_accounts_on_a_non_debug_system_is_logged(caplog):
    with caplog.at_level(logging.WARNING):
        assert isinstance(build_auth_provider(cfg(allow=True, debug=False)), LocalDevAuthProvider)
    assert "demo accounts are ENABLED" in caplog.text


def test_env_parsing(monkeypatch):
    import importlib
    from backend.app import config
    for raw, expected in (("", None), ("true", True), ("TRUE", True), ("false", False), ("0", False)):
        monkeypatch.setenv("ALLOW_DEV_AUTH", raw)
        assert importlib.reload(config).Settings().ALLOW_DEV_AUTH is expected, raw
    monkeypatch.delenv("ALLOW_DEV_AUTH")
    importlib.reload(config)


async def test_login_is_503_not_a_demo_login_when_no_provider(monkeypatch):
    from backend.app.api import routes_auth
    from backend.app.main import app
    monkeypatch.setattr(routes_auth, "auth_provider", None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as c:
        r = await c.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 503 and "No authentication provider" in r.json()["detail"]
