"""Refuse to start in production with a configuration that would be unsafe.

Production means ``DEBUG`` is off. A default or short signing key there would let anyone forge a sign-in
token, so the server stops at startup with the reason, rather than running exposed. Development (``DEBUG``
on) is unaffected.
"""

from typing import List

MIN_SECRET_LENGTH = 32
KNOWN_DEFAULTS = {
    "dev-secret-key-change-in-production",
    "dev-jwt-secret-key-change-in-production",
    "", "secret", "changeme", "change-me",
}


class UnsafeConfiguration(RuntimeError):
    pass


def problems(settings) -> List[str]:
    """What is unsafe about this configuration for production; empty when it is fine (or DEBUG is on)."""
    if settings.DEBUG:
        return []
    found = []
    for name in ("SECRET_KEY", "JWT_SECRET_KEY"):
        value = (getattr(settings, name, "") or "").strip()
        if value in KNOWN_DEFAULTS:
            found.append(f"{name} is a default value; set a long random secret")
        elif len(value) < MIN_SECRET_LENGTH:
            found.append(f"{name} is shorter than {MIN_SECRET_LENGTH} characters")
    if (settings.SECRET_KEY or "").strip() and settings.SECRET_KEY == settings.JWT_SECRET_KEY:
        found.append("SECRET_KEY and JWT_SECRET_KEY must differ")
    mfa_key = (getattr(settings, "MFA_ENCRYPTION_KEY", "") or "").strip()
    if mfa_key and len(mfa_key) < MIN_SECRET_LENGTH:
        found.append(f"MFA_ENCRYPTION_KEY is shorter than {MIN_SECRET_LENGTH} characters")
    return found


def enforce(settings) -> None:
    found = problems(settings)
    if found:
        raise UnsafeConfiguration("Refusing to start with an unsafe production configuration: " + "; ".join(found))
