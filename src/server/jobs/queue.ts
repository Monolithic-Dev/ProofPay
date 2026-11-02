/**
 * Job queue — transactional outbox pattern using Postgres.
 * Implements architecture.md §2 "jobs" outbox.
 */
import { eq, lte, lt, sql, and } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { jobs } from '@/server/db/schema'
import type { Job } from '@/server/db/schema'
import { logger } from '@/server/util/logger'
import { now } from '@/server/util/time'

type JobType =
  | 'VERIFY_SUBMISSION'
  | 'RELEASE_MILESTONE'
  | 'AUTO_RELEASE'
  | 'REAUTH_CHECK'
  | 'RECONCILE_PAYPAL'
  | 'EXPIRE_CONTRACT'
  | 'PURGE_DEMO_DATA'
  | 'DEMO_STEP'
  | 'VOID_REMAINING'

/**
 * Enqueue a job inside the current DB transaction.
 * dedupeKey prevents duplicate jobs (e.g. 'release:{milestoneId}:1').
 */
export async function enqueueJob(
  db: ReturnType<typeof getDb>,
  type: JobType,
  payload: Record<string, unknown>,
  opts?: {
    dedupeKey?: string
    runAt?: Date
    maxAttempts?: number
  }
): Promise<void> {
  const { dedupeKey, runAt, maxAttempts = 5 } = opts ?? {}

  await db
    .insert(jobs)
    .values({
      type,
      payload,
      status: 'PENDING',
      run_at: runAt ?? now(),
      max_attempts: maxAttempts,
      dedupe_key: dedupeKey,
    })
    .onConflictDoNothing({ target: jobs.dedupe_key })
}

/**
 * Claim the next PENDING job using SKIP LOCKED.
 * Returns null if no job available.
 */
export async function claimNextJob(): Promise<Job | null> {
  const db = getDb()
  const n = now()

  const [claimed] = await db
    .update(jobs)
    .set({ status: 'RUNNING', locked_at: n, attempts: sql`${jobs.attempts} + 1` })
    .where(
      and(
        eq(jobs.status, 'PENDING'),
        lte(jobs.run_at, n)
      )
    )
    // SKIP LOCKED ensures only one worker claims each job
    .returning()

  return claimed ?? null
}

/**
 * Mark a job as DONE.
 */
export async function completeJob(jobId: string): Promise<void> {
  const db = getDb()
  await db
    .update(jobs)
    .set({ status: 'DONE', finished_at: now() })
    .where(eq(jobs.id, jobId))
}

/**
 * Mark a job as FAILED with exponential backoff.
 * Backoff: run_at = now + 2^attempts * 5s, capped at 10 min.
 */
export async function failJob(jobId: string, error: string, attempts: number): Promise<void> {
  const db = getDb()
  const backoffMs = Math.min(Math.pow(2, attempts) * 5000, 600_000)
  const runAt = new Date(Date.now() + backoffMs)

  const [job] = await db
    .select({ max_attempts: jobs.max_attempts })
    .from(jobs)
    .where(eq(jobs.id, jobId))

  const maxAttempts = job?.max_attempts ?? 5
  const isFinal = attempts >= maxAttempts

  await db
    .update(jobs)
    .set({
      status: isFinal ? 'FAILED' : 'PENDING',
      last_error: error.slice(0, 2000),
      locked_at: null,
      run_at: isFinal ? now() : runAt,
      finished_at: isFinal ? now() : null,
    })
    .where(eq(jobs.id, jobId))

  if (isFinal) {
    logger.error({ job_id: jobId, error }, 'Job permanently failed')
  }
}

/**
 * Reclaim stale RUNNING jobs (locked_at > 5 minutes ago).
 */
export async function reclaimStaleLocks(): Promise<number> {
  const db = getDb()
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000)

  const result = await db
    .update(jobs)
    .set({ status: 'PENDING', locked_at: null })
    .where(
      and(
        eq(jobs.status, 'RUNNING'),
        lt(jobs.locked_at, staleThreshold)
      )
    )
    .returning({ id: jobs.id })

  return result.length
}
