"""API endpoints for internationalization and language management."""

import logging
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from uuid import UUID

from backend.app.database import get_db
from backend.app.security.auth_middleware import verify_jwt_token
from backend.app.i18n.service import get_i18n_service, SUPPORTED_LANGUAGES
from backend.app.i18n.middleware import get_language_dependency

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/i18n", tags=["internationalization"])


# Request/Response models
class LanguagePreferenceRequest(BaseModel):
    """Request to set user language preference."""
    language: str = Field(..., description="Language code (en or ne)")

    class Config:
        json_schema_extra = {
            "example": {"language": "ne"}
        }


class LanguagePreferenceResponse(BaseModel):
    """Response with user language preference."""
    user_id: str
    language_preference: str
    timestamp: str

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "12345678-1234-5678-1234-567812345678",
                "language_preference": "ne",
                "timestamp": "2026-09-23T10:30:45.123Z"
            }
        }


class TranslationResponse(BaseModel):
    """Response with translated content."""
    key: str
    en: str
    ne: str


class SupportedLanguagesResponse(BaseModel):
    """Response with supported languages."""
    supported_languages: List[str]
    default_language: str


@router.get("/languages", response_model=SupportedLanguagesResponse)
async def get_supported_languages():
    """Get list of supported languages.

    Returns:
        List of language codes and default language
    """
    return {
        "supported_languages": SUPPORTED_LANGUAGES,
        "default_language": "en"
    }


@router.get("/current-language")
async def get_current_language(
    request_language: str = Depends(get_language_dependency)
):
    """Get current language based on Accept-Language header and user preference.

    Returns:
        Current language code
    """
    return {
        "language": request_language
    }


@router.post("/preferences", response_model=LanguagePreferenceResponse)
async def set_language_preference(
    request: LanguagePreferenceRequest,
    token_data = Depends(verify_jwt_token),
    db = Depends(get_db),
):
    """Set user language preference.

    Args:
        request: Language preference request
        token_data: JWT token data (user info)
        db: Database session

    Returns:
        Updated language preference
    """
    from datetime import datetime
    from backend.app.models.auth import User

    # Validate language
    if request.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported language. Supported: {', '.join(SUPPORTED_LANGUAGES)}"
        )

    user_id = token_data.get("sub")

    # Get user and update language preference
    try:
        from sqlalchemy import select

        stmt = select(User).where(User.id == UUID(user_id))
        user = await db.execute(stmt)
        user = user.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        user.language_preference = request.language
        await db.commit()

        logger.info(f"User {user_id} language preference updated to {request.language}")

        return {
            "user_id": str(user_id),
            "language_preference": user.language_preference,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating language preference: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update language preference"
        )


@router.get("/preferences", response_model=LanguagePreferenceResponse)
async def get_language_preference(
    token_data = Depends(verify_jwt_token),
    db = Depends(get_db),
):
    """Get user language preference.

    Args:
        token_data: JWT token data (user info)
        db: Database session

    Returns:
        User language preference
    """
    from datetime import datetime
    from backend.app.models.auth import User
    from sqlalchemy import select

    user_id = token_data.get("sub")

    try:
        stmt = select(User).where(User.id == UUID(user_id))
        user = await db.execute(stmt)
        user = user.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        return {
            "user_id": str(user_id),
            "language_preference": user.language_preference or "en",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

    except Exception as e:
        logger.error(f"Error fetching language preference: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch language preference"
        )


@router.get("/translate/{key}", response_model=TranslationResponse)
async def get_translation(
    key: str,
):
    """Get translation for a key.

    Args:
        key: Translation key (e.g., 'capacity_mw')

    Returns:
        Translation in English and Nepali
    """
    from backend.app.i18n.translations import ALL_TRANSLATIONS

    if key not in ALL_TRANSLATIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Translation key '{key}' not found"
        )

    translation = ALL_TRANSLATIONS[key]

    return {
        "key": key,
        "en": translation.en,
        "ne": translation.ne
    }


@router.post("/translate-text")
async def translate_text(
    text: str,
    target_language: str = "ne",
    source_language: str = "en",
    current_language: str = Depends(get_language_dependency),
):
    """Translate text (lookup in translation dictionary).

    Note: This looks up exact matches in the translation dictionary.
    For custom text, a full translation service would be needed.

    Args:
        text: Text to translate (should be a translation key)
        target_language: Target language code
        source_language: Source language code
        current_language: Current language from request

    Returns:
        Translated text or original if not found
    """
    from backend.app.i18n.translations import get_translation

    i18n = get_i18n_service()

    # Try to find exact match in translations
    translated = get_translation(text, target_language)

    return {
        "original": text,
        "translated": translated,
        "source_language": source_language,
        "target_language": target_language,
        "current_language": current_language,
        "found": translated != text  # True if translation found
    }


@router.get("/translations")
async def list_all_translations(
    language: str = "en",
    category: str = None,  # field_labels, status_enums, error_messages, ui_labels, covenant_labels
):
    """Get all translations or filtered by category.

    Args:
        language: Language code (en or ne)
        category: Filter by category

    Returns:
        Dictionary of translations
    """
    from backend.app.i18n.translations import (
        FIELD_LABELS, STATUS_ENUMS, LOAN_STATUS_ENUMS, ROLE_ENUMS,
        ERROR_MESSAGES, UI_LABELS, COVENANT_LABELS
    )

    categories = {
        "field_labels": FIELD_LABELS,
        "status_enums": STATUS_ENUMS,
        "loan_status_enums": LOAN_STATUS_ENUMS,
        "role_enums": ROLE_ENUMS,
        "error_messages": ERROR_MESSAGES,
        "ui_labels": UI_LABELS,
        "covenant_labels": COVENANT_LABELS,
    }

    if category and category not in categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category. Supported: {', '.join(categories.keys())}"
        )

    i18n = get_i18n_service()

    if not category:
        # Return all translations
        result = {}
        for cat_name, cat_dict in categories.items():
            result[cat_name] = {
                key: translation.ne if language == "ne" else translation.en
                for key, translation in cat_dict.items()
            }
        return result

    # Return specific category
    cat_dict = categories[category]
    return {
        category: {
            key: translation.ne if language == "ne" else translation.en
            for key, translation in cat_dict.items()
        }
    }
