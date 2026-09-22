"""MFA service for TOTP, SMS, and device trust.

Handles two-factor authentication setup and verification.
"""

import logging
import secrets
import hashlib
from typing import Tuple, Optional, List
from datetime import datetime, timedelta
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
            SHA256 hash of code
        """

        return hashlib.sha256(code.encode()).hexdigest()

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
