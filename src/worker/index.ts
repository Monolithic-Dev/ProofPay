/**
 * Worker process — polls the job queue and dispatches handlers.
 */
import { getDb } from '@/server/db/client'
import { claimNextJob, completeJob, failJob, reclaimStaleLocks } from '@/server/jobs/queue'
import { handleVerifySubmission } from '@/server/jobs/handlers/verify-submission'
import { releaseMilestone, voidRemaining } from '@/server/release/service'
import { logger } from '@/server/util/logger'
import { kv } from '@/server/db/schema'
import { eq } from 'drizzle-orm'

const log = logger.child({ process: 'worker' })
let running = true

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------
async function writeHeartbeat(): Promise<void> {
  try {
    const db = getDb()
    await db
      .insert(kv)
      .values({ key: 'worker:heartbeat', value: { ts: new Date().toISOString(), pid: process.pid }, updated_at: new Date() })
      .onConflictDoUpdate({ target: kv.key, set: { value: { ts: new Date().toISOString(), pid: process.pid }, updated_at: new Date() } })
  } catch {
    // non-fatal
  }
}

// ---------------------------------------------------------------------------
// Job dispatcher
// ---------------------------------------------------------------------------
async function dispatchJob(job: { id: string; type: string; payload: unknown; attempts: number }): Promise<void> {
  const payload = job.payload as Record<string, unknown>

  switch (job.type) {
    case 'VERIFY_SUBMISSION':
      await handleVerifySubmission(payload as unknown as Parameters<typeof handleVerifySubmission>[0])
      break

    case 'RELEASE_MILESTONE':
      await releaseMilestone({
        contractId: payload['contract_id'] as string,
        milestoneKey: payload['milestone_key'] as string,
      })
      break

    case 'VOID_REMAINING':
      await voidRemaining(
        payload['contract_id'] as string,
        (payload['reason'] as string) ?? 'system'
      )
      break

    // Other handlers are stubs — to be implemented in later phases
    case 'AUTO_RELEASE':
    case 'REAUTH_CHECK':
    case 'RECONCILE_PAYPAL':
    case 'EXPIRE_CONTRACT':
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
async function pollOnce(): Promise<boolean> {
  const job = await claimNextJob()
  if (!job) return false

  const log2 = log.child({ job_id: job.id, type: job.type })
  log2.info('Job claimed')

  try {
    await dispatchJob({ id: job.id, type: job.type, payload: job.payload, attempts: job.attempts })
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

async function runWorker(): Promise<void> {
  log.info('Worker starting')

  // Reclaim stale locks on startup
  const reclaimed = await reclaimStaleLocks()
  if (reclaimed > 0) log.info({ reclaimed }, 'Reclaimed stale jobs')

  // Heartbeat every 30s
  const heartbeatInterval = setInterval(() => void writeHeartbeat(), 30_000)
  await writeHeartbeat()

  // Poll loop: 200ms idle, immediate retry when job found
  while (running) {
    try {
      const found = await pollOnce()
      if (!found) await sleep(200)
    } catch (err) {
      log.error({ err: String(err) }, 'Poll loop error')
      await sleep(1000)
    }
  }

  clearInterval(heartbeatInterval)
  log.info('Worker stopped')
}

// Graceful shutdown
process.on('SIGTERM', () => { running = false; log.info('SIGTERM received') })
process.on('SIGINT', () => { running = false; log.info('SIGINT received') })

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

runWorker().catch((err) => {
  log.fatal({ err: String(err) }, 'Worker fatal error')
  process.exit(1)
})
