"""Tests for i18n calendar conversion and multi-tenant translations (Phase 4.5)."""

import pytest
from datetime import datetime
from uuid import uuid4, UUID

from backend.app.i18n.calendar import CalendarConverter
from backend.app.i18n.multi_tenant import (
    TenantTranslation,
    TenantTranslationManager,
    get_tenant_translation_manager,
)


class TestCalendarConverter:
    """Test Bikram Sambat calendar conversion."""

    def test_ad_to_bs_basic(self):
        """Test converting AD date to BS."""
        ad_date = datetime(2026, 9, 23)  # September 23, 2026 AD
        bs_year, bs_month, bs_day = CalendarConverter.ad_to_bs(ad_date)

        assert bs_year is not None
        assert bs_month >= 1 and bs_month <= 12
        assert bs_day >= 1 and bs_day <= 32

    def test_ad_to_bs_known_date(self):
        """Test converting known AD date."""
        # 2000-01-01 AD should be around 1943-09-17 BS
        ad_date = datetime(2000, 1, 1)
        bs_year, bs_month, bs_day = CalendarConverter.ad_to_bs(ad_date)

        # Should be approximately year 1943
        assert bs_year >= 1942 and bs_year <= 1944

    def test_bs_to_ad_basic(self):
        """Test converting BS date to AD."""
        ad_date = CalendarConverter.bs_to_ad(2083, 6, 8)

        assert ad_date is not None
        assert isinstance(ad_date, datetime)
        assert ad_date.year > 1950

    def test_bs_to_ad_roundtrip(self):
        """Test roundtrip conversion (AD -> BS -> AD)."""
        original_ad = datetime(2026, 9, 23)

        # Convert to BS
        bs_year, bs_month, bs_day = CalendarConverter.ad_to_bs(original_ad)

        # Convert back to AD
        recovered_ad = CalendarConverter.bs_to_ad(bs_year, bs_month, bs_day)

        # Should be close to original (within a few days due to lunar calendar)
        diff = abs((recovered_ad - original_ad).days)
        assert diff <= 1

    def test_format_bs_english(self):
        """Test formatting BS date in English."""
        formatted = CalendarConverter.format_bs(2083, 6, 8, "en")

        assert formatted is not None
        assert "2083" in formatted
        assert "8" in formatted

    def test_format_bs_nepali(self):
        """Test formatting BS date in Nepali."""
        formatted = CalendarConverter.format_bs(2083, 6, 8, "ne")

        assert formatted is not None
        assert "2083" in formatted

    def test_today_bs(self):
        """Test getting today's date in BS."""
        bs_year, bs_month, bs_day = CalendarConverter.today_bs()

        assert bs_year > 1900  # BS year in the 1900s range
        assert bs_month >= 1 and bs_month <= 12
        assert bs_day >= 1 and bs_day <= 32

    def test_is_valid_bs_date(self):
        """Test BS date validation."""
        assert CalendarConverter.is_valid_bs_date(2083, 6, 8) is True
        assert CalendarConverter.is_valid_bs_date(2083, 13, 8) is False  # Month > 12
        assert CalendarConverter.is_valid_bs_date(2083, 6, 33) is False  # Day > 32

    def test_bs_month_names_english(self):
        """Test English BS month names."""
        for month in range(1, 13):
            formatted = CalendarConverter.format_bs(2083, month, 1, "en")
            assert formatted is not None

    def test_bs_month_names_nepali(self):
        """Test Nepali BS month names."""
        for month in range(1, 13):
            formatted = CalendarConverter.format_bs(2083, month, 1, "ne")
            assert formatted is not None

    def test_ad_to_bs_leap_year(self):
        """Test conversion during leap year."""
        leap_date = datetime(2024, 2, 29)  # Feb 29, 2024 (leap year)
        bs_year, bs_month, bs_day = CalendarConverter.ad_to_bs(leap_date)

        assert bs_year is not None
        assert bs_month is not None
        assert bs_day is not None

    def test_ad_to_bs_year_boundary(self):
        """Test conversion at year boundary."""
        # Test Dec 31
        dec31 = datetime(2025, 12, 31)
        bs_year_dec, _, _ = CalendarConverter.ad_to_bs(dec31)

        # Test Jan 1
        jan1 = datetime(2026, 1, 1)
        bs_year_jan, _, _ = CalendarConverter.ad_to_bs(jan1)

        # Should be close or same year
        assert abs(bs_year_jan - bs_year_dec) <= 1

    def test_get_bs_year_range(self):
        """Test getting valid BS year range."""
        min_year, max_year = CalendarConverter.get_bs_year_range()

        assert min_year < max_year
        assert min_year >= 1900
        assert max_year <= 2200


