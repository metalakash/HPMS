"""Phase 11.4: security headers (CSP) and IP allow-listing for admin / service consoles."""

import json

import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.middleware.security import (
    API_CSP, DOCS_CSP, IPAllowlistMiddleware, apply_security_headers, client_ip, ip_allowed, parse_networks,
)


# ------------------------------------------------------------------ parsing / matching

def test_parse_networks_accepts_ips_and_cidrs_and_blanks():
    nets = parse_networks(" 10.0.0.0/8, 192.168.1.5 ,, 2001:db8::/32 ")
    assert len(nets) == 3
    assert parse_networks("") == [] and parse_networks(None) == []


def test_parse_networks_fails_loudly_on_typos():
    with pytest.raises(ValueError):
        parse_networks("10.0.0.0/8, not-an-ip")


@pytest.mark.parametrize("ip,ok", [
    ("10.1.2.3", True), ("192.168.1.5", True), ("192.168.1.6", False), ("8.8.8.8", False),
    ("2001:db8::1", True), (None, False), ("garbage", False),
])
def test_ip_allowed(ip, ok):
    assert ip_allowed(ip, parse_networks("10.0.0.0/8,192.168.1.5,2001:db8::/32")) is ok


def _scope(xff=None, client=("203.0.113.9", 1234), path="/api/v1/admin/users"):
    headers = [(b"x-forwarded-for", xff.encode())] if xff else []
    return {"type": "http", "path": path, "headers": headers, "client": client}


def test_client_ip_ignores_forwarded_header_without_trusted_proxy():
    assert client_ip(_scope(xff="10.0.0.1")) == "203.0.113.9"


def test_client_ip_uses_rightmost_trusted_hop_not_spoofable_left_entries():
    # client sent "10.0.0.1" to impersonate an internal host; our proxy appended the real address
    assert client_ip(_scope(xff="10.0.0.1, 203.0.113.9"), trusted_proxy_hops=1) == "203.0.113.9"
    assert client_ip(_scope(xff="10.0.0.1, 203.0.113.9, 172.16.0.2"), trusted_proxy_hops=2) == "203.0.113.9"


def test_client_ip_missing_or_short_header_with_proxy_configured_is_unknown():
    assert client_ip(_scope(), trusted_proxy_hops=1) == "203.0.113.9"  # direct connection: use the socket
    assert client_ip(_scope(xff="1.1.1.1"), trusted_proxy_hops=2) is None


# ------------------------------------------------------------------ middleware

async def ok_app(scope, receive, send):
    body = b'{"ok": true}'
    await send({"type": "http.response.start", "status": 200, "headers": [(b"content-type", b"application/json")]})
    await send({"type": "http.response.body", "body": body})


def _client(networks, hops=0, prefixes=("/api/v1/admin", "/api/v1/cbs")):
    app = IPAllowlistMiddleware(ok_app, parse_networks(networks), prefixes, hops)
    return AsyncClient(transport=ASGITransport(app=app, client=("203.0.113.9", 1)), base_url="http://localhost")


async def test_empty_allowlist_disables_the_check():
    async with _client("") as c:
        assert (await c.get("/api/v1/admin/users")).status_code == 200


async def test_protected_paths_blocked_outside_allowlist_and_open_inside():
    async with _client("10.0.0.0/8") as c:
        r = await c.get("/api/v1/admin/users")
        assert r.status_code == 403 and "not permitted" in r.json()["detail"]
        assert (await c.get("/api/v1/cbs/status")).status_code == 403
        assert (await c.get("/api/v1/projects")).status_code == 200  # not a protected prefix
    async with _client("203.0.113.0/24") as c:
        assert (await c.get("/api/v1/admin/users")).status_code == 200


async def test_spoofed_forwarded_header_cannot_bypass_allowlist():
    async with _client("10.0.0.0/8") as c:  # no trusted proxy configured: header is ignored
        assert (await c.get("/api/v1/admin/users", headers={"X-Forwarded-For": "10.1.1.1"})).status_code == 403
    async with _client("10.0.0.0/8", hops=1) as c:  # proxy appended the true address (203.0.113.9)
        assert (await c.get("/api/v1/admin/users", headers={"X-Forwarded-For": "10.1.1.1, 203.0.113.9"})
                ).status_code == 403


async def test_prefix_match_is_not_a_substring_match():
    async with _client("10.0.0.0/8") as c:
        assert (await c.get("/public/api/v1/admin")).status_code == 200


# ------------------------------------------------------------------ headers

def test_api_responses_get_strict_csp_and_no_store():
    h = {}
    apply_security_headers(h, "/api/v1/projects")
    assert h["Content-Security-Policy"] == API_CSP and "default-src 'none'" in API_CSP
    assert h["Cache-Control"] == "no-store" and h["X-Content-Type-Options"] == "nosniff"
    assert h["Referrer-Policy"] == "no-referrer" and h["X-Frame-Options"] == "DENY"


def test_docs_get_relaxed_csp_and_health_is_cacheable():
    h = {}
    apply_security_headers(h, "/docs")
    assert h["Content-Security-Policy"] == DOCS_CSP and "Cache-Control" not in h
    h = {}
    apply_security_headers(h, "/health")
    assert h["Content-Security-Policy"] == API_CSP and "Cache-Control" not in h


async def test_real_app_sends_headers_on_every_response():
    from backend.app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as c:
        r = await c.get("/api/v1/projects")  # 401/403 without a token still carries the headers
        assert r.headers["content-security-policy"] == API_CSP
        assert r.headers["cache-control"] == "no-store"


def test_vercel_spa_csp_matches_built_inline_script():
    """The theme bootstrap in index.html is allowed by hash; editing it without updating vercel.json breaks it."""
    import base64
    import hashlib
    import re
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    html = (root / "frontend" / "index.html").read_text(encoding="utf-8").replace("\r\n", "\n")
    script = re.search(r"<script>(.*?)</script>", html, re.S).group(1)
    digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
    csp = next(h["value"] for h in json.loads((root / "vercel.json").read_text())["headers"][0]["headers"]
               if h["key"] == "Content-Security-Policy")
    assert f"'sha256-{digest}'" in csp
    assert "'unsafe-inline'" not in csp.split("script-src")[1].split(";")[0]
