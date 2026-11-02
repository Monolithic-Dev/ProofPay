/**
 * Integration Test: Server-Sent Events (SSE) Route
 * Implements phase-6-frontend.md §6.2 & Correction C-3.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { getDb } from '@/server/db/client'
import { appendLedgerEvent } from '@/server/ledger/append'
import { GET as getSseRoute } from '@/app/api/v1/contracts/[id]/events/route'
import { makeUser, makeContractFixture, resetDb } from './helpers/db'
import { createSessionToken } from '@/server/auth/session'
import { NextRequest } from 'next/server'

describe('SSE Live Events Route', () => {
  let buyer: any
  let stranger: any
  let contract: any
  let buyerToken: string

  beforeEach(async () => {
    await resetDb()

    buyer = await makeUser('buyer')
    stranger = await makeUser('buyer')
    contract = await makeContractFixture('FUNDED', buyer.id)

    buyerToken = await createSessionToken({
      sub: buyer.id,
      email: buyer.email,
      role: buyer.role,
      is_agent: false,
    })
  })

  it('stranger gets 404', async () => {
    const strangerToken = await createSessionToken({
      sub: stranger.id,
      email: stranger.email,
      role: stranger.role,
      is_agent: false,
    })

    const req = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${contract.id}/events`,
      {
        headers: { Authorization: `Bearer ${strangerToken}` },
      }
    )

    const res = await getSseRoute(req, { params: Promise.resolve({ id: contract.id }) })
    expect(res.status).toBe(404)
  })

  it('streams new ledger events within 3s', async () => {
    const controller = new AbortController()

    const req = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${contract.id}/events?after_seq=0`,
      {
        headers: { Authorization: `Bearer ${buyerToken}` },
        signal: controller.signal,
      }
    )

    const res = await getSseRoute(req, { params: Promise.resolve({ id: contract.id }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')

    const reader = res.body?.getReader()
    expect(reader).toBeDefined()

    // Append an event to DB
    const db = getDb()
    await appendLedgerEvent(db, {
      contractId: contract.id,
      type: 'CONTRACT_CREATED',
      actorType: 'buyer',
      payload: { title: contract.title },
    })

    // Read stream chunk
    const decoder = new TextDecoder()
    let receivedData = ''

    const readPromise = (async () => {
      while (true) {
        const { value, done } = await reader!.read()
        if (done) break
        const text = decoder.decode(value)
        receivedData += text
        if (receivedData.includes('contract.updated')) break
      }
    })()

    // Wait up to 3500ms
    await Promise.race([
      readPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('SSE timeout')), 3500)),
    ])

    controller.abort()

    expect(receivedData).toContain('event: contract.updated')
    expect(receivedData).toContain('CONTRACT_CREATED')
    expect(receivedData).toContain(contract.id)
  })

  it('resumes after_seq without duplicates', async () => {
    const db = getDb()

    // Create 2 events
    await appendLedgerEvent(db, {
      contractId: contract.id,
      type: 'CONTRACT_CREATED',
      actorType: 'buyer',
      payload: { title: contract.title },
    })

    await appendLedgerEvent(db, {
      contractId: contract.id,
      type: 'AUTHORIZATION_CREATED',
      actorType: 'paypal',
      payload: { authorization_id: 'AUTH-123' },
    })

    const controller = new AbortController()

    // Start after_seq=1 -> should only receive seq=2
    const req = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${contract.id}/events?after_seq=1`,
      {
        headers: { Authorization: `Bearer ${buyerToken}` },
        signal: controller.signal,
      }
    )

    const res = await getSseRoute(req, { params: Promise.resolve({ id: contract.id }) })
    expect(res.status).toBe(200)

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let receivedData = ''

    const readPromise = (async () => {
      while (true) {
        const { value, done } = await reader!.read()
        if (done) break
        const text = decoder.decode(value)
        receivedData += text
        if (receivedData.includes('AUTHORIZATION_CREATED')) break
      }
    })()

    await Promise.race([
      readPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('SSE timeout')), 3500)),
    ])

    controller.abort()

    expect(receivedData).toContain('AUTHORIZATION_CREATED')
    expect(receivedData).not.toContain('CONTRACT_CREATED')
  })
})
