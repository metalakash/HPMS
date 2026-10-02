"""MFA endpoints for TOTP setup and verification."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, Body
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.database import get_db
from backend.app.security.auth_middleware import CurrentUser, get_current_user, require_admin
from backend.app.models.mfa import UserMFA, BackupCode, TrustedDevice
from backend.app.models.auth import User
from backend.app.services.mfa_service import MFAService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/mfa", tags=["mfa"])


class MFASetupResponse(BaseModel):
    """TOTP setup response."""
    totp_uri: str
    qr_code_base64: str  # Base64-encoded PNG


class MFAVerifyRequest(BaseModel):
    """TOTP verification request."""
    code: str  # 6-digit code from authenticator


class MFAVerifyResponse(BaseModel):
    """TOTP verification response."""
    success: bool
    message: str
    mfa_verified: bool


class BackupCodesResponse(BaseModel):
    """Backup codes response."""
    codes: list[str]
    message: str


class TrustedDeviceRequest(BaseModel):
    """Mark device as trusted request."""
    device_name: Optional[str] = None  # e.g., "Chrome on MacBook"
    trust_for_days: int = 30


class TrustedDeviceResponse(BaseModel):
    """Trusted device response."""
    device_id: UUID
    device_name: Optional[str]
    trusted_until: datetime
    message: str


class MFAStatusResponse(BaseModel):
    """Current MFA status for user."""
    is_enabled: bool
    primary_method: Optional[str]
    totp_enabled: bool
    sms_enabled: bool
    email_enabled: bool
    trusted_devices_enabled: bool
    backup_codes_available: int
    phone_masked: Optional[str]
    mfa_required: bool


@router.post("/setup", response_model=MFASetupResponse)
async def setup_mfa(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Setup TOTP for current user.

    Returns otpauth:// URI and QR code PNG for scanning with authenticator app.
    """
    try:
        totp_uri, qr_code_bytes = await MFAService.setup_totp(db, current_user.uuid)

        # Convert PNG bytes to base64 for JSON response
        import base64
        qr_code_base64 = base64.b64encode(qr_code_bytes).decode()

        await db.commit()

        return MFASetupResponse(
            totp_uri=totp_uri,
            qr_code_base64=qr_code_base64,
        )

    except Exception as e:
        logger.error(f"TOTP setup failed for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to setup MFA",
        )


@router.post("/verify", response_model=MFAVerifyResponse)
async def verify_totp(
    request: MFAVerifyRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify TOTP code and enable MFA for user."""

    if not request.code or len(request.code) != 6 or not request.code.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code must be 6 digits",
        )

    try:
        # Get user MFA
        query = select(UserMFA).where(UserMFA.user_id == current_user.uuid)
        result = await db.execute(query)
        user_mfa = result.scalar_one_or_none()

        if not user_mfa or not user_mfa.totp_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA not yet setup",
            )

        # Verify code
        counter = MFAService.verify_totp_step(user_mfa.totp_secret, request.code)
        is_valid = counter is not None

        if not is_valid:
            user_mfa.failed_attempts = str(int(user_mfa.failed_attempts or 0) + 1)

            # Lock after 5 failed attempts
            if int(user_mfa.failed_attempts or 0) >= 5:
                user_mfa.locked_until = datetime.utcnow() + timedelta(minutes=15)
                await db.commit()

                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many failed attempts. Account locked for 15 minutes.",
                )

            await db.commit()

            return MFAVerifyResponse(
                success=False,
                message="Invalid code",
                mfa_verified=False,
            )

        # Code is valid - enable MFA
        user_mfa.is_mfa_enabled = True
        user_mfa.totp_enabled = True
        user_mfa.totp_verified_at = datetime.utcnow()
        user_mfa.primary_method = "totp"
        user_mfa.failed_attempts = "0"
        user_mfa.locked_until = None
        user_mfa.last_mfa_used_at = datetime.utcnow()
        user_mfa.last_totp_counter = counter

        await db.commit()

        logger.info(f"TOTP verified and enabled for user {current_user.id}")

        return MFAVerifyResponse(
            success=True,
            message="MFA successfully enabled",
            mfa_verified=True,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TOTP verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Verification failed",
        )


@router.post("/backup-codes", response_model=BackupCodesResponse)
async def generate_backup_codes(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate 10 backup codes for account recovery."""

    try:
        # Get user MFA
        query = select(UserMFA).where(UserMFA.user_id == current_user.uuid)
        result = await db.execute(query)
        user_mfa = result.scalar_one_or_none()

        if not user_mfa or not user_mfa.is_mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Enable MFA before generating backup codes",
            )

        # Delete existing backup codes
        delete_query = select(BackupCode).where(BackupCode.user_mfa_id == user_mfa.id)
        delete_result = await db.execute(delete_query)
        for code in delete_result.scalars():
            await db.delete(code)

        # Generate new codes
        codes = MFAService.generate_backup_codes(10)

        # Store hashed codes in database
        for code in codes:
            backup_code = BackupCode(
                user_mfa_id=user_mfa.id,
                code=MFAService.hash_backup_code(code),
            )
            db.add(backup_code)

        user_mfa.backup_codes_generated_at = datetime.utcnow()
        user_mfa.backup_codes_regenerated_count = str(int(user_mfa.backup_codes_regenerated_count or 0) + 1)

        await db.commit()

        logger.info(f"Generated backup codes for user {current_user.id}")

        return BackupCodesResponse(
            codes=codes,
            message="Backup codes generated. Store them in a safe place.",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Backup code generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate codes",
        )