class TestTenantTranslation:
    """Test TenantTranslation class."""

    def test_create_translation(self):
        """Test creating translation object."""
        org_id = uuid4()
        trans = TenantTranslation(
            org_id=org_id,
            key="capacity_mw",
            language="ne",
            value="क्षमता (मेगावाट)",
        )

        assert trans.org_id == org_id
        assert trans.key == "capacity_mw"
        assert trans.language == "ne"
        assert trans.version == 1

    def test_translation_to_dict(self):
        """Test converting translation to dictionary."""
        org_id = uuid4()
        trans = TenantTranslation(
            org_id=org_id,
            key="status",
            language="en",
            value="Active",
        )

        trans_dict = trans.to_dict()

        assert trans_dict["key"] == "status"
        assert trans_dict["language"] == "en"
        assert "org_id" in trans_dict


class TestTenantTranslationManager:
    """Test TenantTranslationManager."""

    def test_set_translation(self):
        """Test setting organization translation."""
        manager = TenantTranslationManager()
        org_id = uuid4()

        trans = manager.set_translation(
            org_id=org_id,
            key="project_name",
            language="ne",
            value="परियोजना नाम",
        )

        assert trans is not None
        assert trans.value == "परियोजना नाम"
        assert trans.version == 1

    def test_get_translation(self):
        """Test getting organization translation."""
        manager = TenantTranslationManager()
        org_id = uuid4()

        manager.set_translation(
            org_id=org_id,
            key="status",
            language="ne",
            value="स्थिति",
        )

        value = manager.get_translation(org_id, "status", "ne", False)

        assert value == "स्थिति"

    def test_get_translation_not_found(self):
        """Test getting non-existent translation."""
        manager = TenantTranslationManager()
        org_id = uuid4()

        value = manager.get_translation(org_id, "nonexistent", "ne", False)

        assert value is None

    def test_update_translation_version(self):
        """Test updating translation increments version."""
        manager = TenantTranslationManager()
        org_id = uuid4()

        trans1 = manager.set_translation(
            org_id=org_id,
            key="status",
            language="ne",
            value="स्थिति",
        )

        trans2 = manager.set_translation(
            org_id=org_id,
            key="status",
            language="ne",
            value="स्थिति (अद्यतन)",
        )

        assert trans2.version == trans1.version + 1

    def test_delete_translation(self):
        """Test deleting translation."""
        manager = TenantTranslationManager()
        org_id = uuid4()

        manager.set_translation(
            org_id=org_id,
            key="status",
            language="ne",
            value="स्थिति",
        )

        deleted = manager.delete_translation(org_id, "status", "ne")

        assert deleted is True

        value = manager.get_translation(org_id, "status", "ne", False)
        assert value is None

    def test_get_all_translations(self):
        """Test getting all org translations."""
        manager = TenantTranslationManager()
        org_id = uuid4()

        manager.set_translation(org_id, "key1", "en", "value1")
        manager.set_translation(org_id, "key1", "ne", "value1_ne")
        manager.set_translation(org_id, "key2", "en", "value2")

        all_trans = manager.get_all_translations(org_id)

        assert "key1" in all_trans
        assert "key2" in all_trans
        assert all_trans["key1"]["en"] == "value1"
        assert all_trans["key1"]["ne"] == "value1_ne"

    def test_version_history(self):
        """Test tracking version history."""
        manager = TenantTranslationManager()
        org_id = uuid4()

        manager.set_translation(org_id, "status", "ne", "version1")
        manager.set_translation(org_id, "status", "ne", "version2")
        manager.set_translation(org_id, "status", "ne", "version3")

        history = manager.get_version_history(org_id, "status", "ne")

        assert len(history) == 3
        assert history[0].version == 1
        assert history[1].version == 2
        assert history[2].version == 3

    def test_rollback_translation(self):
        """Test rolling back to previous version."""
        manager = TenantTranslationManager()
        org_id = uuid4()

        manager.set_translation(org_id, "status", "ne", "version1")
        manager.set_translation(org_id, "status", "ne", "version2")
        manager.set_translation(org_id, "status", "ne", "version3")

        # Rollback to version 1
        rolled_back = manager.rollback_translation(org_id, "status", "ne", 1)

        assert rolled_back is not None
        assert rolled_back.value == "version1"

        # Verify current is version 1
        current = manager.get_translation(org_id, "status", "ne", False)
        assert current == "version1"

    def test_clear_org_translations(self):
        """Test clearing all org translations."""
        manager = TenantTranslationManager()
        org_id = uuid4()
        other_org = uuid4()

        manager.set_translation(org_id, "key1", "en", "value1")
        manager.set_translation(org_id, "key2", "ne", "value2")
        manager.set_translation(other_org, "key1", "en", "other_value")

        count = manager.clear_org_translations(org_id)

        assert count == 2

        # Verify cleared
        assert manager.get_translation(org_id, "key1", "en", False) is None
        assert manager.get_translation(org_id, "key2", "ne", False) is None

        # Verify other org unaffected
        assert manager.get_translation(other_org, "key1", "en", False) == "other_value"

    def test_export_translations_json(self):
        """Test exporting translations as JSON."""
        manager = TenantTranslationManager()
        org_id = uuid4()

        manager.set_translation(org_id, "status", "en", "Status")
        manager.set_translation(org_id, "status", "ne", "स्थिति")

        exported = manager.export_translations(org_id, "json")

        assert exported is not None
        assert "status" in exported
        assert "Status" in exported

    def test_export_translations_csv(self):
        """Test exporting translations as CSV."""
        manager = TenantTranslationManager()
        org_id = uuid4()

        manager.set_translation(org_id, "status", "en", "Status")
        manager.set_translation(org_id, "status", "ne", "स्थिति")

        exported = manager.export_translations(org_id, "csv")

        assert exported is not None
        assert "status" in exported
        assert "en" in exported
        assert "ne" in exported

    def test_import_translations_json(self):
        """Test importing translations from JSON."""
        manager = TenantTranslationManager()
        org_id = uuid4()

        json_data = '{"status": {"en": "Status", "ne": "स्थिति"}}'

        count = manager.import_translations(org_id, json_data, "json")

        assert count == 2
        assert manager.get_translation(org_id, "status", "en", False) == "Status"
        assert manager.get_translation(org_id, "status", "ne", False) == "स्थिति"

    def test_import_translations_csv(self):
        """Test importing translations from CSV."""
        manager = TenantTranslationManager()
        org_id = uuid4()

        csv_data = 'key,language,value\nstatus,en,Status\nstatus,ne,स्थिति'

        count = manager.import_translations(org_id, csv_data, "csv")

        assert count == 2

    def test_singleton_pattern(self):
        """Test global singleton pattern."""
        manager1 = get_tenant_translation_manager()
        manager2 = get_tenant_translation_manager()

        assert manager1 is manager2

    def test_multiple_orgs_isolation(self):
        """Test translation isolation between organizations."""
        manager = TenantTranslationManager()
        org1 = uuid4()
        org2 = uuid4()

        manager.set_translation(org1, "status", "ne", "स्थिति_org1")
        manager.set_translation(org2, "status", "ne", "स्थिति_org2")

        value1 = manager.get_translation(org1, "status", "ne", False)
        value2 = manager.get_translation(org2, "status", "ne", False)

        assert value1 == "स्थिति_org1"
        assert value2 == "स्थिति_org2"
        assert value1 != value2
