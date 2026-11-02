/**
 * VOID_REMAINING Job Handler.
 * Implements phase-5-paypal-funding-and-release.md §5.6.
 */
import { voidRemaining } from '@/server/release/service'
import { logger } from '@/server/util/logger'

export interface VoidRemainingPayload {
  contract_id: string
  reason?: 'final_failure' | 'buyer_cancel' | 'expired'
}

export async function handleVoidRemaining(payload: VoidRemainingPayload): Promise<void> {
  const { contract_id, reason } = payload
  const resolvedReason = reason ?? 'final_failure'
  const log = logger.child({ job: 'VOID_REMAINING', contract_id, reason: resolvedReason })
  log.info('Executing VOID_REMAINING job')

  await voidRemaining(contract_id, resolvedReason)
}