@router.post("/trusted-device", response_model=TrustedDeviceResponse)
async def mark_device_trusted(
    request: TrustedDeviceRequest,
    user_agent: Optional[str] = None,  # Would come from headers in real implementation
    ip_address: Optional[str] = None,  # Would come from request context
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark current device as trusted for 30 days (or custom period)."""

    try:
        # Get user MFA
        query = select(UserMFA).where(UserMFA.user_id == current_user.uuid)
        result = await db.execute(query)
        user_mfa = result.scalar_one_or_none()

        if not user_mfa:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA not setup",
            )

        # Generate device fingerprint
        device_fingerprint = MFAService.generate_device_fingerprint(
            user_agent or "unknown",
            ip_address or "unknown",
        )

        # Create trusted device
        trusted_device = TrustedDevice(
            user_mfa_id=user_mfa.id,
            device_name=request.device_name,
            device_fingerprint=device_fingerprint,
            trusted_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=request.trust_for_days),
        )

        db.add(trusted_device)
        await db.commit()

        logger.info(f"Device marked as trusted for user {current_user.id}")

        return TrustedDeviceResponse(
            device_id=trusted_device.id,
            device_name=request.device_name,
            trusted_until=trusted_device.expires_at,
            message=f"Device trusted until {trusted_device.expires_at.date()}",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Device trust setup failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to trust device",
        )


@router.get("/status", response_model=MFAStatusResponse)
async def get_mfa_status(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current MFA status for user."""

    try:
        # Get user MFA
        query = select(UserMFA).where(UserMFA.user_id == current_user.uuid)
        result = await db.execute(query)
        user_mfa = result.scalar_one_or_none()

        if not user_mfa:
            return MFAStatusResponse(
                is_enabled=False,
                primary_method=None,
                totp_enabled=False,
                sms_enabled=False,
                email_enabled=False,
                trusted_devices_enabled=True,
                backup_codes_available=0,
                phone_masked=None,
                mfa_required=False,
            )

        # Count unused backup codes
        backup_codes_query = select(BackupCode).where(
            (BackupCode.user_mfa_id == user_mfa.id) & (BackupCode.is_used == False)
        )
        backup_codes_result = await db.execute(backup_codes_query)
        backup_codes_available = len(backup_codes_result.scalars().all())

        phone_masked = None
        if user_mfa.phone_number:
            phone_masked = MFAService.mask_phone_number(user_mfa.phone_number)

        return MFAStatusResponse(
            is_enabled=user_mfa.is_mfa_enabled,
            primary_method=user_mfa.primary_method,
            totp_enabled=user_mfa.totp_enabled,
            sms_enabled=user_mfa.sms_enabled,
            email_enabled=user_mfa.email_enabled,
            trusted_devices_enabled=user_mfa.trusted_devices_enabled,
            backup_codes_available=backup_codes_available,
            phone_masked=phone_masked,
            mfa_required=user_mfa.mfa_required,
        )

    except Exception as e:
        logger.error(f"Failed to get MFA status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get MFA status",
        )


class MFADisableRequest(BaseModel):
    code: str  # current authenticator code or an unused backup code


@router.delete("/disable")
async def disable_mfa(
    body: MFADisableRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable MFA for the current user. Needs a current code, so a stolen session cannot switch MFA off."""

    user_mfa = (await db.execute(select(UserMFA).where(UserMFA.user_id == current_user.uuid))).scalar_one_or_none()
    if not user_mfa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MFA not configured")

    if user_mfa.is_mfa_enabled:
        outcome = await MFAService.verify_second_factor(db, user_mfa, body.code)
        await db.commit()  # persist failure counters / spent backup code
        if outcome == "locked":
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                                detail="Too many failed codes. Try again later.")
        if outcome != "ok":
            # 403, not 401: the session is fine, only this confirmation failed (401 makes clients sign the user out)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid code")

    await _clear_mfa(db, user_mfa)
    await db.commit()
    logger.info(f"MFA disabled for user {current_user.id}")
    return {"message": "MFA disabled"}


async def _clear_mfa(db: AsyncSession, user_mfa: UserMFA) -> None:
    user_mfa.is_mfa_enabled = False
    user_mfa.totp_enabled = False
    user_mfa.sms_enabled = False
    user_mfa.email_enabled = False
    user_mfa.totp_secret = None
    user_mfa.last_totp_counter = None
    user_mfa.failed_attempts = "0"
    user_mfa.locked_until = None
    for row in (await db.execute(select(BackupCode).where(BackupCode.user_mfa_id == user_mfa.id))).scalars().all():
        await db.delete(row)


@router.delete("/admin/{username}")
async def admin_reset_mfa(
    username: str,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin recovery for a user who lost their device and backup codes: switch their MFA off so they can re-enrol.

    Written to the audit trail with the acting admin.
    """
    from backend.app.services.audit_chain import append_audit_log

    target = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    user_mfa = None
    if target is not None:
        user_mfa = (await db.execute(select(UserMFA).where(UserMFA.user_id == target.id))).scalar_one_or_none()
    if target is None or user_mfa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No MFA configured for that user")

    await _clear_mfa(db, user_mfa)
    await append_audit_log(
        db, user_id=current_user.id or current_user.username, user_role="admin", entity_type="USER_MFA",
        entity_id=target.id, action="update", reason=f"MFA reset by administrator for {username}",
        pre_state={"is_mfa_enabled": True}, post_state={"is_mfa_enabled": False})
    await db.commit()
    logger.warning(f"MFA reset for {username} by {current_user.username}")
    return {"message": f"MFA reset for {username}"}
