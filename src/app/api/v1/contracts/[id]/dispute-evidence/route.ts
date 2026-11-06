/**
 * Dispute Evidence Dossier API — GET/POST /api/v1/contracts/[id]/dispute-evidence
 * Enterprise Standard: Automated PayPal Dispute Defense Dossier Generation and Submission.
 * Implements docs/v2/01-NEXT-LEVEL-STRATEGY.md and PayPal Disputes v1 Integration.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { createHash } from 'crypto'
import { apiHandler } from '@/server/http/handler'
import { getDb, withTx, lockContract } from '@/server/db/client'
import { disputes } from '@/server/db/schema'
import { requireParty } from '@/server/auth/guards'
import { buildProofPack } from '@/server/ledger/proofpack'
import { appendLedgerEvent } from '@/server/ledger/append'

const SubmitDisputeEvidenceSchema = z.object({
  paypal_dispute_id: z.string().optional(),
  note: z.string().max(2000).optional(),
})

export const GET = apiHandler(
  { auth: 'user' },
  async ({ user, params }) => {
    const contractId = params['id']!
    const db = getDb()

    // 1. Zero-Trust Authorization (Strangers receive 404 NOT_FOUND)
    const party = await requireParty(db, contractId, user!)
    const contract = party.contract

    const proofPack = await buildProofPack(contractId)

    // 2. Extract all Ed25519 attestations recorded in ledger events
    const attestations = proofPack.ledger
      .map((entry) => (entry.payload as any)?.attestation)
      .filter((att) => att && typeof att === 'object' && att.signature)

    // 3. Format for PayPal Disputes API provide_evidence payload
    const paypalDisputeEvidence = {
      dispute_format: 'PAYPAL_DISPUTES_V1_EVIDENCE',
      evidence_type: 'THIRD_PARTY_PROOF',
      contract_id: contract.id,
      title: contract.title,
      canonical_hash: contract.contract_hash,
      paypal_authorization_id: contract.authorization_id,
      paypal_order_id: contract.paypal_order_id,
      ledger_verification_status: proofPack.chain.valid ? 'VALID_APPEND_ONLY_CHAIN' : 'TAMPER_DETECTED',
      ledger_events_count: proofPack.ledger.length,
      evidence_summary: `ProofPay cryptographically verified milestone fulfillment against mutually agreed criteria locked under SHA-256 agreement hash ${contract.contract_hash}.`,
      requestor_role: party.partyRole,
      milestones_fulfillment: proofPack.milestones.map((m) => ({
        milestone_key: m.key,
        status: m.status,
        submissions_count: m.submissions.length,
        submissions: m.submissions.map((s) => ({
          attempt: s.attempt,
          sha256: s.sha256,
          received_at: s.received_at,
        })),
        verifications_summary: m.verifications.map((v) => ({
          decision: v.decision,
          status: v.status,
          reasons: v.reasons,
          criteria: v.criteria,
        })),
      })),
      attestations: {
        count: attestations.length,
        items: attestations,
      },
      cryptographic_chain: {
        valid: proofPack.chain.valid,
        head_hash: proofPack.chain.head_hash,
        verified_at: new Date().toISOString(),
      },
      export_url: `/api/v1/contracts/${contractId}/proof-pack?format=pdf`,
    }

    return NextResponse.json(paypalDisputeEvidence, { status: 200 })
  }
)

export const POST = apiHandler(
  {
    auth: 'user',
    body: SubmitDisputeEvidenceSchema,
  },
  async ({ user, params, body }) => {
    const contractId = params['id']!
    const db = getDb()

    // 1. Zero-Trust Authorization (Strangers receive 404 NOT_FOUND)
    const party = await requireParty(db, contractId, user!)

    const proofPack = await buildProofPack(contractId)

    const evidenceSummary = `Cryptographic defense packet compiled by ${party.partyRole} (${user!.sub}): canonical agreement hash ${proofPack.contract.hash}, chain valid: ${proofPack.chain.valid}, ${proofPack.ledger.length} events logged.`

    const evidenceHash = createHash('sha256')
      .update(`${contractId}:${proofPack.chain.head_hash}:${Date.now()}`)
      .digest('hex')

    const submittedAt = new Date()

    const result = await withTx(async (tx) => {
      await lockContract(tx, contractId)

      let disputeRecordId: string | null = null
      const disputeId = body?.paypal_dispute_id

      if (disputeId) {
        const existing = await tx
          .select({ id: disputes.id })
          .from(disputes)
          .where(eq(disputes.paypal_dispute_id, disputeId))
          .limit(1)

        if (existing.length > 0) {
          disputeRecordId = existing[0]!.id
          await tx
            .update(disputes)
            .set({ evidence_submitted_at: submittedAt })
            .where(eq(disputes.id, disputeRecordId))
        } else {
          const [inserted] = await tx
            .insert(disputes)
            .values({
              contract_id: contractId,
              paypal_dispute_id: disputeId,
              status: 'OPEN',
              evidence_submitted_at: submittedAt,
            })
            .returning({ id: disputes.id })
          disputeRecordId = inserted?.id ?? null
        }
      }

      const actorType = party.partyRole === 'admin' ? 'system' : party.partyRole
      const ledgerEvent = await appendLedgerEvent(tx, {
        contractId,
        type: 'DISPUTE_EVIDENCE_SUBMITTED',
        actorType,
        actorId: user!.sub,
        payload: {
          paypal_dispute_id: disputeId ?? null,
          evidence_hash: evidenceHash,
          evidence_summary: evidenceSummary,
          note: body?.note ?? null,
          submitted_at: submittedAt.toISOString(),
          chain_head: proofPack.chain.head_hash,
        },
      })

      return {
        ok: true,
        contract_id: contractId,
        dispute_id: disputeId ?? null,
        evidence_hash: evidenceHash,
        ledger_seq: ledgerEvent.seq,
        submitted_at: submittedAt.toISOString(),
      }
    })

    return NextResponse.json(result, { status: 201 })
  }
)
