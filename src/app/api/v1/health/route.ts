/**
 * Health check route — GET /api/v1/health
 * Implements phase-4-verification-engine.md §4.10 & phase-3-auth-and-contracts.md §3.8.
 */
import { NextResponse } from 'next/server'
import { sql, eq, and, lt } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { getBudgetStatus } from '@/server/ai/llm'
import { kvGet } from '@/server/db/repos/kv.repo'
import { jobs } from '@/server/db/schema'
import { getAccessToken } from '@/server/paypal/client'
import { env } from '@/server/config/env'
import { getLastCanaryResult } from '@/server/canary/last-run'

export async function GET() {
  const db = getDb()
  let dbStatus = 'ok'
  let dbLatencyMs = 0

  const t0 = Date.now()
  try {
    await db.execute(sql`SELECT 1`)
    dbLatencyMs = Date.now() - t0
  } catch {
    dbStatus = 'unreachable'
  }

  let llmBudget = {
    spent_usd: 0,
    limit_usd: 10,
    remaining_usd: 10,
    exhausted: false,
  }
  try {
    llmBudget = await getBudgetStatus()
  } catch {
    // Fallback if DB or budget unavailable
  }

  let workerHeartbeat: string | null = null
  let workerLagSeconds = 0
  try {
    const hb = await kvGet<{ timestamp: string }>('worker:heartbeat')
    if (hb?.timestamp) {
      workerHeartbeat = hb.timestamp
      workerLagSeconds = Math.max(0, Math.floor((Date.now() - new Date(hb.timestamp).getTime()) / 1000))
    }
  } catch {
    // KV unavailable
  }

  let pendingJobs = 0
  let stuckJobs = 0
  if (dbStatus === 'ok') {
    try {
      const pendingRows = await db
        .select({ count: sql<number>`count(*)` })
        .from(jobs)
        .where(eq(jobs.status, 'PENDING'))
      pendingJobs = Number(pendingRows[0]?.count ?? 0)

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const stuckRows = await db
        .select({ count: sql<number>`count(*)` })
        .from(jobs)
        .where(and(eq(jobs.status, 'RUNNING'), lt(jobs.locked_at, fiveMinutesAgo)))
      stuckJobs = Number(stuckRows[0]?.count ?? 0)
    } catch {
      // Table may not exist in scratch tests
    }
  }

  let paypalStatus = { ok: false, mode: env.PAYPAL_ENV }
  try {
    const token = await getAccessToken()
    paypalStatus.ok = !!token
  } catch {
    paypalStatus.ok = false
  }

  let status: 'ok' | 'degraded' | 'down' = 'ok'
  if (dbStatus !== 'ok') {
    status = 'down'
  } else if (workerLagSeconds > 120 || llmBudget.exhausted || stuckJobs > 5 || !paypalStatus.ok) {
    status = 'degraded'
  }

  return NextResponse.json(
    {
      status,
      db: dbStatus,
      db_latency_ms: dbLatencyMs,
      worker_lag_seconds: workerLagSeconds,
      pending_jobs: pendingJobs,
      stuck_jobs: stuckJobs,
      llm_budget: llmBudget,
      llm: {
        ...llmBudget,
        last_canary: getLastCanaryResult(),
      },
      paypal: paypalStatus,
      worker: {
        last_heartbeat: workerHeartbeat,
      },
      features: {
        chaos: Boolean(env.CHAOS_MODE),
        demo: Boolean(env.DEMO_MODE),
      },
      version: process.env['RENDER_GIT_COMMIT'] ?? 'dev',
      timestamp: new Date().toISOString(),
    },
    { status: status === 'down' ? 503 : 200 }
  )
}
