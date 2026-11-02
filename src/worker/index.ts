/**
 * Worker process — polls the job queue and dispatches handlers.
 * Implements phase-4-verification-engine.md §4.10.
 */
import { getDb } from '@/server/db/client'
import { claimNextJob, completeJob, failJob, reclaimStaleLocks } from '@/server/jobs/queue'
import { handleVerifySubmission } from '@/server/jobs/handlers/verify-submission'
import { handleAutoRelease } from '@/server/jobs/handlers/auto-release'
import { handleReleaseMilestone } from '@/server/jobs/handlers/release-milestone'
import { handleVoidRemaining } from '@/server/jobs/handlers/void-remaining'
import { handleReconcilePaypal } from '@/server/jobs/handlers/reconcile-paypal'
import { handleReauthCheck } from '@/server/jobs/handlers/reauth-check'
import { handleExpireContract } from '@/server/jobs/handlers/expire-contract'
import { scheduleSweeps } from './schedulers'
import { logger } from '@/server/util/logger'
import { kv } from '@/server/db/schema'

const log = logger.child({ process: 'worker' })
let running = true

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------
export async function writeHeartbeat(): Promise<void> {
  try {
    const db = getDb()
    const nowIso = new Date().toISOString()
    await db
      .insert(kv)
      .values({
        key: 'worker:heartbeat',
        value: { timestamp: nowIso, pid: process.pid },
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: kv.key,
        set: { value: { timestamp: nowIso, pid: process.pid }, updated_at: new Date() },
      })
  } catch {
    // non-fatal
  }
}

// ---------------------------------------------------------------------------
// Job dispatcher
// ---------------------------------------------------------------------------
export async function dispatchJob(job: {
  id: string
  type: string
  payload: unknown
  attempts: number
}): Promise<void> {
  const payload = job.payload as Record<string, unknown>

  switch (job.type) {
    case 'VERIFY_SUBMISSION':
      await handleVerifySubmission(payload as unknown as Parameters<typeof handleVerifySubmission>[0])
      break

    case 'AUTO_RELEASE':
      await handleAutoRelease(payload as unknown as Parameters<typeof handleAutoRelease>[0])
      break

    case 'RELEASE_MILESTONE':
      await handleReleaseMilestone(payload as unknown as Parameters<typeof handleReleaseMilestone>[0])
      break

    case 'VOID_REMAINING':
      await handleVoidRemaining(payload as unknown as Parameters<typeof handleVoidRemaining>[0])
      break

    case 'RECONCILE_PAYPAL':
      await handleReconcilePaypal(payload as unknown as Parameters<typeof handleReconcilePaypal>[0])
      break

    case 'REAUTH_CHECK':
      await handleReauthCheck()
      break

    case 'EXPIRE_CONTRACT':
      await handleExpireContract(payload as unknown as Parameters<typeof handleExpireContract>[0])
      break

    case 'PURGE_DEMO_DATA':
    case 'DEMO_STEP':
      log.warn({ type: job.type }, 'Job type handler not yet implemented — skipping')
      break

    default:
      throw new Error(`Unknown job type: ${job.type}`)
  }
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------
export async function pollOnce(): Promise<boolean> {
  const job = await claimNextJob()
  if (!job) return false

  const log2 = log.child({ job_id: job.id, type: job.type })
  log2.info('Job claimed')

  try {
    await dispatchJob({
      id: job.id,
      type: job.type,
      payload: job.payload,
      attempts: job.attempts,
    })
    await completeJob(job.id)
    log2.info('Job complete')
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log2.error({ err: msg }, 'Job failed')
    await failJob(job.id, msg, job.attempts)
    return true
  }
}

export function stopWorker(): void {
  running = false
}

export async function startWorker(opts?: { concurrency?: number; pollIntervalMs?: number }): Promise<void> {
  running = true
  const pollIntervalMs = opts?.pollIntervalMs ?? 200
  log.info('Worker starting')

  // Reclaim stale locks on startup
  const reclaimed = await reclaimStaleLocks()
  if (reclaimed > 0) log.info({ reclaimed }, 'Reclaimed stale jobs')

  // Heartbeat every 30s
  const heartbeatInterval = setInterval(() => void writeHeartbeat(), 30_000)
  await writeHeartbeat()

  // Sweep schedule tick every 60s
  const sweepInterval = setInterval(() => void scheduleSweeps(), 60_000)
  await scheduleSweeps().catch((err) => log.warn({ err: String(err) }, 'Initial scheduleSweeps failed'))

  // Poll loop
  while (running) {
    try {
      const found = await pollOnce()
      if (!found) await sleep(pollIntervalMs)
    } catch (err) {
      log.error({ err: String(err) }, 'Poll loop error')
      await sleep(1000)
    }
  }

  clearInterval(heartbeatInterval)
  clearInterval(sweepInterval)
  log.info('Worker stopped')
}

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  stopWorker()
  log.info('SIGTERM received')
})
process.on('SIGINT', () => {
  stopWorker()
  log.info('SIGINT received')
})

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

if (process.env['NODE_ENV'] !== 'test') {
  startWorker().catch((err) => {
    log.fatal({ err: String(err) }, 'Worker fatal error')
    process.exit(1)
  })
}
