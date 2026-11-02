/**
 * Proof Pack Download API — GET /api/v1/contracts/[id]/proof-pack?format=json|pdf
 * Implements phase-6-frontend.md §6.2 & api-spec.md §8.
 */
import { NextResponse } from 'next/server'
import { apiHandler } from '@/server/http/handler'
import { getDb } from '@/server/db/client'
import { requireParty } from '@/server/auth/guards'
import { buildProofPack, renderProofPackPdf } from '@/server/ledger/proofpack'

export const GET = apiHandler(
  { auth: 'user' },
  async ({ user, params, req }) => {
    const contractId = params['id']!
    const db = getDb()

    // Stranger gets 404
    await requireParty(db, contractId, user!)

    const url = new URL(req.url)
    const format = url.searchParams.get('format') ?? 'json'

    const pack = await buildProofPack(contractId)

    if (format === 'pdf') {
      const pdfBuffer = await renderProofPackPdf(pack)
      return new NextResponse(pdfBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="proof-pack-${contractId}.pdf"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      })
    }

    return NextResponse.json(pack, { status: 200 })
  }
)
