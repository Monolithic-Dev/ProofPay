/**
 * Integration Test: Automated PayPal Dispute Evidence Dossier & Submission
 * Enterprise Standard: Pillars 1 & 3 (Financial Defense & Zero-Trust Authorization).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { getDb } from '@/server/db/client'
import { milestones, disputes, ledger_events } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { GET as getDisputeEvidenceRoute, POST as postDisputeEvidenceRoute } from '@/app/api/v1/contracts/[id]/dispute-evidence/route'
import { makeUser, makeContractFixture, resetDb, checkDbActive } from './helpers/db'
import { createSessionToken } from '@/server/auth/session'
import { NextRequest } from 'next/server'

describe('Dispute Evidence Dossier & Submission API', () => {
  let dbActive = false
  let buyer: any
  let seller: any
  let stranger: any
  let contract: any

  beforeEach(async () => {
    dbActive = await checkDbActive()
    if (!dbActive) return

    await resetDb()

    buyer = await makeUser('buyer')
    seller = await makeUser('seller')
    stranger = await makeUser('buyer')

    contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const db = getDb()
    await db.insert(milestones).values({
      contract_id: contract.id,
      milestone_key: 'm1',
      idx: 1,
      title: 'Database Cleaning & Deduplication',
      amount_minor: 10000,
      due_in_days: 7,
      status: 'PASSED',
      deliverable_json: { content_type: 'text', max_bytes: 5000, description: 'Clean DB' },
    })
  })

  async function makeRequest(
    method: 'GET' | 'POST',
    contractId: string,
    user: any,
    body?: any
  ) {
    const sessionToken = await createSessionToken({
      sub: user.id,
      email: user.email,
      role: (user.role as 'buyer' | 'seller' | 'admin') ?? 'buyer',
      is_agent: false,
    })

    const headers: Record<string, string> = {
      cookie: `pp_session=${sessionToken}`,
    }
    if (body) {
      headers['content-type'] = 'application/json'
    }

    return new NextRequest(`http://localhost:3000/api/v1/contracts/${contractId}/dispute-evidence`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  it('rejects strangers with 404 NOT_FOUND (Zero-Trust IDOR guard)', async () => {
    if (!dbActive) return

    // Stranger GET
    const getReq = await makeRequest('GET', contract.id, stranger)
    const getRes = await getDisputeEvidenceRoute(getReq, { params: Promise.resolve({ id: contract.id }) })
    expect(getRes.status).toBe(404)

    // Stranger POST
    const postReq = await makeRequest('POST', contract.id, stranger, { note: 'malicious note' })
    const postRes = await postDisputeEvidenceRoute(postReq, { params: Promise.resolve({ id: contract.id }) })
    expect(postRes.status).toBe(404)
  })

  it('returns structured PAYPAL_DISPUTES_V1_EVIDENCE dossier to authorized party', async () => {
    if (!dbActive) return

    const req = await makeRequest('GET', contract.id, buyer)
    const res = await getDisputeEvidenceRoute(req, { params: Promise.resolve({ id: contract.id }) })

    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.dispute_format).toBe('PAYPAL_DISPUTES_V1_EVIDENCE')
    expect(json.evidence_type).toBe('THIRD_PARTY_PROOF')
    expect(json.contract_id).toBe(contract.id)
    expect(json.canonical_hash).toBe(contract.contract_hash)
    expect(json.ledger_verification_status).toBe('VALID_APPEND_ONLY_CHAIN')
    expect(json.milestones_fulfillment).toHaveLength(1)
    expect(json.milestones_fulfillment[0].milestone_key).toBe('m1')
    expect(json.milestones_fulfillment[0].status).toBe('PASSED')
    expect(json.cryptographic_chain.valid).toBe(true)
    expect(json.cryptographic_chain.head_hash).toBeDefined()
    expect(json.export_url).toContain('/proof-pack?format=pdf')
  })

  it('submits dispute evidence, updates dispute record, and appends to hash-chained ledger', async () => {
    if (!dbActive) return
    const db = getDb()

    const disputeId = 'PP-DISPUTE-TEST-9988'
    const postReq = await makeRequest('POST', contract.id, seller, {
      paypal_dispute_id: disputeId,
      note: 'Seller fulfilled all requirements under verified cryptographic milestone hash.',
    })

    const postRes = await postDisputeEvidenceRoute(postReq, { params: Promise.resolve({ id: contract.id }) })
    expect(postRes.status).toBe(201)

    const result = await postRes.json()
    expect(result.ok).toBe(true)
    expect(result.dispute_id).toBe(disputeId)
    expect(result.evidence_hash).toBeDefined()
    expect(result.submitted_at).toBeDefined()

    // Verify dispute record updated in database
    const [disputeRow] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.paypal_dispute_id, disputeId))
    expect(disputeRow).toBeDefined()
    expect(disputeRow?.evidence_submitted_at).not.toBeNull()

    // Verify DISPUTE_EVIDENCE_SUBMITTED appended to ledger
    const ledgerRows = await db
      .select()
      .from(ledger_events)
      .where(eq(ledger_events.contract_id, contract.id))
    const submittedEvent = ledgerRows.find((e) => e.type === 'DISPUTE_EVIDENCE_SUBMITTED')
    expect(submittedEvent).toBeDefined()
    expect((submittedEvent?.payload as any)?.paypal_dispute_id).toBe(disputeId)
    expect(submittedEvent?.actor_type).toBe('seller')
  })
})
