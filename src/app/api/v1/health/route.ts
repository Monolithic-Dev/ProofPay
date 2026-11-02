/**
 * Health check route — GET /api/v1/health
 * Implements phase-3-auth-and-contracts.md §3.8.
 */
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { getBudgetStatus } from '@/server/ai/llm'
import { kvGet } from '@/server/db/repos/kv.repo'

export async function GET() {
  let dbStatus = 'ok'
  try {
    await getDb().execute(sql`SELECT 1`)
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
  try {
    const hb = await kvGet<{ timestamp: string }>('worker:heartbeat')
    workerHeartbeat = hb?.timestamp ?? null
  } catch {
    // KV unavailable
  }

  const isHealthy = dbStatus === 'ok'

  return NextResponse.json(
    {
      status: isHealthy ? 'ok' : 'degraded',
      db: dbStatus,
      llm_budget: llmBudget,
      worker: {
        last_heartbeat: workerHeartbeat,
      },
      version: process.env['RENDER_GIT_COMMIT'] ?? 'dev',
      timestamp: new Date().toISOString(),
    },
    { status: isHealthy ? 200 : 503 }
  )
}
