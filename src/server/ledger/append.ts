/**
 * Ledger append — hash-chained, advisory-locked.
 * Implements data-model.md §3.8 and architecture.md §7.
 */
import { eq, max, sql } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { ledger_events } from '@/server/db/schema'
import { hashLedgerEvent, ZERO_HASH } from '@/server/contracts/canonical'
import { isoMs, now } from '@/server/util/time'
import { ConflictError } from '@/server/util/errors'
import type { LedgerEvent } from '@/server/db/schema'

export type AppendLedgerParams = {
  contractId: string
  type: string
  actorType: 'buyer' | 'seller' | 'system' | 'paypal' | 'verifier'
  actorId?: string
  payload: Record<string, unknown>
}

/**
 * Append a new ledger event within the current DB transaction.
 * Must be called inside an existing transaction with an advisory lock held.
 * Uses UNIQUE(contract_id, seq) as the backstop against races.
 */
export async function appendLedgerEvent(
  db: ReturnType<typeof getDb>,
  params: AppendLedgerParams
): Promise<LedgerEvent> {
  const { contractId, type, actorType, actorId, payload } = params

  // Get max seq for this contract (within the same tx)
  const [{ maxSeq }] = await db
    .select({ maxSeq: max(ledger_events.seq) })
    .from(ledger_events)
    .where(eq(ledger_events.contract_id, contractId))

  const seq = (maxSeq ?? 0) + 1

  // Get previous hash
  let prevHash = ZERO_HASH
  if (seq > 1) {
    const [prev] = await db
      .select({ hash: ledger_events.hash })
      .from(ledger_events)
      .where(eq(ledger_events.contract_id, contractId))
      .orderBy(sql`${ledger_events.seq} DESC`)
      .limit(1)
    if (prev) prevHash = prev.hash
  }

  const createdAt = isoMs(now())
  const hash = hashLedgerEvent({ prevHash, contractId, seq, type, payload, createdAt })

  const [inserted] = await db
    .insert(ledger_events)
    .values({
      contract_id: contractId,
      seq,
      type,
      actor_type: actorType,
      actor_id: actorId,
      payload,
      prev_hash: prevHash,
      hash,
      created_at: new Date(createdAt),
    })
    .returning()

  if (!inserted) throw new ConflictError('Failed to append ledger event')
  return inserted
}
