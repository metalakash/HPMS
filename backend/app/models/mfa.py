"""Multi-factor authentication models.

TOTP, SMS, backup codes, and device trust.
"""

from sqlalchemy import Column, String, Boolean, Date, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import enum
import uuid
from .base import Base, TimestampedMixin


class MFAMethod(str, enum.Enum):
    """MFA verification methods."""
    TOTP = "totp"  # Time-based OTP (authenticator app)
    SMS = "sms"    # SMS verification code
    EMAIL = "email"  # Email verification code


class UserMFA(Base, TimestampedMixin):
    """User MFA configuration.

    Tracks which MFA methods are enabled and primary method.
    """

    __tablename__ = 'user_mfa'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False, unique=True, index=True)

    # MFA status
    is_mfa_enabled = Column(Boolean, default=False, index=True)
    primary_method = Column(String(50))  # totp, sms, email

    # TOTP
    totp_secret = Column(String(32))  # Base32 encoded secret
    totp_enabled = Column(Boolean, default=False)
    totp_verified_at = Column(DateTime(timezone=True))  # When user confirmed code

    # SMS
    phone_number = Column(String(20))  # E.164 format: +977...
    sms_enabled = Column(Boolean, default=False)
    sms_verified_at = Column(DateTime(timezone=True))

    # Email fallback
    email_enabled = Column(Boolean, default=False)
    email_verified_at = Column(DateTime(timezone=True))

    # Device trust
    trusted_devices_enabled = Column(Boolean, default=True)
    trust_duration_days = Column(String(5), default="30")  # Days to trust device

    # Backup codes
    backup_codes_generated_at = Column(DateTime(timezone=True))
    backup_codes_regenerated_count = Column(String(5), default="0")

    # Enforcement
    mfa_required = Column(Boolean, default=False)  # Admin-enforced MFA
    last_mfa_used_at = Column(DateTime(timezone=True))
    failed_attempts = Column(String(5), default="0")
    locked_until = Column(DateTime(timezone=True))  # Account locked after failed attempts

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="mfa")

    # Column defaults only apply on INSERT; mirror them so new, unflushed rows read correctly.
    _PYTHON_DEFAULTS = {
        "is_mfa_enabled": False,
        "totp_enabled": False,
        "sms_enabled": False,
        "email_enabled": False,
        "trusted_devices_enabled": True,
        "mfa_required": False,
    }

    def __init__(self, **kwargs):
        for key, value in self._PYTHON_DEFAULTS.items():
            kwargs.setdefault(key, value)
        super().__init__(**kwargs)
    totp_history = relationship("TOTPVerification", back_populates="user_mfa", cascade="all, delete-orphan")
    sms_history = relationship("SMSVerification", back_populates="user_mfa", cascade="all, delete-orphan")
    backup_codes = relationship("BackupCode", back_populates="user_mfa", cascade="all, delete-orphan")
    trusted_devices = relationship("TrustedDevice", back_populates="user_mfa", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_mfa_enabled", "is_mfa_enabled"),
        Index("ix_mfa_locked", "locked_until"),
    )


class TOTPVerification(Base, TimestampedMixin):
    """TOTP verification attempt history.

    Tracks when and if TOTP codes were verified.
    """

    __tablename__ = 'totp_verification'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_mfa_id = Column(UUID(as_uuid=True), ForeignKey("user_mfa.id"), nullable=False, index=True)

    # Verification details
    code = Column(String(6), nullable=False)  # Last 6 digits used (for audit)
    success = Column(Boolean, default=False)
    ip_address = Column(String(45))  # IPv4 or IPv6
    user_agent = Column(String(500))

    # Relationships
    user_mfa = relationship("UserMFA", back_populates="totp_history")

    __table_args__ = (
        Index("ix_totp_user_date", "user_mfa_id", "created_at"),
    )


class SMSVerification(Base, TimestampedMixin):
    """SMS verification attempt history."""
    
    __tablename__ = 'sms_verification'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_mfa_id = Column(UUID(as_uuid=True), ForeignKey("user_mfa.id"), nullable=False, index=True)

    # Verification details
    phone_number = Column(String(20), nullable=False)
    code = Column(String(6), nullable=False)  # Code sent (masked in logs)
    success = Column(Boolean, default=False)
    attempts = Column(String(5), default="0")

    # SMS provider details
    sms_provider = Column(String(50))  # twilio, vonage, etc.
    sms_id = Column(String(255))  # Provider's message ID

    # Relationships
    user_mfa = relationship("UserMFA", back_populates="sms_history")

    __table_args__ = (
        Index("ix_sms_user_date", "user_mfa_id", "created_at"),
    )


class BackupCode(Base, TimestampedMixin):
    """Backup codes for account recovery.

    10 single-use codes, generated when TOTP is enabled.
    """

    __tablename__ = 'backup_code'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_mfa_id = Column(UUID(as_uuid=True), ForeignKey("user_mfa.id"), nullable=False, index=True)

    # Code and usage
    code = Column(String(8), nullable=False)  # Format: XXXX-XXXX
    is_used = Column(Boolean, default=False)
    used_at = Column(DateTime(timezone=True))
    used_ip = Column(String(45))

    # Relationships
    user_mfa = relationship("UserMFA", back_populates="backup_codes")

    __table_args__ = (
        Index("ix_backup_code_user", "user_mfa_id", "is_used"),
    )


class TrustedDevice(Base, TimestampedMixin):
    """Trusted device for skipping MFA.

    User can mark a device as trusted for 30 days (configurable).
    """

    __tablename__ = 'trusted_device'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_mfa_id = Column(UUID(as_uuid=True), ForeignKey("user_mfa.id"), nullable=False, index=True)

    # Device identification
    device_name = Column(String(255))  # User-provided name (e.g., "Chrome on MacBook")
    device_fingerprint = Column(String(255), nullable=False, unique=True)  # Hash of user-agent + IP
    browser = Column(String(100))  # Chrome, Firefox, Safari
    os = Column(String(100))  # Windows, macOS, iOS

    # Trust details
    trusted_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)  # Expiry date
    is_active = Column(Boolean, default=True)

    # Usage tracking
    last_used_at = Column(DateTime(timezone=True))
    last_ip = Column(String(45))
    use_count = Column(String(10), default="1")

    # Revocation
    revoked_at = Column(DateTime(timezone=True))
    revoke_reason = Column(String(255))  # user_requested, suspicious_activity, etc.

    # Relationships
    user_mfa = relationship("UserMFA", back_populates="trusted_devices")

    __table_args__ = (
        Index("ix_device_fingerprint", "device_fingerprint"),
        Index("ix_device_expires", "user_mfa_id", "expires_at"),
    )
