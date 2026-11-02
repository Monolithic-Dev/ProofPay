/**
 * PayPal Minor-Unit Money Utilities.
 * Implements phase-5-paypal-funding-and-release.md §5.1.
 *
 * All money inside ProofPay is represented as integer cents (minor units, USD).
 * Conversion to/from PayPal decimal strings uses exact integer math, NEVER floating point.
 */
import { AppError } from '@/server/util/errors'

export const MAX_MINOR_UNITS = 5_000_000 // $50,000.00 ceiling

/**
 * Convert integer cents (minor units) to PayPal decimal string.
 * Example: 6000 → "60.00", 5 → "0.05"
 * Rejects non-integers, <= 0, and > 5,000,000.
 */
export function toPayPalValue(minor: number): string {
  if (typeof minor !== 'number' || !Number.isInteger(minor)) {
    throw new AppError('INVALID_AMOUNT', `Amount must be an integer: ${minor}`, 400)
  }

  if (minor <= 0) {
    throw new AppError('INVALID_AMOUNT', `Amount must be strictly positive: ${minor}`, 400)
  }

  if (minor > MAX_MINOR_UNITS) {
    throw new AppError(
      'INVALID_AMOUNT',
      `Amount ${minor} exceeds maximum allowed limit of ${MAX_MINOR_UNITS} ($50,000.00)`,
      400
    )
  }

  const dollars = Math.trunc(minor / 100)
  const cents = String(minor % 100).padStart(2, '0')
  return `${dollars}.${cents}`
}

/**
 * Parse PayPal decimal string to integer cents (minor units).
 * Example: "60.00" → 6000, "0.05" → 5
 * Enforces strict format ^\d+\.\d{2}$ (no floats).
 */
export function fromPayPalValue(value: string): number {
  if (typeof value !== 'string' || !/^\d+\.\d{2}$/.test(value)) {
    throw new AppError('INVALID_AMOUNT', `Cannot parse PayPal amount string: "${value}"`, 400)
  }

  const [dollarsStr, centsStr] = value.split('.')
  const dollars = parseInt(dollarsStr!, 10)
  const cents = parseInt(centsStr!, 10)

  const minor = dollars * 100 + cents
  if (minor <= 0 || minor > MAX_MINOR_UNITS) {
    throw new AppError('INVALID_AMOUNT', `Parsed amount ${minor} is outside valid bounds`, 400)
  }

  return minor
}

/**
 * Format minor units for display: e.g. 6000 → "$60.00".
 */
export function formatUsd(minor: number): string {
  if (typeof minor !== 'number' || isNaN(minor)) return '$0.00'
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(Math.round(minor))
  const dollars = Math.trunc(abs / 100)
  const cents = String(abs % 100).padStart(2, '0')
  return `${sign}$${dollars}.${cents}`
}
