import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { contracts, milestones, verifications, submissions, ledger_events } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { buildProofPack } from '@/server/ledger/proofpack'
import { toErrorResponse, httpStatusFor, UnauthorizedError, NotFoundError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

export async function GET(
  req: NextRequest,
  context: any = {}
) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) throw new UnauthorizedError('UNAUTHENTICATED')

    const params = await context.params
    const contractId = params.id
    const db = getDb()

    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1)

    if (!contract) throw new NotFoundError('Contract not found')

    const proofPack = await buildProofPack(contractId)

    // Format for PayPal Disputes API provide_evidence payload
    const paypalDisputeEvidence = {
      dispute_format: 'PAYPAL_DISPUTES_V1_EVIDENCE',
      evidence_type: 'THIRD_PARTY_PROOF',
      contract_id: contract.id,
      canonical_hash: contract.contract_hash,
      paypal_authorization_id: contract.authorization_id,
      paypal_order_id: contract.paypal_order_id,
      ledger_verification_status: proofPack.chain.valid ? 'VALID_APPEND_ONLY_CHAIN' : 'TAMPER_DETECTED',
      ledger_events_count: proofPack.ledger.length,
      evidence_summary: `ProofPay cryptographically verified milestone fulfillment against mutually agreed criteria locked under SHA-256 agreement hash ${contract.contract_hash}.`,
      milestones_fulfillment: proofPack.milestones.map((m) => ({
        milestone_key: m.key,
        status: m.status,
        submissions_count: m.submissions.length,
        verifications_summary: m.verifications.map((v) => ({
          decision: v.decision,
          status: v.status,
          reasons: v.reasons,
          criteria: v.criteria,
        })),
      })),
      cryptographic_chain: {
        valid: proofPack.chain.valid,
        head_hash: proofPack.chain.head_hash,
        verified_at: new Date().toISOString(),
      },
      export_url: `/api/v1/contracts/${contractId}/proof-pack?format=pdf`,
    }

    return NextResponse.json(paypalDisputeEvidence, {
      status: 200,
      headers: { 'X-Request-Id': requestId },
    })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
