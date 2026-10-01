"""Calendar conversion for Gregorian (AD) and Bikram Sambat (BS) (Phase 4.5)."""

import logging
from datetime import datetime
from typing import Tuple

import nepali_datetime

logger = logging.getLogger(__name__)


class CalendarConverter:
    """Convert between Gregorian (AD) and Bikram Sambat (BS) using the official
    month-length tables from the ``nepali-datetime`` package (BS 1975-2100)."""

    BS_MONTH_NAMES = {
        1: "Baishakh", 2: "Jestha", 3: "Ashadh", 4: "Shrawan", 5: "Bhadra", 6: "Ashwin",
        7: "Kartik", 8: "Mangsir", 9: "Poush", 10: "Magh", 11: "Falgun", 12: "Chaitra",
    }

    BS_MONTH_NAMES_NE = {
        1: "बैशाख", 2: "जेष्ठ", 3: "आषाढ", 4: "श्रावण", 5: "भाद्र", 6: "आश्विन",
        7: "कार्तिक", 8: "मंसिर", 9: "पौष", 10: "माघ", 11: "फाल्गुन", 12: "चैत्र",
    }

    @staticmethod
    def ad_to_bs(ad_date: datetime) -> Tuple[int, int, int]:
        """Convert a Gregorian date to Bikram Sambat (year, month, day).

        Raises ValueError outside the supported range (AD 1918-2043).
        """
        bs = nepali_datetime.date.from_datetime_date(ad_date.date() if isinstance(ad_date, datetime) else ad_date)
        return bs.year, bs.month, bs.day

    @staticmethod
    def bs_to_ad(bs_year: int, bs_month: int, bs_day: int) -> datetime:
        """Convert a Bikram Sambat date to a Gregorian datetime.

        Raises ValueError for an invalid or out-of-range BS date.
        """
        ad = nepali_datetime.date(bs_year, bs_month, bs_day).to_datetime_date()
        return datetime(ad.year, ad.month, ad.day)

    @staticmethod
    def format_bs(bs_year: int, bs_month: int, bs_day: int, locale: str = "en") -> str:
        """Format BS date for display.

        Args:
            bs_year: BS year
            bs_month: BS month (1-12)
            bs_day: BS day
            locale: 'en' for English, 'ne' for Nepali

        Returns:
            Formatted date string
        """
        try:
            if locale == "ne":
                month_name = CalendarConverter.BS_MONTH_NAMES_NE.get(bs_month, f"मा{bs_month}")
                return f"{bs_day} {month_name} {bs_year}"
            else:
                month_name = CalendarConverter.BS_MONTH_NAMES.get(bs_month, f"Month{bs_month}")
                return f"{bs_day} {month_name} {bs_year}"

        except Exception as e:
            logger.error(f"Error formatting BS date: {e}")
            return f"{bs_year}-{bs_month}-{bs_day}"

    @staticmethod
    def today_bs() -> Tuple[int, int, int]:
        """Get today's date in Bikram Sambat.

        Returns:
            Tuple of (year, month, day) in BS
        """
        return CalendarConverter.ad_to_bs(datetime.now())

    @staticmethod
    def is_valid_bs_date(bs_year: int, bs_month: int, bs_day: int) -> bool:
        """True if the BS date exists in the supported calendar range."""
        try:
            nepali_datetime.date(bs_year, bs_month, bs_day)
            return True
        except (ValueError, OverflowError):
            return False

    @staticmethod
    def get_bs_year_range() -> Tuple[int, int]:
        """Valid BS year range as (min_year, max_year)."""
        return nepali_datetime.MINYEAR, nepali_datetime.MAXYEAR
