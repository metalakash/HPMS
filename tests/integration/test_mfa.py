"""Tests for multi-factor authentication service."""

import pytest
from datetime import datetime, timedelta

from backend.app.services.mfa_service import MFAService
from backend.app.models.mfa import UserMFA
from urllib.parse import unquote


class TestTOTPGeneration:
    """Test TOTP secret and QR code generation."""

    def test_generate_totp_secret(self):
        """Test TOTP secret generation."""
        secret = MFAService.generate_totp_secret()

        assert secret is not None
        assert len(secret) == 32
        assert isinstance(secret, str)

    def test_generate_totp_uri(self):
        """Test TOTP provisioning URI generation."""
        secret = MFAService.generate_totp_secret()
        uri = MFAService.generate_totp_uri("user@example.com", secret)

        assert uri is not None
        assert "otpauth://" in uri
        assert "user@example.com" in unquote(uri)
        assert "SBL%20HPMS" in uri  # URL-encoded issuer

    def test_generate_qr_code(self):
        """Test QR code generation."""
        try:
            import qrcode
        except ImportError:
            pytest.skip("qrcode not installed")

        secret = MFAService.generate_totp_secret()
        uri = MFAService.generate_totp_uri("test@example.com", secret)
        qr_code = MFAService.generate_qr_code(uri)

        assert qr_code is not None
        assert isinstance(qr_code, bytes)
        assert len(qr_code) > 0
        # PNG header check
        assert qr_code.startswith(b'\x89PNG')


class TestTOTPVerification:
    """Test TOTP code verification."""

    def test_verify_valid_totp_code(self):
        """Test verifying a valid TOTP code."""
        try:
            import pyotp
        except ImportError:
            pytest.skip("pyotp not installed")

        secret = MFAService.generate_totp_secret()
        totp = pyotp.TOTP(secret)
        code = totp.now()

        result = MFAService.verify_totp(secret, code)

        assert result is True

    def test_verify_invalid_totp_code(self):
        """Test verifying an invalid TOTP code."""
        secret = MFAService.generate_totp_secret()

        result = MFAService.verify_totp(secret, "000000")

        assert result is False

    def test_verify_empty_totp_code(self):
        """Test verifying empty code."""
        secret = MFAService.generate_totp_secret()

        result = MFAService.verify_totp(secret, "")

        assert result is False


class TestBackupCodes:
    """Test backup code generation."""

    def test_generate_backup_codes(self):
        """Test backup code generation."""
        codes = MFAService.generate_backup_codes(10)

        assert len(codes) == 10
        assert all(isinstance(c, str) for c in codes)
        assert all(len(c) == 9 for c in codes)  # XXXX-XXXX format
        assert all("-" in c for c in codes)

    def test_backup_codes_are_unique(self):
        """Test that generated codes are unique."""
        codes = MFAService.generate_backup_codes(10)

        assert len(codes) == len(set(codes))

    def test_hash_backup_code(self):
        """Test backup code hashing."""
        code = "1234-5678"
        hash1 = MFAService.hash_backup_code(code)
        hash2 = MFAService.hash_backup_code(code)

        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 hex is 64 chars


class TestSMSCode:
    """Test SMS verification code generation."""

    def test_generate_sms_code(self):
        """Test SMS code generation."""
        code = MFAService.generate_sms_code(6)

        assert len(code) == 6
        assert code.isdigit()

    def test_sms_codes_are_unique(self):
        """Test that generated codes are unique."""
        codes = [MFAService.generate_sms_code(6) for _ in range(100)]

        # Should have high uniqueness (not all same)
        assert len(set(codes)) > 50


class TestDeviceFingerprint:
    """Test device fingerprint generation."""

    def test_generate_device_fingerprint(self):
        """Test device fingerprint generation."""
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        ip = "192.168.1.1"

        fingerprint = MFAService.generate_device_fingerprint(user_agent, ip)

        assert fingerprint is not None
        assert len(fingerprint) == 64  # SHA256
        assert isinstance(fingerprint, str)

    def test_fingerprint_consistency(self):
        """Test that fingerprint is consistent for same input."""
        user_agent = "Mozilla/5.0 (iPhone)"
        ip = "10.0.0.1"

        fp1 = MFAService.generate_device_fingerprint(user_agent, ip)
        fp2 = MFAService.generate_device_fingerprint(user_agent, ip)

        assert fp1 == fp2

    def test_fingerprint_differs_by_ua(self):
        """Test that fingerprint differs with different user agent."""
        ip = "192.168.1.1"

        fp1 = MFAService.generate_device_fingerprint("Chrome", ip)
        fp2 = MFAService.generate_device_fingerprint("Firefox", ip)

        assert fp1 != fp2


class TestPhoneMasking:
    """Test phone number masking for display."""

    def test_mask_phone_number(self):
        """Test phone masking."""
        phone = "+977-9841234567"
        masked = MFAService.mask_phone_number(phone)

        assert masked is not None
        assert "..." in masked
        assert masked.endswith("4567")  # Last 4 digits visible
        assert "1234567" not in masked  # Middle digits hidden

    def test_mask_short_phone(self):
        """Test masking short phone numbers."""
        phone = "+977"
        masked = MFAService.mask_phone_number(phone)

        assert masked == "***"


class TestEmailMasking:
    """Test email masking for display."""

    def test_mask_email(self):
        """Test email masking."""
        email = "john.doe@example.com"
        masked = MFAService.mask_email(email)

        assert masked is not None
        assert "***" in masked
        assert "example.com" in masked

    def test_mask_short_email(self):
        """Test masking short email local part."""
        email = "a@example.com"
        masked = MFAService.mask_email(email)

        assert "example.com" in masked

    def test_mask_invalid_email(self):
        """Test masking invalid email format."""
        email = "invalid"
        masked = MFAService.mask_email(email)

        assert masked == "***"


class TestUserMFAModel:
    """Test UserMFA model structure."""

    def test_user_mfa_defaults(self):
        """Test default values in UserMFA."""
        mfa = UserMFA()

        assert mfa.is_mfa_enabled is False
        assert mfa.trusted_devices_enabled is True
        assert mfa.totp_enabled is False
        assert mfa.sms_enabled is False
        assert mfa.email_enabled is False
        assert mfa.mfa_required is False
