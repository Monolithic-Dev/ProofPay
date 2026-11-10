/**
 * N1 Loophole Finder Scan API — POST /api/v1/contracts/[id]/loophole-scan
 * Probes acceptance criteria with adversarial exploit payloads and proves
 * mathematically which exploits would currently pass deterministic checks.
 */
import { NextResponse } from 'next/server'
import { apiHandler } from '@/server/http/handler'
import { getDb } from '@/server/db/client'
import { requireParty } from '@/server/auth/guards'
import { scanContractForLoopholes } from '@/server/contracts/loophole-finder'

export const POST = apiHandler(
  { auth: 'user' },
  async ({ user, params }) => {
    const contractId = params['id']!
    const db = getDb()

    // Stranger gets 404 (IDOR protection)
    const { contract } = await requireParty(db, contractId, user!)

    const contractJson =
      contract.contract_json && typeof contract.contract_json === 'object'
        ? { ...(contract.contract_json as Record<string, unknown>), id: contract.id, version: contract.version }
        : { id: contract.id, version: contract.version, milestones: [] }

    const scanResult = await scanContractForLoopholes(contractJson)

    return NextResponse.json(scanResult, { status: 200 })
  }
)

