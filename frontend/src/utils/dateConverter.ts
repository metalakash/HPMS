/**
 * Date conversion utilities for BS (Bikram Sambat) ↔ AD (Anno Domini) dates.
 * Wrapper around nepali-date-converter library.
 */

// Type stubs for nepali-date-converter (will be replaced when library is installed)
// import { NepalDate } from 'nepali-date-converter';

interface DatePair {
  ad: string; // YYYY-MM-DD
  bs: string; // YYYY-MM-DD
}

/**
 * Converts AD date to BS date.
 * @param adDate - Date in AD format (YYYY-MM-DD or Date object)
 * @returns Date in BS format (YYYY-MM-DD)
 */
export function adToBs(adDate: string | Date): string {
  try {
    // Parse input date
    const date = typeof adDate === 'string' ? new Date(adDate) : adDate;

    if (isNaN(date.getTime())) {
      console.warn('Invalid date provided to adToBs:', adDate);
      return '';
    }

    // TODO: Implement conversion using nepali-date-converter
    // For now, return placeholder
    // const nepalDate = NepalDate.fromAD(date);
    // return nepalDate.toString();

    return formatAdToPlaceholder(date);
  } catch (error) {
    console.error('Error converting AD to BS:', error);
    return '';
  }
}

/**
 * Converts BS date to AD date.
 * @param bsDate - Date in BS format (YYYY-MM-DD)
 * @returns Date in AD format (YYYY-MM-DD)
 */
export function bsToAd(bsDate: string): string {
  try {
    if (!bsDate) return '';

    // TODO: Implement conversion using nepali-date-converter
    // const nepalDate = new NepalDate(bsDate);
    // return nepalDate.toAD();

    return formatBsToPlaceholder(bsDate);
  } catch (error) {
    console.error('Error converting BS to AD:', error);
    return '';
  }
}

/**
 * Converts a single AD year to BS year.
 * @param adYear - Year in AD (e.g., 2026)
 * @returns Year in BS (e.g., 2083)
 */
export function adYearToBsYear(adYear: number): number {
  // Approximate conversion: BS = AD + 57
  // More precise calculation would be needed for edge cases
  return adYear + 56; // BS year is approximately 56-57 years ahead
}

/**
 * Converts a single BS year to AD year.
 * @param bsYear - Year in BS (e.g., 2083)
 * @returns Year in AD (e.g., 2026)
 */
export function bsYearToAdYear(bsYear: number): number {
  return bsYear - 56;
}

/**
 * Returns both AD and BS representations of a date.
 * @param date - Date in any format (AD ISO string or Date object)
 * @returns Object with both AD and BS dates
 */
export function getDatePair(date: string | Date | null | undefined): DatePair {
  if (!date) {
    return {
      ad: '',
      bs: '',
    };
  }
  const adDate = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  const bsDate = adToBs(adDate);

  return {
    ad: adDate || '',
    bs: bsDate || '',
  };
}

/**
 * Formats a date pair for display.
 * @param adDate - AD date (YYYY-MM-DD)
 * @param bsDate - BS date (YYYY-MM-DD)
 * @param format - Format string ('ad', 'bs', or 'both')
 * @returns Formatted date string
 */
export function formatDatePair(
  adDate: string,
  bsDate: string,
  format: 'ad' | 'bs' | 'both' = 'ad'
): string {
  const formatDate = (date: string) => {
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year}`;
  };

  switch (format) {
    case 'ad':
      return formatDate(adDate);
    case 'bs':
      return formatDate(bsDate);
    case 'both':
      return `${formatDate(adDate)} (${formatDate(bsDate)} BS)`;
    default:
      return formatDate(adDate);
  }
}

/**
 * Parses a date string and returns it in both formats.
 * @param dateString - Date string (any format)
 * @returns Object with both AD and BS dates
 */
export function parseDate(dateString: string): DatePair | null {
  try {
    if (!dateString) return null;

    // Try to parse as ISO date
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }

    const adDate = date.toISOString().split('T')[0];
    const bsDate = adToBs(adDate);

    return { ad: adDate, bs: bsDate };
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
}

/**
 * Validates if a date string is in valid format (YYYY-MM-DD).
 * @param dateString - Date string to validate
 * @returns True if valid format
 */
export function isValidDateFormat(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Gets current date in both AD and BS.
 * @returns Object with both AD and BS dates
 */
export function getTodayDatePair(): DatePair {
  const today = new Date();
  const adDate = today.toISOString().split('T')[0];
  const bsDate = adToBs(adDate);

  return { ad: adDate, bs: bsDate };
}

// Placeholder functions (replace with actual library calls after installation)

function formatAdToPlaceholder(date: Date): string {
  // This is a placeholder - will be replaced with actual conversion
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatBsToPlaceholder(bsDate: string): string {
  // This is a placeholder - will be replaced with actual conversion
  // For now, just return the input
  return bsDate;
}
