"""Response security headers and IP allow-listing for admin / service consoles (RFP A.5, A.7, D.5)."""

import ipaddress
import json
import logging
from typing import Iterable, List, Optional, Sequence, Union

from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger(__name__)

IPNetwork = Union[ipaddress.IPv4Network, ipaddress.IPv6Network]

# The API serves JSON only: nothing it returns may load or embed anything.
API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
# Swagger UI / ReDoc load their assets from a CDN and run inline bootstrap script.
DOCS_CSP = (
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https://fastapi.tiangolo.com; "
    "worker-src blob:; frame-ancestors 'none'"
)
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")


def parse_networks(spec: Union[str, Iterable[str], None]) -> List[IPNetwork]:
    """'10.0.0.0/8, 192.168.1.5' -> networks. Raises ValueError on a bad entry so misconfiguration fails at startup."""
    if spec is None:
        return []
    items = spec.split(",") if isinstance(spec, str) else list(spec)
    networks = []
    for item in items:
        item = item.strip()
        if item:
            networks.append(ipaddress.ip_network(item, strict=False))
    return networks


def client_ip(scope: Scope, trusted_proxy_hops: int = 0) -> Optional[str]:
    """The caller's IP. With ``trusted_proxy_hops`` = N, take the Nth entry from the right of X-Forwarded-For
    (the address our outermost trusted proxy saw). Entries to its left are client-controlled and ignored."""
    if trusted_proxy_hops > 0:
        for name, value in scope.get("headers", []):
            if name == b"x-forwarded-for":
                parts = [p.strip() for p in value.decode("latin-1").split(",") if p.strip()]
                if len(parts) >= trusted_proxy_hops:
                    return parts[-trusted_proxy_hops]
                return None  # fewer hops than configured: the header is not what we expect
    client = scope.get("client")
    return client[0] if client else None


def ip_allowed(ip: Optional[str], networks: Sequence[IPNetwork]) -> bool:
    if ip is None:
        return False
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(addr in net for net in networks)


class IPAllowlistMiddleware:
    """Return 403 for requests to ``protected_prefixes`` from addresses outside ``networks``.

    An empty allow-list disables the check (off by default so existing deployments keep working).
    """

    def __init__(self, app: ASGIApp, networks: Sequence[IPNetwork], protected_prefixes: Sequence[str],
                 trusted_proxy_hops: int = 0):
        self.app = app
        self.networks = list(networks)
        self.prefixes = tuple(protected_prefixes)
        self.hops = trusted_proxy_hops

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and self.networks and scope["path"].startswith(self.prefixes):
            ip = client_ip(scope, self.hops)
            if not ip_allowed(ip, self.networks):
                logger.warning("Blocked %s from %s (not in IP allow-list)", scope["path"], ip)
                body = json.dumps({"detail": "Access from this network is not permitted"}).encode()
                await send({"type": "http.response.start", "status": 403,
                            "headers": [(b"content-type", b"application/json"),
                                        (b"content-length", str(len(body)).encode())]})
                await send({"type": "http.response.body", "body": body})
                return
        await self.app(scope, receive, send)


def apply_security_headers(headers, path: str) -> None:
    """Set the standard hardening headers on a response's mutable header map."""
    headers["X-Content-Type-Options"] = "nosniff"
    headers["X-Frame-Options"] = "DENY"
    headers["X-XSS-Protection"] = "1; mode=block"
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    headers["Referrer-Policy"] = "no-referrer"
    headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=()"
    headers["Content-Security-Policy"] = DOCS_CSP if path.startswith(DOCS_PATHS) else API_CSP
    if path.startswith("/api/"):
        headers["Cache-Control"] = "no-store"  # financial data must not sit in shared or browser caches
