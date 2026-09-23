"""Multi-tenant and custom translation support (Phase 4.5)."""

import logging
from typing import Dict, Optional, Tuple
from uuid import UUID
from datetime import datetime

logger = logging.getLogger(__name__)


class TenantTranslation:
    """Organization-specific translation override."""

    def __init__(
        self,
        org_id: UUID,
        key: str,
        language: str,
        value: str,
        version: int = 1,
        created_at: datetime = None,
    ):
        """Initialize tenant translation.

        Args:
            org_id: Organization ID
            key: Translation key
            language: Language code (en, ne)
            value: Translated value
            version: Translation version
            created_at: Creation timestamp
        """
        self.org_id = org_id
        self.key = key
        self.language = language
        self.value = value
        self.version = version
        self.created_at = created_at or datetime.utcnow()

    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            "org_id": str(self.org_id),
            "key": self.key,
            "language": self.language,
            "value": self.value,
            "version": self.version,
            "created_at": self.created_at.isoformat() + "Z",
        }


class TenantTranslationManager:
    """Manage organization-specific translation overrides."""

    def __init__(self):
        """Initialize translation manager."""
        # In-memory storage for tenant translations
        # In production, would use database
        self.translations: Dict[Tuple[UUID, str, str], TenantTranslation] = {}
        self.version_history: Dict[Tuple[UUID, str, str], list] = {}

    def set_translation(
        self,
        org_id: UUID,
        key: str,
        language: str,
        value: str,
    ) -> TenantTranslation:
        """Set or update organization-specific translation.

        Args:
            org_id: Organization ID
            key: Translation key
            language: Language code
            value: Translated value

        Returns:
            TenantTranslation object
        """
        try:
            translation_key = (org_id, key, language)

            # Get current version if exists
            current = self.translations.get(translation_key)
            version = (current.version + 1) if current else 1

            # Create new translation
            translation = TenantTranslation(
                org_id=org_id,
                key=key,
                language=language,
                value=value,
                version=version,
            )

            # Store
            self.translations[translation_key] = translation

            # Record version history
            if translation_key not in self.version_history:
                self.version_history[translation_key] = []
            self.version_history[translation_key].append(translation)

            logger.info(
                f"Set tenant translation: org={org_id}, key={key}, lang={language}, v{version}"
            )
            return translation

        except Exception as e:
            logger.error(f"Error setting tenant translation: {e}")
            raise

    def get_translation(
        self,
        org_id: UUID,
        key: str,
        language: str,
        fallback_to_default: bool = True,
    ) -> Optional[str]:
        """Get organization-specific translation with fallback.

        Args:
            org_id: Organization ID
            key: Translation key
            language: Language code
            fallback_to_default: Fall back to default translation if not found

        Returns:
            Translated value or None
        """
        try:
            translation_key = (org_id, key, language)

            # Check tenant override
            if translation_key in self.translations:
                return self.translations[translation_key].value

            logger.debug(f"Tenant translation not found: {translation_key}")
            return None

        except Exception as e:
            logger.error(f"Error getting tenant translation: {e}")
            return None

    def delete_translation(self, org_id: UUID, key: str, language: str) -> bool:
        """Delete organization-specific translation.

        Args:
            org_id: Organization ID
            key: Translation key
            language: Language code

        Returns:
            True if deleted, False if not found
        """
        try:
            translation_key = (org_id, key, language)

            if translation_key in self.translations:
                del self.translations[translation_key]
                logger.info(f"Deleted tenant translation: {translation_key}")
                return True

            return False

        except Exception as e:
            logger.error(f"Error deleting tenant translation: {e}")
            return False

    def get_all_translations(self, org_id: UUID) -> Dict[str, Dict[str, str]]:
        """Get all translations for organization.

        Args:
            org_id: Organization ID

        Returns:
            Dictionary of {key: {language: value}}
        """
        try:
            result = {}

            for (org, key, lang), translation in self.translations.items():
                if org == org_id:
                    if key not in result:
                        result[key] = {}
                    result[key][lang] = translation.value

            return result

        except Exception as e:
            logger.error(f"Error getting all tenant translations: {e}")
            return {}

    def get_version_history(
        self,
        org_id: UUID,
        key: str,
        language: str,
    ) -> list:
        """Get version history for a translation.

        Args:
            org_id: Organization ID
            key: Translation key
            language: Language code

        Returns:
            List of TenantTranslation objects (versions)
        """
        try:
            translation_key = (org_id, key, language)

            if translation_key in self.version_history:
                return self.version_history[translation_key]

            return []

        except Exception as e:
            logger.error(f"Error getting version history: {e}")
            return []

    def rollback_translation(
        self,
        org_id: UUID,
        key: str,
        language: str,
        version: int,
    ) -> Optional[TenantTranslation]:
        """Rollback translation to specific version.

        Args:
            org_id: Organization ID
            key: Translation key
            language: Language code
            version: Version number to rollback to

        Returns:
            Restored TenantTranslation or None
        """
        try:
            translation_key = (org_id, key, language)
            history = self.version_history.get(translation_key, [])

            # Find version in history
            for translation in history:
                if translation.version == version:
                    # Restore this version
                    self.translations[translation_key] = translation
                    logger.info(
                        f"Rolled back translation: {translation_key} to v{version}"
                    )
                    return translation

            logger.warning(f"Version not found in history: {translation_key} v{version}")
            return None

        except Exception as e:
            logger.error(f"Error rolling back translation: {e}")
            return None

    def clear_org_translations(self, org_id: UUID) -> int:
        """Clear all translations for organization.

        Args:
            org_id: Organization ID

        Returns:
            Number of translations deleted
        """
        try:
            count = 0
            keys_to_delete = []

            for key in self.translations.keys():
                org, _, _ = key
                if org == org_id:
                    keys_to_delete.append(key)

            for key in keys_to_delete:
                del self.translations[key]
                count += 1

            logger.info(f"Cleared {count} translations for org {org_id}")
            return count

        except Exception as e:
            logger.error(f"Error clearing org translations: {e}")
            return 0

    def export_translations(
        self,
        org_id: UUID,
        format: str = "json",
    ) -> str:
        """Export organization translations to format.

        Args:
            org_id: Organization ID
            format: 'json' or 'csv'

        Returns:
            Formatted string
        """
        try:
            translations = self.get_all_translations(org_id)

            if format == "csv":
                # CSV format: key,language,value
                lines = ["key,language,value"]
                for key, langs in translations.items():
                    for lang, value in langs.items():
                        # Escape commas and quotes
                        escaped_value = value.replace('"', '""')
                        lines.append(f'{key},{lang},"{escaped_value}"')
                return "\n".join(lines)
            else:
                # JSON format
                import json
                return json.dumps(translations, indent=2)

        except Exception as e:
            logger.error(f"Error exporting translations: {e}")
            return ""

    def import_translations(
        self,
        org_id: UUID,
        data: str,
        format: str = "json",
        overwrite: bool = False,
    ) -> int:
        """Import translations for organization.

        Args:
            org_id: Organization ID
            data: Formatted translation data
            format: 'json' or 'csv'
            overwrite: Whether to overwrite existing

        Returns:
            Number of translations imported
        """
        try:
            count = 0

            if format == "csv":
                import csv
                from io import StringIO

                reader = csv.DictReader(StringIO(data))
                for row in reader:
                    if row.get("key") and row.get("language") and row.get("value"):
                        if not overwrite:
                            existing = self.get_translation(
                                org_id, row["key"], row["language"], False
                            )
                            if existing:
                                continue

                        self.set_translation(
                            org_id, row["key"], row["language"], row["value"]
                        )
                        count += 1

            else:
                import json

                translations = json.loads(data)
                for key, langs in translations.items():
                    for lang, value in langs.items():
                        if not overwrite:
                            existing = self.get_translation(org_id, key, lang, False)
                            if existing:
                                continue

                        self.set_translation(org_id, key, lang, value)
                        count += 1

            logger.info(f"Imported {count} translations for org {org_id}")
            return count

        except Exception as e:
            logger.error(f"Error importing translations: {e}")
            return 0


# Global instance
_tenant_translation_manager: Optional[TenantTranslationManager] = None


def get_tenant_translation_manager() -> TenantTranslationManager:
    """Get or create global tenant translation manager.

    Returns:
        TenantTranslationManager instance
    """
    global _tenant_translation_manager
    if _tenant_translation_manager is None:
        _tenant_translation_manager = TenantTranslationManager()
    return _tenant_translation_manager
