/**
 * Ledger Time-Travel Replay API — GET /api/v1/contracts/[id]/replay
 * Returns full hash-verified ledger event stream and reduced final state.
 */
import { NextResponse } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import { apiHandler } from '@/server/http/handler'
import { getDb } from '@/server/db/client'
import { ledger_events } from '@/server/db/schema'
import { requireParty } from '@/server/auth/guards'
import { verifyLedger } from '@/server/ledger/verify'
import { reduceLedger, type LedgerEventInput } from '@/shared/ledger-reducer'
import type { LedgerEvent } from '@/shared/types'

export const GET = apiHandler(
  { auth: 'user' },
  async ({ user, params }) => {
    const contractId = params['id']!
    const db = getDb()

    // Stranger gets 404 (IDOR protection)
    await requireParty(db, contractId, user!)

    const rows = await db
      .select()
      .from(ledger_events)
      .where(eq(ledger_events.contract_id, contractId))
      .orderBy(asc(ledger_events.seq))

    const chainResult = await verifyLedger(contractId)

    const events: LedgerEvent[] = rows.map((e) => ({
      id: e.id,
      contract_id: e.contract_id,
      seq: e.seq,
      type: e.type,
      actor_type: e.actor_type as LedgerEvent['actor_type'],
      actor_id: e.actor_id ?? undefined,
      payload: (e.payload as Record<string, unknown>) || {},
      prev_hash: e.prev_hash,
      hash: e.hash,
      created_at: new Date(e.created_at).toISOString(),
    }))

    const reducerInputs: LedgerEventInput[] = events.map((e) => ({
      seq: e.seq,
      type: e.type,
      actor_type: e.actor_type,
      actor_id: e.actor_id,
      payload: e.payload as Record<string, any>,
      created_at: e.created_at,
      hash: e.hash,
      prev_hash: e.prev_hash,
    }))

    const finalState = reduceLedger(reducerInputs, contractId)

    return NextResponse.json(
      {
        contract_id: contractId,
        chain_valid: chainResult.valid,
        checked_events: events.length,
        broken_at_seq: chainResult.valid ? null : chainResult.broken_at_seq,
        events,
        final_state: finalState,
      },
      { status: 200 }
    )
  }
)

