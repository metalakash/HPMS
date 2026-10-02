"""MFA service for TOTP, SMS, and device trust.

Handles two-factor authentication setup and verification.
"""

import logging
import secrets
import hashlib
from typing import Tuple, Optional, List
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)


class MFAService:
    """Manage multi-factor authentication."""

    @staticmethod
    def generate_totp_secret() -> str:
        """Generate a random base32-encoded TOTP secret.

        Returns:
            Base32-encoded secret (32 characters)
        """

        try:
            import pyotp
        except ImportError:
            logger.error("pyotp not installed. Install with: pip install pyotp")
            raise ImportError("pyotp required for TOTP support")

        secret = pyotp.random_base32()
        logger.debug(f"Generated TOTP secret (length: {len(secret)})")

        return secret

    @staticmethod
    def generate_totp_uri(
        email: str,
        secret: str,
        issuer_name: str = "SBL HPMS",
    ) -> str:
        """Generate provisioning URI for authenticator app.

        Args:
            email: User email
            secret: TOTP secret
            issuer_name: Organization name

        Returns:
            otpauth:// URI for QR code
        """

        try:
            import pyotp
        except ImportError:
            raise ImportError("pyotp required")

        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(
            name=email,
            issuer_name=issuer_name,
        )

        logger.debug(f"Generated TOTP URI for {email}")
        return uri

    @staticmethod
    def generate_qr_code(
        totp_uri: str,
        size: int = 10,
    ) -> bytes:
        """Generate QR code image for TOTP provisioning.

        Args:
            totp_uri: otpauth:// URI
            size: QR code size (default 10)

        Returns:
            PNG image bytes
        """

        try:
            import qrcode
        except ImportError:
            logger.error("qrcode not installed. Install with: pip install qrcode[pil]")
            raise ImportError("qrcode required for QR generation")

        qr = qrcode.QRCode(box_size=size, border=1)
        qr.add_data(totp_uri)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        # Convert to PNG bytes
        import io
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="PNG")
        img_bytes.seek(0)

        return img_bytes.getvalue()

    @staticmethod
    def verify_totp(secret: str, code: str, time_step: int = 30) -> bool:
        """Verify TOTP code.

        Args:
            secret: TOTP secret
            code: 6-digit code from authenticator
            time_step: Time step (default 30 seconds)

        Returns:
            True if code is valid (allows ±1 time window for clock skew)
        """

        try:
            import pyotp
        except ImportError:
            raise ImportError("pyotp required")

        try:
            totp = pyotp.TOTP(secret)
            # Allow ±1 time step for clock skew
            return totp.verify(code, valid_window=1)

        except Exception as e:
            logger.error(f"TOTP verification error: {e}")
            return False

    @staticmethod
    def verify_totp_step(secret: str, code: str, now: Optional[datetime] = None) -> Optional[int]:
        """Time step (counter) at which ``code`` is valid, allowing one step of clock skew either way; None if wrong.

        Unlike ``verify_totp`` this tells the caller *which* step matched, so an already used code can be refused.
        """
        import hmac
        import pyotp

        if not code or not code.isdigit():
            return None
        totp = pyotp.TOTP(secret)
        # pyotp reads a naive datetime as *local* time; always hand it an aware UTC one
        now = now or datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        current = totp.timecode(now)
        for counter in (current, current - 1, current + 1):
            if hmac.compare_digest(totp.generate_otp(counter), code):
                return counter
        return None

    BACKUP_CODE_RE = re.compile(r"^[0-9A-Fa-f]{4}-?[0-9A-Fa-f]{4}$")
    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_MINUTES = 15

    @staticmethod
    async def verify_second_factor(
        db: AsyncSession,
        user_mfa,
        code: str,
        ip: Optional[str] = None,
        now: Optional[datetime] = None,
    ) -> str:
        """Check a TOTP code or a backup code for a user with MFA enabled.

        Returns ``"ok"``, ``"invalid"`` or ``"locked"``. Five consecutive failures lock the account for 15
        minutes; a TOTP code is accepted once; a backup code is spent when used. The caller commits.
        """
        from backend.app.models.mfa import BackupCode

        now = now or datetime.now(timezone.utc)
        if user_mfa.locked_until is not None and user_mfa.locked_until > now:
            return "locked"

        code = (code or "").strip()
        accepted = False

        if code.isdigit() and len(code) == 6 and user_mfa.totp_secret:
            counter = MFAService.verify_totp_step(user_mfa.totp_secret, code, now)
            if counter is not None and counter > (user_mfa.last_totp_counter or 0):
                user_mfa.last_totp_counter = counter
                accepted = True
        elif MFAService.BACKUP_CODE_RE.match(code):
            normalised = code.upper() if "-" in code else f"{code[:4]}-{code[4:]}".upper()
            unused = (await db.execute(
                select(BackupCode).where(BackupCode.user_mfa_id == user_mfa.id, BackupCode.is_used.is_(False))
            )).scalars().all()
            for row in unused:
                if MFAService.verify_backup_code(row.code, normalised):
                    row.is_used, row.used_at, row.used_ip = True, now, ip
                    accepted = True
                    break

        if accepted:
            user_mfa.failed_attempts = "0"
            user_mfa.locked_until = None
            user_mfa.last_mfa_used_at = now
            return "ok"

        attempts = int(user_mfa.failed_attempts or 0) + 1
        user_mfa.failed_attempts = str(attempts)
        if attempts >= MFAService.MAX_FAILED_ATTEMPTS:
            user_mfa.locked_until = now + timedelta(minutes=MFAService.LOCKOUT_MINUTES)
            user_mfa.failed_attempts = "0"
            logger.warning("MFA locked for user_mfa %s after %d failed attempts", user_mfa.id, attempts)
            return "locked"
        return "invalid"

    @staticmethod
    def generate_backup_codes(count: int = 10) -> List[str]:
        """Generate single-use backup codes.

        Format: XXXX-XXXX (8 characters + dash)

        Args:
            count: Number of codes (default 10)

        Returns:
            List of backup codes
        """

        codes = []

        for _ in range(count):
            # Generate 8 random hex characters
            code_part1 = secrets.token_hex(2).upper()  # 4 hex chars
            code_part2 = secrets.token_hex(2).upper()  # 4 hex chars
            code = f"{code_part1}-{code_part2}"
            codes.append(code)

        logger.info(f"Generated {count} backup codes")
        return codes

    @staticmethod
    def hash_backup_code(code: str) -> str:
        """Hash backup code for storage.

        Args:
            code: Plaintext backup code

        Returns:
            Keyed (HMAC-SHA256) hash of the code; see security/secret_box.py
        """

        from backend.app.security.secret_box import keyed_hash
        return keyed_hash(code)

    @staticmethod
    def verify_backup_code(stored_hash: str, code: str) -> bool:
        """Constant-time comparison of a presented code with its stored hash."""
        from backend.app.security.secret_box import hashes_match
        return hashes_match(stored_hash, code)

    @staticmethod
    def generate_device_fingerprint(
        user_agent: str,
        ip_address: str,
    ) -> str:
        """Generate device fingerprint.

        Args:
            user_agent: Browser user agent
            ip_address: Client IP address

        Returns:
            SHA256 hash of user_agent + IP
        """

        fingerprint_str = f"{user_agent}:{ip_address}"
        return hashlib.sha256(fingerprint_str.encode()).hexdigest()

    @staticmethod
    def generate_sms_code(length: int = 6) -> str:
        """Generate SMS verification code.

        Args:
            length: Code length (default 6 digits)

        Returns:
            Numeric code string
        """

        code = "".join(str(secrets.randbelow(10)) for _ in range(length))
        return code

    @staticmethod
    async def setup_totp(
        db: AsyncSession,
        user_id: UUID,
    ) -> Tuple[str, str]:
        """Setup TOTP for user.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            (totp_uri, qr_code_png_bytes)
        """

        from backend.app.models.mfa import UserMFA
        from backend.app.models.auth import User

        # Get user
        query = select(User).where(User.id == user_id)
        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError(f"User not found: {user_id}")

        # Generate or get existing TOTP secret
        mfa_query = select(UserMFA).where(UserMFA.user_id == user_id)
        mfa_result = await db.execute(mfa_query)
        user_mfa = mfa_result.scalar_one_or_none()

        if not user_mfa:
            user_mfa = UserMFA(user_id=user_id)
            db.add(user_mfa)
            await db.flush()

        if not user_mfa.totp_secret:
            user_mfa.totp_secret = MFAService.generate_totp_secret()
            await db.flush()

        # Generate URI and QR code
        totp_uri = MFAService.generate_totp_uri(user.email, user_mfa.totp_secret)
        qr_code = MFAService.generate_qr_code(totp_uri)

        logger.info(f"TOTP setup initiated for user: {user_id}")
        return totp_uri, qr_code

    @staticmethod
    def mask_phone_number(phone: str) -> str:
        """Mask phone number for display.

        Args:
            phone: Phone number (E.164 format)

        Returns:
            Masked number (e.g., +977...1234)
        """

        if len(phone) < 8:
            return "***"

        return f"{phone[:8]}...{phone[-4:]}"

    @staticmethod
    def mask_email(email: str) -> str:
        """Mask email for display.

        Args:
            email: Email address

        Returns:
            Masked email (e.g., j***@example.com)
        """

        parts = email.split("@")
        if len(parts) != 2:
            return "***"

        local = parts[0]
        domain = parts[1]

        if len(local) < 2:
            masked_local = "*"
        else:
            masked_local = f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}"

        return f"{masked_local}@{domain}"
