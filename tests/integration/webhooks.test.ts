/**
 * PayPal Webhook Integration Tests (§5.7).
 * Tests webhook signature verification, event mapping, idempotency, and status guards.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { resetDb, makeUser, makeContractFixture, checkDbActive } from './helpers/db'
import { contracts, milestones, ledger_events, paypalEvents } from '@/server/db/schema'
import { SANDBOX_BASE_URL, resetTokenCacheForTests } from '@/server/paypal/client'
import { POST as webhookRoute } from '@/app/api/v1/webhooks/paypal/route'
import { NextRequest } from 'next/server'

const defaultHandlers = [
  http.post(`${SANDBOX_BASE_URL}/v1/oauth2/token`, () => {
    return HttpResponse.json({
      access_token: 'mock_test_access_token_123',
      expires_in: 3600,
    })
  }),
  http.post(`${SANDBOX_BASE_URL}/v1/notifications/verify-webhook-signature`, async ({ request }) => {
    const body = (await request.json()) as any
    if (body.auth_algo === 'INVALID') {
      return HttpResponse.json({ verification_status: 'FAILURE' })
    }
    return HttpResponse.json({ verification_status: 'SUCCESS' })
  }),
]

const server = setupServer(...defaultHandlers)

function makeWebhookRequest(body: any, headersOverride?: Record<string, string>) {
  const rawBody = JSON.stringify(body)
  const headers = new Headers({
    'content-type': 'application/json',
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360-fake',
    'paypal-transmission-id': 'transmission-uuid-1234',
    'paypal-transmission-sig': 'mock_signature_bytes_base64',
    'paypal-transmission-time': new Date().toISOString(),
    ...headersOverride,
  })

  return new NextRequest('http://localhost:3000/api/v1/webhooks/paypal', {
    method: 'POST',
    headers,
    body: rawBody,
  })
}

describe('PayPal Webhooks Integration (§5.7)', () => {
  let dbActive = false

  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
  beforeEach(async () => {
    dbActive = await checkDbActive()
    if (dbActive) {
      await resetDb()
    }
    server.resetHandlers(...defaultHandlers)
    resetTokenCacheForTests()
  })
  afterEach(() => {
    server.resetHandlers(...defaultHandlers)
    resetTokenCacheForTests()
  })
  afterAll(() => server.close())

  it('valid signature processes capture completed', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const shortId = contract.id.slice(0, 8)
    const [m1] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 6000,
        due_in_days: 7,
        status: 'RELEASING',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    const event = {
      id: 'WH-EVT-CAPTURE-COMPLETED-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource_type: 'capture',
      resource: {
        id: 'CAP-123456',
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '60.00' },
        invoice_id: `PP-${shortId}-m1`,
        custom_id: contract.id,
      },
    }

    const req = makeWebhookRequest(event)
    const res = await webhookRoute(req)
    expect(res.status).toBe(200)

    const [updatedM] = await db.select().from(milestones).where(eq(milestones.id, m1!.id))
    expect(updatedM?.status).toBe('RELEASED')
    expect(updatedM?.capture_id).toBe('CAP-123456')
    expect(updatedM?.captured_at).not.toBeNull()

    const [contractUpdated] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(contractUpdated?.status).toBe('COMPLETED')

    const ledger = await db
      .select()
      .from(ledger_events)
      .where(eq(ledger_events.contract_id, contract.id))
    const captureEvt = ledger.find((l) => l.type === 'CAPTURE_COMPLETED')
    expect(captureEvt).toBeDefined()
    expect(captureEvt?.payload).toMatchObject({
      milestone_key: 'm1',
      capture_id: 'CAP-123456',
      amount_minor: 6000,
    })
  })

  it('invalid signature returns 400 and changes nothing', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const shortId = contract.id.slice(0, 8)
    const [m1] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 6000,
        due_in_days: 7,
        status: 'RELEASING',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    const event = {
      id: 'WH-EVT-BAD-SIG',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAP-999',
        status: 'COMPLETED',
        invoice_id: `PP-${shortId}-m1`,
      },
    }

    const req = makeWebhookRequest(event, { 'paypal-auth-algo': 'INVALID' })
    const res = await webhookRoute(req)
    expect(res.status).toBe(400)

    const [updatedM] = await db.select().from(milestones).where(eq(milestones.id, m1!.id))
    expect(updatedM?.status).toBe('RELEASING')
    expect(updatedM?.capture_id).toBeNull()

    const storedEvents = await db
      .select()
      .from(paypalEvents)
      .where(eq(paypalEvents.event_id, 'WH-EVT-BAD-SIG'))
    expect(storedEvents).toHaveLength(1)
    expect(storedEvents[0]?.signature_valid).toBe(false)
  })

  it('duplicate event_id is ignored', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const shortId = contract.id.slice(0, 8)
    await db.insert(milestones).values({
      contract_id: contract.id,
      milestone_key: 'm1',
      idx: 1,
      title: 'Milestone 1',
      amount_minor: 6000,
      due_in_days: 7,
      status: 'RELEASING',
      deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
    })

    const event = {
      id: 'WH-EVT-DUP-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAP-DUP',
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '60.00' },
        invoice_id: `PP-${shortId}-m1`,
      },
    }

    const res1 = await webhookRoute(makeWebhookRequest(event))
    expect(res1.status).toBe(200)

    const res2 = await webhookRoute(makeWebhookRequest(event))
    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2.duplicate).toBe(true)

    const whEvents = await db
      .select()
      .from(ledger_events)
      .where(
        and(
          eq(ledger_events.contract_id, contract.id),
          eq(ledger_events.type, 'WEBHOOK_RECEIVED')
        )
      )
    expect(whEvents).toHaveLength(1)
  })

  it('CAPTURE.COMPLETED before API response committed converges to RELEASED once', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const shortId = contract.id.slice(0, 8)
    const [m1] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 6000,
        due_in_days: 7,
        status: 'RELEASING',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    const event = {
      id: 'WH-EVT-RACE-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAP-RACE-1',
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '60.00' },
        invoice_id: `PP-${shortId}-m1`,
      },
    }

    // Webhook arrives first
    const res = await webhookRoute(makeWebhookRequest(event))
    expect(res.status).toBe(200)

    const [mUpdated] = await db.select().from(milestones).where(eq(milestones.id, m1!.id))
    expect(mUpdated?.status).toBe('RELEASED')
    expect(mUpdated?.capture_id).toBe('CAP-RACE-1')

    // Second webhook or late event arrives
    const event2 = {
      ...event,
      id: 'WH-EVT-RACE-2',
    }
    const res2 = await webhookRoute(makeWebhookRequest(event2))
    expect(res2.status).toBe(200)

    const allLedger = await db
      .select()
      .from(ledger_events)
      .where(
        and(
          eq(ledger_events.contract_id, contract.id),
          eq(ledger_events.type, 'CAPTURE_COMPLETED')
        )
      )
    expect(allLedger).toHaveLength(1)
  })

  it('CAPTURE.DENIED moves RELEASING to RELEASE_FAILED', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const shortId = contract.id.slice(0, 8)
    const [m1] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 6000,
        due_in_days: 7,
        status: 'RELEASING',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    const event = {
      id: 'WH-EVT-DENIED-1',
      event_type: 'PAYMENT.CAPTURE.DENIED',
      resource: {
        id: 'CAP-DENIED-1',
        status: 'DENIED',
        invoice_id: `PP-${shortId}-m1`,
      },
    }

    const res = await webhookRoute(makeWebhookRequest(event))
    expect(res.status).toBe(200)

    const [updatedM] = await db.select().from(milestones).where(eq(milestones.id, m1!.id))
    expect(updatedM?.status).toBe('RELEASE_FAILED')

    const ledger = await db
      .select()
      .from(ledger_events)
      .where(eq(ledger_events.contract_id, contract.id))
    const failedEvt = ledger.find((l) => l.type === 'CAPTURE_FAILED')
    expect(failedEvt).toBeDefined()
  })

  it('unexpected AUTHORIZATION.VOIDED sets funding_at_risk', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH-WEBHOOK-VOID' })
      .where(eq(contracts.id, contract.id))

    const event = {
      id: 'WH-EVT-AUTH-VOIDED',
      event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
      resource: {
        id: 'AUTH-WEBHOOK-VOID',
        status: 'VOIDED',
      },
    }

    const res = await webhookRoute(makeWebhookRequest(event))
    expect(res.status).toBe(200)

    const [updatedC] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updatedC?.funding_at_risk).toBe(true)
  })

  it('self-initiated void is a no-op', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('CANCELLED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH-SELF-VOID', funding_at_risk: false })
      .where(eq(contracts.id, contract.id))

    const event = {
      id: 'WH-EVT-SELF-VOID',
      event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
      resource: {
        id: 'AUTH-SELF-VOID',
        status: 'VOIDED',
      },
    }

    const res = await webhookRoute(makeWebhookRequest(event))
    expect(res.status).toBe(200)

    const [updatedC] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updatedC?.funding_at_risk).toBe(false)
  })

  it('event for unknown contract is stored and ignored', async () => {
    if (!dbActive) return
    const db = getDb()

    const event = {
      id: 'WH-EVT-UNKNOWN',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAP-UNKNOWN',
        status: 'COMPLETED',
        invoice_id: 'PP-99999999-m1',
      },
    }

    const res = await webhookRoute(makeWebhookRequest(event))
    expect(res.status).toBe(200)

    const storedEvents = await db
      .select()
      .from(paypalEvents)
      .where(eq(paypalEvents.event_id, 'WH-EVT-UNKNOWN'))
    expect(storedEvents).toHaveLength(1)
    expect(storedEvents[0]?.contract_id).toBeNull()
  })

  it('handler never moves RELEASED back to RELEASING', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const shortId = contract.id.slice(0, 8)
    const [m1] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 6000,
        due_in_days: 7,
        status: 'RELEASED',
        capture_id: 'CAP-PERMANENT',
        captured_at: new Date(),
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    const event = {
      id: 'WH-EVT-LATE-DENIED',
      event_type: 'PAYMENT.CAPTURE.DENIED',
      resource: {
        id: 'CAP-PERMANENT',
        status: 'DENIED',
        invoice_id: `PP-${shortId}-m1`,
      },
    }

    const res = await webhookRoute(makeWebhookRequest(event))
    expect(res.status).toBe(200)

    const [mCheck] = await db.select().from(milestones).where(eq(milestones.id, m1!.id))
    expect(mCheck?.status).toBe('RELEASED')
    expect(mCheck?.capture_id).toBe('CAP-PERMANENT')
  })
})
