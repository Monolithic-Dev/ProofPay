/**
 * PayPal error types and error classification.
 * Implements phase-5-paypal-funding-and-release.md §5.2.
 */
import { AppError } from '@/server/util/errors'

export interface PayPalErrorDetails {
  status?: number
  name?: string
  issue?: string
  debug_id?: string
  message?: string
  cause?: unknown
  isAmbiguous?: boolean
}

export class PayPalError extends AppError {
  public readonly debugId?: string
  public readonly isAmbiguous: boolean

  constructor(
    message: string,
    details?: PayPalErrorDetails | Record<string, unknown> | string
  ) {
    const parsedDetails: Record<string, unknown> =
      typeof details === 'string'
        ? { raw: details }
        : (details as Record<string, unknown>) ?? {}

    super('PAYPAL_ERROR', message, 422, parsedDetails)
    this.name = 'PayPalError'
    this.debugId = (parsedDetails['debug_id'] as string) ?? undefined
    this.isAmbiguous = Boolean(parsedDetails['isAmbiguous'])
  }
}

/**
 * Checks whether an error is ambiguous (e.g. timeout, network drop, or 5xx),
 * meaning the payment request may or may not have reached PayPal's ledger.
 * Ambiguous errors must never be marked as a definitive decline; they require reconciliation.
 */
export function isAmbiguous(err: unknown): boolean {
  if (!err) return false

  if (err instanceof PayPalError && err.isAmbiguous) {
    return true
  }

  const str = String(err).toLowerCase()
  if (
    str.includes('timeout') ||
    str.includes('abort') ||
    str.includes('econnreset') ||
    str.includes('etimedout') ||
    str.includes('fetch failed') ||
    str.includes('network error') ||
    str.includes('500') ||
    str.includes('502') ||
    str.includes('503') ||
    str.includes('504')
  ) {
    return true
  }

  return false
}
