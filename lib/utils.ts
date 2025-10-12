import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

// Add the formatCurrency function to utils.ts
export function formatCurrency(amount: number | undefined | null, showSymbol = true): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return showSymbol ? "₵0.00" : "0.00"
  }

  const formatted = Number(amount).toFixed(2)
  return showSymbol ? `₵${formatted}` : formatted
}

// Add the currencyFormatter function
export function currencyFormatter(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return "₵0.00"
  }

  const formatted = Number(amount).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return `₵${formatted}`
}

// Additional utility functions for currency handling
export function parseCurrency(currencyString: string): number {
  if (!currencyString) return 0

  // Remove currency symbol and any whitespace
  const cleanString = currencyString.replace(/₵|GHS|\s/g, "").replace(/,/g, "")
  const parsed = Number.parseFloat(cleanString)

  return isNaN(parsed) ? 0 : parsed
}

export function formatCurrencyInput(amount: number | undefined | null): string {
  return formatCurrency(amount, false)
}

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
