/**
 * Currency formatting utilities
 * Formats numbers to Nigerian Naira (NGN) currency
 */

const currencyFormatterNaira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 2,
});

/**
 * Formats a number to Nigerian Naira currency
 * @param value - The numeric value to format
 * @returns Formatted currency string (e.g., "₦1,500.00")
 */
export const formatToNaira = (value: number): string => currencyFormatterNaira.format(value);
