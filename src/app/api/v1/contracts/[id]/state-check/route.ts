/**
 * State-Matches-Ledger Integrity API — GET /api/v1/contracts/[id]/state-check
 * Recomputes contract & milestone state purely from the SHA-256 ledger and
 * verifies 1:1 parity against PostgreSQL state.
 */
import { NextResponse } from 'next/server'
import { apiHandler } from '@/server/http/handler'
import { getDb } from '@/server/db/client'
import { requireParty } from '@/server/auth/guards'
import { verifyStateAgainstLedger } from '@/server/ledger/state-check'

export const GET = apiHandler(
  { auth: 'user' },
  async ({ user, params }) => {
    const contractId = params['id']!
    const db = getDb()

    // Stranger gets 404 (IDOR protection)
    await requireParty(db, contractId, user!)

    const report = await verifyStateAgainstLedger(contractId)

    return NextResponse.json(report, { status: 200 })
  }
)

