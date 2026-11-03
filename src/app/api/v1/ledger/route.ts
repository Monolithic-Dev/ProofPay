import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { ledger_events, contracts } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { newRequestId } from '@/server/util/ids'

export async function GET(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    const db = getDb()

    // Fetch ledger events joined with contract details
    const rows = await db
      .select({
        id: ledger_events.id,
        contract_id: ledger_events.contract_id,
        seq: ledger_events.seq,
        type: ledger_events.type,
        actor_type: ledger_events.actor_type,
        actor_id: ledger_events.actor_id,
        payload: ledger_events.payload,
        prev_hash: ledger_events.prev_hash,
        hash: ledger_events.hash,
        created_at: ledger_events.created_at,
        contract_title: contracts.title,
        contract_status: contracts.status,
        total_minor: contracts.total_minor,
      })
      .from(ledger_events)
      .leftJoin(contracts, eq(ledger_events.contract_id, contracts.id))
      .orderBy(desc(ledger_events.created_at))
      .limit(200)

    return NextResponse.json(
      {
        events: rows,
        total: rows.length,
      },
      { headers: { 'X-Request-Id': requestId } }
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || 'Failed to fetch ledger events' } },
      { status: 500, headers: { 'X-Request-Id': requestId } }
    )
  }
}
