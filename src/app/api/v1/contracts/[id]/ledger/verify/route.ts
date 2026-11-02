/**
 * Ledger Verification API — GET /api/v1/contracts/[id]/ledger/verify
 * Walks the hash chain and verifies cryptographically.
 * Implements phase-6-frontend.md §6.2 & api-spec.md §8.
 */
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { apiHandler } from '@/server/http/handler'
import { getDb } from '@/server/db/client'
import { ledger_events } from '@/server/db/schema'
import { requireParty } from '@/server/auth/guards'
import { verifyLedger } from '@/server/ledger/verify'

export const GET = apiHandler(
  { auth: 'user' },
  async ({ user, params }) => {
    const contractId = params['id']!
    const db = getDb()

    // Stranger gets 404
    await requireParty(db, contractId, user!)

    const result = await verifyLedger(contractId)

    const allEvents = await db
      .select({ seq: ledger_events.seq })
      .from(ledger_events)
      .where(eq(ledger_events.contract_id, contractId))

    return NextResponse.json(
      {
        valid: result.valid,
        checked: allEvents.length,
        broken_at_seq: result.valid ? null : result.broken_at_seq,
      },
      { status: 200 }
    )
  }
)
