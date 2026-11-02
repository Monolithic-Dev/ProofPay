/**
 * PayPal minor-unit money utilities.
 * All money in the app is integer cents (minor units, USD).
 */

/** Convert minor units (cents) to PayPal decimal string */
export function toPayPalValue(minor: number): string {
  if (!Number.isInteger(minor) || minor < 0) {
    throw new Error(`Invalid minor unit amount: ${minor}`)
  }
  return (minor / 100).toFixed(2)
}

/** Parse PayPal decimal string to minor units */
export function fromPayPalValue(value: string): number {
  const n = parseFloat(value)
  if (isNaN(n)) throw new Error(`Cannot parse PayPal amount: "${value}"`)
  return Math.round(n * 100)
}

/** Format for display: "$60.00" */
export function formatUsd(minor: number): string {
  return '$' + (minor / 100).toFixed(2)
}
