/**
 * Contract Ledger API — GET /api/v1/contracts/[id]/ledger
 * Supports pagination by after_seq & limit <= 500.
 * Implements phase-6-frontend.md §6.2 & api-spec.md §8.
 */
import { NextResponse } from 'next/server'
import { eq, gt, asc } from 'drizzle-orm'
import { apiHandler } from '@/server/http/handler'
import { getDb } from '@/server/db/client'
import { ledger_events } from '@/server/db/schema'
import { requireParty } from '@/server/auth/guards'
import { ZERO_HASH } from '@/server/contracts/canonical'
import type { LedgerEvent } from '@/shared/types'

export const GET = apiHandler(
  { auth: 'user' },
  async ({ user, params, req }) => {
    const contractId = params['id']!
    const db = getDb()

    // Enforce authorization: stranger gets 404
    await requireParty(db, contractId, user!)

    const url = new URL(req.url)
    const afterSeqParam = url.searchParams.get('after_seq')
    const limitParam = url.searchParams.get('limit')

    const afterSeq = afterSeqParam ? parseInt(afterSeqParam, 10) : 0
    let limit = limitParam ? parseInt(limitParam, 10) : 500
    if (isNaN(limit) || limit <= 0 || limit > 500) limit = 500

    let query = db
      .select()
      .from(ledger_events)
      .where(
        afterSeq > 0
          ? eq(ledger_events.contract_id, contractId) && gt(ledger_events.seq, afterSeq)
          : eq(ledger_events.contract_id, contractId)
      )
      .orderBy(asc(ledger_events.seq))
      .limit(limit)

    // Drizzle with combined where
    const rows = afterSeq > 0
      ? await db
          .select()
          .from(ledger_events)
          .where(eq(ledger_events.contract_id, contractId))
          .orderBy(asc(ledger_events.seq))
      : await query

    const filtered = afterSeq > 0 ? rows.filter((r) => r.seq > afterSeq).slice(0, limit) : rows

    // Head hash of the latest event overall
    const allEvents = await db
      .select({ hash: ledger_events.hash, seq: ledger_events.seq })
      .from(ledger_events)
      .where(eq(ledger_events.contract_id, contractId))
      .orderBy(asc(ledger_events.seq))

    const headHash = allEvents.length > 0 ? allEvents[allEvents.length - 1]!.hash : ZERO_HASH

    const events: LedgerEvent[] = filtered.map((e) => ({
      id: e.id,
      contract_id: e.contract_id,
      seq: e.seq,
      type: e.type,
      actor_type: e.actor_type as any,
      actor_id: e.actor_id ?? undefined,
      payload: e.payload as any,
      prev_hash: e.prev_hash,
      hash: e.hash,
      created_at: new Date(e.created_at).toISOString(),
    }))

    return NextResponse.json({ events, head_hash: headHash }, { status: 200 })
  }
)
