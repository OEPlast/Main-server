export const DEFAULT_TIMEZONE = 'Africa/Lagos';

/**
 * Whether a string is an IANA timezone this runtime can actually resolve.
 */
export const isValidTimezone = (tz: unknown): tz is string => {
  if (typeof tz !== 'string' || tz.length === 0) return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
