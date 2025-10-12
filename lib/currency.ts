/**
 * Currency formatting utilities for Ghana Cedi (₵)
 */

/**
 * Format amount as Ghana Cedi currency
 * @param amount - The amount to format
 * @param showSymbol - Whether to show the currency symbol (default: true)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number | undefined | null, showSymbol = true): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return showSymbol ? "₵0.00" : "0.00"
  }

  const formatted = Number(amount).toFixed(2)
  return showSymbol ? `₵${formatted}` : formatted
}

/**
 * Format amount with thousands separator
 * @param amount - The amount to format
 * @param showSymbol - Whether to show the currency symbol (default: true)
 * @returns Formatted currency string with thousands separator
 */
export function formatCurrencyWithSeparator(amount: number | undefined | null, showSymbol = true): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return showSymbol ? "₵0.00" : "0.00"
  }

  const formatted = Number(amount).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return showSymbol ? `₵${formatted}` : formatted
}

/**
 * Parse currency string to number
 * @param currencyString - String like "₵100.00" or "100.00"
 * @returns Parsed number or 0 if invalid
 */
export function parseCurrency(currencyString: string): number {
  if (!currencyString) return 0

  // Remove currency symbol and any whitespace
  const cleanString = currencyString.replace(/₵|GHS|\s/g, "").replace(/,/g, "")
  const parsed = Number.parseFloat(cleanString)

  return isNaN(parsed) ? 0 : parsed
}

/**
 * Format currency for input fields (without symbol)
 * @param amount - The amount to format
 * @returns Formatted string without currency symbol
 */
export function formatCurrencyInput(amount: number | undefined | null): string {
  return formatCurrency(amount, false)
}

/**
 * Format large amounts with K, M suffixes
 * @param amount - The amount to format
 * @param showSymbol - Whether to show the currency symbol (default: true)
 * @returns Formatted currency string with suffix
 */
export function formatCurrencyCompact(amount: number | undefined | null, showSymbol = true): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return showSymbol ? "₵0" : "0"
  }

  const absAmount = Math.abs(amount)
  let formatted: string

  if (absAmount >= 1000000) {
    formatted = (amount / 1000000).toFixed(1) + "M"
  } else if (absAmount >= 1000) {
    formatted = (amount / 1000).toFixed(1) + "K"
  } else {
    formatted = amount.toFixed(2)
  }

  return showSymbol ? `₵${formatted}` : formatted
}
