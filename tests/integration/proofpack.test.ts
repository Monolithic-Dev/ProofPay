/**
 * Integration Test: Ledger & Proof Pack (JSON + PDF)
 * Implements phase-6-frontend.md §6.2.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { getDb } from '@/server/db/client'
import { users, contracts, milestones, ledger_events } from '@/server/db/schema'
import { sql } from 'drizzle-orm'
import { buildProofPack, renderProofPackPdf } from '@/server/ledger/proofpack'
import { appendLedgerEvent } from '@/server/ledger/append'
import { verifyLedger } from '@/server/ledger/verify'
import { GET as getProofPackRoute } from '@/app/api/v1/contracts/[id]/proof-pack/route'
import { GET as getLedgerRoute } from '@/app/api/v1/contracts/[id]/ledger/route'
import { makeUser, makeContractFixture, resetDb } from './helpers/db'
import { createSessionToken } from '@/server/auth/session'
import { NextRequest } from 'next/server'

describe('Proof Pack & Ledger Integration', () => {
  let buyer: any
  let seller: any
  let stranger: any
  let contract: any

  beforeEach(async () => {
    await resetDb()

    buyer = await makeUser('buyer')
    seller = await makeUser('seller')
    stranger = await makeUser('buyer')

    contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    // Add milestone
    const db = getDb()
    await db.insert(milestones).values({
      contract_id: contract.id,
      milestone_key: 'm1',
      idx: 1,
      title: '25 Product Records',
      amount_minor: 6000,
      due_in_days: 3,
      deliverable_json: { type: 'json_records', description: '25 records' },
      status: 'RELEASED',
      capture_id: 'CAP-TEST-12345',
    })

    // Append 3 ledger events
    await appendLedgerEvent(db, {
      contractId: contract.id,
      type: 'CONTRACT_CREATED',
      actorType: 'buyer',
      actorId: buyer.id,
      payload: { title: contract.title, total_minor: contract.total_minor },
    })

    await appendLedgerEvent(db, {
      contractId: contract.id,
      type: 'AUTHORIZATION_CREATED',
      actorType: 'paypal',
      payload: { authorization_id: 'AUTH-TEST-999', amount_minor: contract.total_minor },
    })

    await appendLedgerEvent(db, {
      contractId: contract.id,
      type: 'CAPTURE_COMPLETED',
      actorType: 'paypal',
      payload: { milestone_key: 'm1', capture_id: 'CAP-TEST-12345', amount_minor: 6000 },
    })
  })

  it('proof pack JSON matches schema', async () => {
    const pack = await buildProofPack(contract.id)

    expect(pack.version).toBe(1)
    expect(pack.disclaimer).toContain('Authorization hold, not escrow')
    expect(pack.contract.id).toBe(contract.id)
    expect(pack.contract.buyer.email).toBe(buyer.email)
    expect(pack.contract.seller?.email).toBe(seller.email)
    expect(pack.milestones).toHaveLength(1)
    expect(pack.milestones[0]?.key).toBe('m1')
    expect(pack.ledger).toHaveLength(3)
  })

  it('includes head_hash equal to verifyChain', async () => {
    const pack = await buildProofPack(contract.id)
    const verification = await verifyLedger(contract.id)

    expect(verification.valid).toBe(true)
    expect(pack.chain.valid).toBe(true)
    expect(pack.chain.head_hash).toBe(pack.ledger[pack.ledger.length - 1]?.hash)
    expect(pack.chain.head_hash).toHaveLength(64)
  })

  it('PDF renders with %PDF header and under 2 MB', async () => {
    const pack = await buildProofPack(contract.id)
    const pdfBuffer = await renderProofPackPdf(pack)

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF')
    expect(pdfBuffer.length).toBeLessThan(2 * 1024 * 1024) // < 2 MB
    expect(pdfBuffer.length).toBeGreaterThan(1000)
  })

  it('stranger gets 404', async () => {
    const strangerToken = await createSessionToken({
      sub: stranger.id,
      email: stranger.email,
      role: stranger.role,
      is_agent: false,
    })

    const req = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${contract.id}/proof-pack`,
      {
        headers: {
          Authorization: `Bearer ${strangerToken}`,
        },
      }
    )

    const res = await getProofPackRoute(req, { params: Promise.resolve({ id: contract.id }) })
    expect(res.status).toBe(404)
  })

  it('ledger route paginates by after_seq', async () => {
    const buyerToken = await createSessionToken({
      sub: buyer.id,
      email: buyer.email,
      role: buyer.role,
      is_agent: false,
    })

    // Fetch all events
    const req1 = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${contract.id}/ledger`,
      {
        headers: { Authorization: `Bearer ${buyerToken}` },
      }
    )
    const res1 = await getLedgerRoute(req1, { params: Promise.resolve({ id: contract.id }) })
    expect(res1.status).toBe(200)
    const json1 = (await res1.json()) as any
    expect(json1.events).toHaveLength(3)
    expect(json1.events[0].seq).toBe(1)
    expect(json1.events[2].seq).toBe(3)

    // Paginate with after_seq=1
    const req2 = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${contract.id}/ledger?after_seq=1`,
      {
        headers: { Authorization: `Bearer ${buyerToken}` },
      }
    )
    const res2 = await getLedgerRoute(req2, { params: Promise.resolve({ id: contract.id }) })
    expect(res2.status).toBe(200)
    const json2 = (await res2.json()) as any
    expect(json2.events).toHaveLength(2)
    expect(json2.events[0].seq).toBe(2)
    expect(json2.events[1].seq).toBe(3)
  })
})
