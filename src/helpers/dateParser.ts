/**
 * Intelligently parses date strings for analytics queries.
 *
 * - For 'from' dates: Sets to the beginning of the period (00:00:00.000)
 * - For 'to' dates: Sets to the end of the period (23:59:59.999)
 *
 * Supports formats:
 * - Year only: "2025" → from: 2025-01-01T00:00:00.000Z, to: 2025-12-31T23:59:59.999Z
 * - Year-Month: "2025-08" → from: 2025-08-01T00:00:00.000Z, to: 2025-08-31T23:59:59.999Z
 * - Full date: "2025-08-15" → from: 2025-08-15T00:00:00.000Z, to: 2025-08-15T23:59:59.999Z
 * - ISO 8601: "2025-08-15T10:30:00.000Z" → uses as-is
 *
 * Handles leap years correctly for February.
 *
 * @param dateString - The date string to parse (YYYY, YYYY-MM, YYYY-MM-DD, or ISO 8601)
 * @param type - Whether this is a 'from' (start) or 'to' (end) date
 * @returns A Date object adjusted to the beginning or end of the period
 *
 * @example
 * parseAnalyticsDate('2025', 'from')        // 2025-01-01T00:00:00.000Z
 * parseAnalyticsDate('2025', 'to')          // 2025-12-31T23:59:59.999Z
 * parseAnalyticsDate('2024-02', 'to')       // 2024-02-29T23:59:59.999Z (leap year)
 * parseAnalyticsDate('2025-02', 'to')       // 2025-02-28T23:59:59.999Z
 * parseAnalyticsDate('2025-08-15', 'from')  // 2025-08-15T00:00:00.000Z
 * parseAnalyticsDate('2025-08-15', 'to')    // 2025-08-15T23:59:59.999Z
 */
export const parseAnalyticsDate = (dateString: string, type: 'from' | 'to'): Date => {
  // Remove any whitespace
  const trimmed = dateString.trim();

  // Check if it's already a full ISO 8601 timestamp
  if (trimmed.includes('T') || trimmed.includes('t')) {
    return new Date(trimmed);
  }

  // Split by hyphen to determine format
  const parts = trimmed.split('-');

  let year: number;
  let month: number;
  let day: number;

  if (parts.length === 1) {
    // Year only: "2025"
    year = parseInt(parts[0], 10);

    if (type === 'from') {
      month = 0; // January (0-indexed)
      day = 1;
    } else {
      month = 11; // December (0-indexed)
      day = 31;
    }
  } else if (parts.length === 2) {
    // Year-Month: "2025-08"
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // Convert to 0-indexed

    if (type === 'from') {
      day = 1;
    } else {
      // Get last day of the month
      day = getLastDayOfMonth(year, month);
    }
  } else if (parts.length === 3) {
    // Full date: "2025-08-15"
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // Convert to 0-indexed
    day = parseInt(parts[2], 10);
  } else {
    // Invalid format, try default Date parsing
    return new Date(dateString);
  }

  // Validate parsed values
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date format: ${dateString}`);
  }

  // Create the date
  const date = new Date(Date.UTC(year, month, day));

  // Set time based on type
  if (type === 'from') {
    date.setUTCHours(0, 0, 0, 0);
  } else {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
};

/**
 * Gets the last day of a given month, accounting for leap years.
 *
 * @param year - The year (e.g., 2024)
 * @param month - The month (0-indexed: 0 = January, 11 = December)
 * @returns The last day of the month (28-31)
 */
const getLastDayOfMonth = (year: number, month: number): number => {
  // Create a date for the first day of the next month, then subtract 1 day
  // This automatically handles leap years
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
};

/**
 * Helper to check if a year is a leap year.
 *
 * @param year - The year to check
 * @returns True if the year is a leap year
 */
export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

export default parseAnalyticsDate;
