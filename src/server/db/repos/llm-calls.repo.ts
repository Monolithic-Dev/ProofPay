/**
 * LLM Calls repository — records LLM invocation telemetry and cost tracking.
 * Implements phase-2-data-layer.md §2.10 and data-model.md §3.11.
 */
import { gte, sql } from 'drizzle-orm'
import type { Tx, Db } from '@/server/db/client'
import { getDb } from '@/server/db/client'
import { llm_calls, type LlmCallRow, type NewLlmCall } from '@/server/db/schema'

export async function insertLlmCall(
  data: NewLlmCall,
  txOrDb?: Tx | Db
): Promise<LlmCallRow> {
  const db = txOrDb ?? getDb()
  const [row] = await db.insert(llm_calls).values(data).returning()
  if (!row) throw new Error('Failed to record LLM call')
  return row
}

export async function sumCostSince(
  since: Date,
  txOrDb?: Tx | Db
): Promise<number> {
  const db = txOrDb ?? getDb()
  const rows = await db
    .select({
      total: sql<number>`coalesce(sum(${llm_calls.cost_micro_usd}), 0)`,
    })
    .from(llm_calls)
    .where(gte(llm_calls.created_at, since))

  return rows[0]?.total ?? 0
}
