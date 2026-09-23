"""Internationalization service for language detection and translation."""

import logging
from typing import Optional, Dict, List
from datetime import datetime
from uuid import UUID

from .translations import get_translation, translate_dict

logger = logging.getLogger(__name__)

# Supported languages
SUPPORTED_LANGUAGES = ["en", "ne"]  # English, Nepali
DEFAULT_LANGUAGE = "en"


class I18nService:
    """Service for managing internationalization and translations."""

    def __init__(self, default_language: str = DEFAULT_LANGUAGE):
        """Initialize i18n service.

        Args:
            default_language: Default language code
        """
        self.default_language = default_language
        self.supported_languages = SUPPORTED_LANGUAGES

    def get_language_from_header(self, accept_language: Optional[str]) -> str:
        """Extract language from Accept-Language header.

        Args:
            accept_language: Accept-Language header value

        Returns:
            Language code (en or ne)
        """
        if not accept_language:
            return self.default_language

        # Parse Accept-Language header (e.g., "ne-NP,ne;q=0.9,en;q=0.8")
        languages = []
        for part in accept_language.split(","):
            lang_part = part.strip().split(";")[0].strip().lower()
            # Extract main language code (e.g., "ne" from "ne-NP")
            lang_code = lang_part.split("-")[0]

            if lang_code in self.supported_languages:
                languages.append(lang_code)

        return languages[0] if languages else self.default_language

    def detect_language(
        self,
        accept_language: Optional[str] = None,
        user_language_preference: Optional[str] = None,
    ) -> str:
        """Detect language from header and user preference.

        Args:
            accept_language: Accept-Language header
            user_language_preference: User's stored language preference

        Returns:
            Language code (en or ne)
        """
        # Priority: user preference > accept-language header > default
        if user_language_preference and user_language_preference in self.supported_languages:
            return user_language_preference

        lang = self.get_language_from_header(accept_language)
        return lang if lang in self.supported_languages else self.default_language

    def translate(self, key: str, language: Optional[str] = None) -> str:
        """Translate a single key.

        Args:
            key: Translation key
            language: Language code (uses default if None)

        Returns:
            Translated string
        """
        if language is None:
            language = self.default_language

        return get_translation(key, language)

    def translate_dict(
        self,
        data: Dict,
        language: Optional[str] = None,
        translate_keys: bool = True,
    ) -> Dict:
        """Translate dictionary keys and enum values.

        Args:
            data: Dictionary to translate
            language: Language code (uses default if None)
            translate_keys: Whether to translate dictionary keys

        Returns:
            Translated dictionary
        """
        if language is None:
            language = self.default_language

        if not translate_keys:
            # Only translate values (enums)
            result = {}
            for key, value in data.items():
                if isinstance(value, str):
                    result[key] = get_translation(value, language)
                elif isinstance(value, dict):
                    result[key] = self.translate_dict(value, language, translate_keys)
                elif isinstance(value, list):
                    result[key] = [
                        get_translation(item, language) if isinstance(item, str) else item
                        for item in value
                    ]
                else:
                    result[key] = value
            return result

        return translate_dict(data, language)

    def format_date(self, date: datetime, language: Optional[str] = None) -> str:
        """Format date according to locale.

        Args:
            date: Date to format
            language: Language code (uses default if None)

        Returns:
            Formatted date string
        """
        if language is None:
            language = self.default_language

        if language == "ne":
            # Nepali format: DD Magh YYYY (AD → BS conversion needed)
            # For now, return simple format
            return date.strftime("%d/%m/%Y")

        # English format: MM/DD/YYYY
        return date.strftime("%m/%d/%Y")

    def format_number(self, number: float, language: Optional[str] = None) -> str:
        """Format number according to locale.

        Args:
            number: Number to format
            language: Language code (uses default if None)

        Returns:
            Formatted number string
        """
        if language is None:
            language = self.default_language

        if language == "ne":
            # Nepali uses different separators
            # For now, use comma separator with 2 decimal places
            return f"{number:,.2f}"

        # English uses comma separator with 2 decimal places
        return f"{number:,.2f}"

    def get_error_message(self, error_key: str, language: Optional[str] = None) -> str:
        """Get translated error message.

        Args:
            error_key: Error key (e.g., 'unauthorized', 'not_found')
            language: Language code (uses default if None)

        Returns:
            Translated error message
        """
        if language is None:
            language = self.default_language

        return self.translate(error_key, language)

    def get_label(self, label_key: str, language: Optional[str] = None) -> str:
        """Get translated field label.

        Args:
            label_key: Label key (e.g., 'capacity_mw', 'project_name')
            language: Language code (uses default if None)

        Returns:
            Translated label
        """
        if language is None:
            language = self.default_language

        return self.translate(label_key, language)


# Global instance
_i18n_service: Optional[I18nService] = None


def get_i18n_service() -> I18nService:
    """Get or create global i18n service.

    Returns:
        I18nService instance
    """
    global _i18n_service
    if _i18n_service is None:
        _i18n_service = I18nService()
    return _i18n_service


def set_i18n_service(service: I18nService) -> None:
    """Set global i18n service.

    Args:
        service: I18nService instance
    """
    global _i18n_service
    _i18n_service = service
