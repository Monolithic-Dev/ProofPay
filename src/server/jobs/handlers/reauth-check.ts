/**
 * REAUTH_CHECK Job Handler.
 * Implements phase-5-paypal-funding-and-release.md §5.8 & paypal-integration.md §7.
 */
import { getDb, withTx, lockContract, type Tx } from '@/server/db/client'
import { contracts, milestones } from '@/server/db/schema'
import { eq, or, and, sql } from 'drizzle-orm'
import { reauthorize } from '@/server/paypal/authorizations'
import { appendLedgerEvent } from '@/server/ledger/append'
import { enqueueJob } from '@/server/jobs/queue'
import { now } from '@/server/util/time'
import { logger } from '@/server/util/logger'

export async function handleReauthCheck(): Promise<void> {
  const db = getDb()
  const log = logger.child({ job: 'REAUTH_CHECK' })
  const currentTime = now()

  // Find contracts that are FUNDED or IN_PROGRESS with remaining uncaptured minor
  const activeContracts = await db
    .select()
    .from(contracts)
    .where(or(eq(contracts.status, 'FUNDED'), eq(contracts.status, 'IN_PROGRESS')))

  for (const contract of activeContracts) {
    if (!contract.authorization_id) continue

    // Compute remaining minor
    const mList = await db
      .select({ status: milestones.status, amount_minor: milestones.amount_minor })
      .from(milestones)
      .where(eq(milestones.contract_id, contract.id))

    const capturedMinor = mList
      .filter((m) => m.status === 'RELEASED')
      .reduce((sum, m) => sum + m.amount_minor, 0)

    const remainingMinor = contract.total_minor - capturedMinor
    if (remainingMinor <= 0) continue

    const honorUntilTime = contract.honor_until?.getTime() ?? 0
    const authExpiresTime = contract.auth_expires_at?.getTime() ?? 0
    const oneHourMs = 3600 * 1000

    // Check expiry
    if (authExpiresTime > 0 && currentTime.getTime() >= authExpiresTime) {
      log.info({ contract_id: contract.id }, 'Authorization expired; enqueuing EXPIRE_CONTRACT')
      await withTx(async (tx: Tx) => {
        await enqueueJob(
          tx,
          'EXPIRE_CONTRACT',
          { contract_id: contract.id },
          { dedupeKey: `expire:${contract.id}` }
        )
      })
      continue
    }

    // Reauthorization check:
    // If now >= honor_until AND now < auth_expires_at - 1h
    if (honorUntilTime > 0 && currentTime.getTime() >= honorUntilTime && (authExpiresTime === 0 || currentTime.getTime() < authExpiresTime - oneHourMs)) {
      const honorUntilEpoch = Math.floor(honorUntilTime / 1000)
      const requestId = `pp:${contract.id}:reauth:${honorUntilEpoch}`

      try {
        const reauthResult = await reauthorize(contract.authorization_id, requestId)
        const newHonorUntil = new Date(currentTime.getTime() + 3 * 24 * 3600 * 1000)

        await withTx(async (tx: Tx) => {
          await lockContract(tx, contract.id)

          await tx
            .update(contracts)
            .set({
              authorization_id: reauthResult.newAuthorizationId,
              honor_until: newHonorUntil,
              funding_at_risk: false,
              updated_at: now(),
            })
            .where(eq(contracts.id, contract.id))

          await appendLedgerEvent(tx, {
            contractId: contract.id,
            type: 'REAUTHORIZED',
            actorType: 'system',
            payload: {
              old_authorization_id: contract.authorization_id!,
              new_authorization_id: reauthResult.newAuthorizationId,
              honor_until: newHonorUntil.toISOString(),
            },
          })
        })

        log.info({ contract_id: contract.id, newAuthId: reauthResult.newAuthorizationId }, 'Reauthorization successful')
      } catch (err) {
        log.warn({ err: String(err), contract_id: contract.id }, 'Reauthorization failed; setting funding_at_risk')
        await withTx(async (tx: Tx) => {
          await lockContract(tx, contract.id)
          await tx
            .update(contracts)
            .set({ funding_at_risk: true, updated_at: now() })
            .where(eq(contracts.id, contract.id))
        })
      }
    }
  }
}
