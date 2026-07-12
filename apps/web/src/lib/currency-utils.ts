/**
 * Currency formatting utilities for the Homara Gatekeeper application
 * All prices are in Kenyan Shillings (Ksh)
 */

/**
 * Format a number as Kenyan Shillings
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted currency string (e.g., "Ksh 125,000")
 */
export function formatCurrency(
  amount: number | null | undefined,
  options?: {
    showSymbol?: boolean; // Default: true
    decimals?: number; // Default: 0 (whole numbers)
    fallback?: string; // Default: 'N/A'
  }
): string {
  const {
    showSymbol = true,
    decimals = 0,
    fallback = 'N/A'
  } = options || {};

  if (amount === null || amount === undefined || isNaN(amount)) {
    return fallback;
  }

  const formattedNumber = amount.toLocaleString('en-KE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return showSymbol ? `Ksh ${formattedNumber}` : formattedNumber;
}

/**
 * Format a price range
 * @param min - Minimum price
 * @param max - Maximum price
 * @returns Formatted price range (e.g., "Ksh 10,000 - Ksh 50,000")
 */
export function formatPriceRange(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  if (!min && !max) return 'N/A';
  if (!min) return `Up to ${formatCurrency(max)}`;
  if (!max) return `From ${formatCurrency(min)}`;
  return `${formatCurrency(min)} - ${formatCurrency(max)}`;
}

/**
 * Parse a currency string to a number
 * @param value - The currency string (e.g., "Ksh 125,000" or "125000")
 * @returns Parsed number or null if invalid
 */
export function parseCurrency(value: string): number | null {
  if (!value) return null;
  
  // Remove currency symbol and commas
  const cleaned = value.replace(/[Ksh,\s]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? null : parsed;
}

/**
 * Currency symbol constant
 */
export const CURRENCY_SYMBOL = 'Ksh';

/**
 * Currency code constant (for exports and APIs)
 */
export const CURRENCY_CODE = 'KES';

/**
 * Currency name constant
 */
export const CURRENCY_NAME = 'Kenyan Shilling';

