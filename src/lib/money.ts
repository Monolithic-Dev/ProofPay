/**
 * Money calculations and fundamental financial invariants.
 * Implements docs/v2/PROOFPAY-WINNING-PLAN.md Appendix B.
 */

export interface FundsSummaryParams {
  authorizedMinor: number
  captures: number[]
  voidedMinor: number
  refundsMinor?: number
}

export interface FundsSummaryResult {
  authorizedMinor: number
  capturedMinor: number
  voidedMinor: number
  remainingMinor: number
  refundedMinor: number
}

/**
 * Single source of truth for contract funds breakdown.
 * Enforces the core invariant:
 * authorizedMinor = capturedMinor + voidedMinor + remainingMinor
 * remainingMinor >= 0
 * capturedMinor <= authorizedMinor
 */
export function fundsSummary(params: FundsSummaryParams): FundsSummaryResult {
  const captured = (params.captures ?? []).reduce((a, b) => a + b, 0)
  const remaining = params.authorizedMinor - captured - (params.voidedMinor ?? 0)

  if (remaining < 0) {
    throw new Error(
      `INVARIANT_VIOLATION: captured (${captured}) + voided (${params.voidedMinor}) exceeds authorized (${params.authorizedMinor})`
    )
  }

  return {
    authorizedMinor: params.authorizedMinor,
    capturedMinor: captured,
    voidedMinor: params.voidedMinor ?? 0,
    remainingMinor: remaining,
    refundedMinor: params.refundsMinor ?? 0,
  }
}
