/**
 * Worker Recurring Schedulers.
 * Implements phase-5-paypal-funding-and-release.md §5.8 & paypal-integration.md §7, §8.
 *
 * Enqueues periodic background sweeps with deterministic deduplication keys:
 * - reconcile-sweep:{yyyyMMddHH(mm/5)} every 5 minutes
 * - reauth-sweep:{yyyyMMddHH(mm/10)} every 10 minutes
 * - expire-sweep:{yyyyMMddHH} hourly
 */
import { getDb } from '@/server/db/client'
import { enqueueJob } from '@/server/jobs/queue'
import { now } from '@/server/util/time'
import { logger } from '@/server/util/logger'

export function computeScheduleSlots(d: Date): {
  reconcileDedupeKey: string
  reauthDedupeKey: string
  expireDedupeKey: string
} {
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = d.getUTCMinutes()

  const slot5 = Math.floor(min / 5)
  const slot10 = Math.floor(min / 10)

  return {
    reconcileDedupeKey: `reconcile-sweep:${yyyy}${mm}${dd}${hh}${slot5}`,
    reauthDedupeKey: `reauth-sweep:${yyyy}${mm}${dd}${hh}${slot10}`,
    expireDedupeKey: `expire-sweep:${yyyy}${mm}${dd}${hh}`,
  }
}

/**
 * Enqueue sweep jobs for the current time slot.
 * Dedupe keys prevent multiple runs within the same time window.
 */
export async function scheduleSweeps(referenceTime?: Date): Promise<{
  reconcileKey: string
  reauthKey: string
  expireKey: string
}> {
  const db = getDb()
  const d = referenceTime ?? now()
  const { reconcileDedupeKey, reauthDedupeKey, expireDedupeKey } = computeScheduleSlots(d)
  const log = logger.child({ schedulers: 'sweeps', timestamp: d.toISOString() })

  // 1. Reconcile sweep every 5 minutes
  try {
    await enqueueJob(
      db,
      'RECONCILE_PAYPAL',
      {},
      { dedupeKey: reconcileDedupeKey }
    )
  } catch (err) {
    log.debug({ err: String(err), key: reconcileDedupeKey }, 'Reconcile sweep already queued or failed')
  }

  // 2. Reauth check sweep every 10 minutes
  try {
    await enqueueJob(
      db,
      'REAUTH_CHECK',
      {},
      { dedupeKey: reauthDedupeKey }
    )
  } catch (err) {
    log.debug({ err: String(err), key: reauthDedupeKey }, 'Reauth sweep already queued or failed')
  }

  // 3. Expire check sweep hourly
  try {
    await enqueueJob(
      db,
      'EXPIRE_CONTRACT',
      {},
      { dedupeKey: expireDedupeKey }
    )
  } catch (err) {
    log.debug({ err: String(err), key: expireDedupeKey }, 'Expire sweep already queued or failed')
  }

  // 4. Sweep orphan demo runs
  try {
    const { sweepOrphanRuns } = await import('@/demo/runner')
    await sweepOrphanRuns()
  } catch (err) {
    log.debug({ err: String(err) }, 'sweepOrphanRuns failed')
  }

  return {
    reconcileKey: reconcileDedupeKey,
    reauthKey: reauthDedupeKey,
    expireKey: expireDedupeKey,
  }
}
