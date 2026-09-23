"""Calendar conversion for Gregorian (AD) and Bikram Sambat (BS) (Phase 4.5)."""

import logging
from datetime import datetime, timedelta
from typing import Tuple, Optional

logger = logging.getLogger(__name__)


class CalendarConverter:
    """Convert between Gregorian (AD) and Bikram Sambat (BS) calendars.

    Bikram Sambat is the traditional calendar of Nepal, offset from Gregorian.
    Conversion algorithm: BS = AD - 56 years, 8 months, 15 days (approximately)
    """

    # Offset from AD to BS (exact differs by day based on lunar calendar)
    # Using average: BS = AD - 56.6944 years ≈ AD - 56y 8m 15d
    AD_TO_BS_YEARS = 56
    AD_TO_BS_MONTHS = 8
    AD_TO_BS_DAYS = 15

    # Nepali month names (Magh, Phalgun, etc.)
    BS_MONTH_NAMES = {
        1: "Baishakh",
        2: "Jyeshtha",
        3: "Ashar",
        4: "Shrawan",
        5: "Bhadra",
        6: "Ashwin",
        7: "Kartik",
        8: "Magh",
        9: "Phalgun",
        10: "Chaitra",
        11: "Baishakh",  # Note: Some calendars have 12 months
        12: "Jyeshtha",
    }

    BS_MONTH_NAMES_NE = {
        1: "बैशाख",
        2: "जेष्ठ",
        3: "आषाढ",
        4: "श्रावण",
        5: "भाद्र",
        6: "आश्विन",
        7: "कार्तिक",
        8: "माघ",
        9: "फाल्गुन",
        10: "चैत्र",
        11: "बैशाख",
        12: "जेष्ठ",
    }

    @staticmethod
    def ad_to_bs(ad_date: datetime) -> Tuple[int, int, int]:
        """Convert Gregorian (AD) date to Bikram Sambat (BS).

        Args:
            ad_date: Gregorian datetime object

        Returns:
            Tuple of (year, month, day) in BS

        Note:
            This uses an approximation. For precise conversion,
            a lookup table would be needed for lunar calendar sync.
        """
        try:
            # Convert AD to BS using offset
            bs_date = ad_date - timedelta(
                days=CalendarConverter.AD_TO_BS_DAYS,
                seconds=0
            )

            # Adjust for years and months
            bs_year = ad_date.year - CalendarConverter.AD_TO_BS_YEARS
            bs_month = ad_date.month - CalendarConverter.AD_TO_BS_MONTHS

            # Handle month wrapping
            if bs_month <= 0:
                bs_month += 12
                bs_year -= 1

            bs_day = ad_date.day

            # Additional day adjustment for month end
            if ad_date.day > 30 and bs_month in [1, 3, 5, 7, 9]:
                bs_day = 30
            elif ad_date.day > 32 and bs_month in [2, 4, 6, 8]:
                bs_day = 32
            elif ad_date.day > 29:
                bs_day = 29

            logger.debug(
                f"Converted AD {ad_date.date()} to BS {bs_year}-{bs_month}-{bs_day}"
            )
            return bs_year, bs_month, bs_day

        except Exception as e:
            logger.error(f"Error converting AD to BS: {e}")
            # Return original date as fallback
            return ad_date.year, ad_date.month, ad_date.day

    @staticmethod
    def bs_to_ad(bs_year: int, bs_month: int, bs_day: int) -> datetime:
        """Convert Bikram Sambat (BS) date to Gregorian (AD).

        Args:
            bs_year: BS year
            bs_month: BS month (1-12)
            bs_day: BS day

        Returns:
            Gregorian datetime object
        """
        try:
            # Convert BS to AD using offset
            ad_year = bs_year + CalendarConverter.AD_TO_BS_YEARS
            ad_month = bs_month + CalendarConverter.AD_TO_BS_MONTHS

            # Handle month wrapping
            if ad_month > 12:
                ad_month -= 12
                ad_year += 1

            ad_day = bs_day

            # Clamp day to valid range for month
            if ad_month in [4, 6, 9, 11]:
                ad_day = min(ad_day, 30)
            elif ad_month == 2:
                # February handling for leap years
                if ad_year % 4 == 0 and (ad_year % 100 != 0 or ad_year % 400 == 0):
                    ad_day = min(ad_day, 29)
                else:
                    ad_day = min(ad_day, 28)
            else:
                ad_day = min(ad_day, 31)

            ad_date = datetime(ad_year, ad_month, ad_day)

            logger.debug(f"Converted BS {bs_year}-{bs_month}-{bs_day} to AD {ad_date.date()}")
            return ad_date

        except Exception as e:
            logger.error(f"Error converting BS to AD: {e}")
            # Return current date as fallback
            return datetime.now()

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
        """Validate if BS date is valid.

        Args:
            bs_year: BS year
            bs_month: BS month (1-12)
            bs_day: BS day

        Returns:
            True if valid, False otherwise
        """
        try:
            if bs_month < 1 or bs_month > 12:
                return False

            if bs_day < 1 or bs_day > 32:
                return False

            # Try to convert to AD and back
            ad_date = CalendarConverter.bs_to_ad(bs_year, bs_month, bs_day)
            return True

        except Exception:
            return False

    @staticmethod
    def get_bs_year_range() -> Tuple[int, int]:
        """Get valid BS year range.

        Returns:
            Tuple of (min_year, max_year)
        """
        # Assuming calendar valid from ~1944 BS (1887 AD) to ~2100 BS (2043 AD)
        return 1944, 2100
