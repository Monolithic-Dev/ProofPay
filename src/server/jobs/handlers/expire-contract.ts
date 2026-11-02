/**
 * EXPIRE_CONTRACT Job Handler.
 * Implements phase-5-paypal-funding-and-release.md §5.8 & paypal-integration.md §7.
 */
import { getDb } from '@/server/db/client'
import { contracts } from '@/server/db/schema'
import { eq, or, and, lte } from 'drizzle-orm'
import { voidRemaining } from '@/server/release/service'
import { now } from '@/server/util/time'
import { logger } from '@/server/util/logger'

export interface ExpireContractPayload {
  contract_id?: string
}

export async function handleExpireContract(payload: ExpireContractPayload): Promise<void> {
  const log = logger.child({ job: 'EXPIRE_CONTRACT', payload })

  if (payload.contract_id) {
    log.info('Expiring specific contract')
    await voidRemaining(payload.contract_id, 'expired')
    return
  }

  // Sweep expired contracts
  const db = getDb()
  const currentTime = now()
  const expiredContracts = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(
      and(
        or(eq(contracts.status, 'FUNDED'), eq(contracts.status, 'IN_PROGRESS')),
        lte(contracts.auth_expires_at, currentTime)
      )
    )

  for (const c of expiredContracts) {
    try {
      log.info({ contract_id: c.id }, 'Expiring contract in sweep')
      await voidRemaining(c.id, 'expired')
    } catch (err) {
      log.warn({ err: String(err), contract_id: c.id }, 'Failed to expire contract in sweep')
    }
  }
}
