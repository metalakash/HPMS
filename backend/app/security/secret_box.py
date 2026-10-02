"""Encryption at rest for small secrets stored in the database (TOTP seeds) and a keyed hash for one-time codes.

* ``encrypt`` / ``decrypt`` use Fernet (AES-128-CBC + HMAC). Stored values carry an ``enc1:`` prefix, so rows
  written before this existed (plain text) are still readable and are re-encrypted on the next write or by
  migration ``017``.
* The key comes from ``MFA_ENCRYPTION_KEY`` (any long random string), falling back to ``SECRET_KEY``.
  ``MFA_ENCRYPTION_KEY_OLD`` may hold the previous key(s), comma separated, so keys can be rotated: decrypt
  tries every key, encrypt always uses the first.
* ``keyed_hash`` is HMAC-SHA256 with a key derived separately from the same secret, for values that are only ever
  compared (backup codes). Unlike a plain SHA-256, a stolen table cannot be brute-forced offline without the key.

Changing the key without listing the old one in ``MFA_ENCRYPTION_KEY_OLD`` makes existing secrets unreadable
(users must re-enrol), so rotate in two steps.
"""

import base64
import hashlib
import hmac
import logging
from typing import List, Optional

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from sqlalchemy.types import String, TypeDecorator

logger = logging.getLogger(__name__)

PREFIX = "enc1:"
_DEV_SECRET = "dev-secret-key-change-in-production"


def _material() -> List[str]:
    from backend.app.config import settings
    primary = (settings.MFA_ENCRYPTION_KEY or settings.SECRET_KEY).strip()
    old = [k.strip() for k in (settings.MFA_ENCRYPTION_KEY_OLD or "").split(",") if k.strip()]
    if primary == _DEV_SECRET and not settings.DEBUG:
        logger.error("MFA secrets are encrypted with the development default key; set MFA_ENCRYPTION_KEY")
    return [primary, *old]


def _fernet_key(material: str, purpose: bytes) -> bytes:
    return base64.urlsafe_b64encode(hashlib.sha256(b"hpms|" + purpose + b"|" + material.encode()).digest())


def _fernet() -> MultiFernet:
    return MultiFernet([Fernet(_fernet_key(m, b"mfa-encrypt")) for m in _material()])


def is_encrypted(value: Optional[str]) -> bool:
    return bool(value) and value.startswith(PREFIX)


def encrypt(value: Optional[str]) -> Optional[str]:
    if value is None or is_encrypted(value):
        return value
    return PREFIX + _fernet().encrypt(value.encode()).decode()


def decrypt(value: Optional[str]) -> Optional[str]:
    """Plain text for a stored value; legacy un-prefixed values are returned unchanged."""
    if value is None or not is_encrypted(value):
        return value
    try:
        return _fernet().decrypt(value[len(PREFIX):].encode()).decode()
    except InvalidToken:
        raise ValueError("Stored secret cannot be decrypted with the configured key(s)")


def keyed_hash(value: str) -> str:
    """HMAC-SHA256 hex digest under a key derived from the primary secret."""
    key = _fernet_key(_material()[0], b"mfa-hash")
    return hmac.new(key, value.strip().upper().encode(), hashlib.sha256).hexdigest()


def hashes_match(stored: str, candidate: str) -> bool:
    """Constant-time check of a code against its stored hash, accepting legacy unkeyed SHA-256 rows."""
    keyed = keyed_hash(candidate)
    legacy = hashlib.sha256(candidate.encode()).hexdigest()
    return hmac.compare_digest(stored, keyed) or hmac.compare_digest(stored, legacy)


class EncryptedString(TypeDecorator):
    """String column that is encrypted on write and decrypted on read."""

    impl = String(255)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt(value)

    def process_result_value(self, value, dialect):
        return decrypt(value)
