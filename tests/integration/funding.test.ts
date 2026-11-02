/**
 * Funding Flow Integration Tests (§5.5).
 * Tests startFunding, handlePayPalReturn, handlePayPalCancel, idempotency (E-12), and role guards.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { resetDb, makeUser, makeContractFixture, checkDbActive } from './helpers/db'
import { contracts, milestones, ledger_events } from '@/server/db/schema'
import { SANDBOX_BASE_URL, resetTokenCacheForTests } from '@/server/paypal/client'
import {
  startFunding,
  handlePayPalReturn,
  handlePayPalCancel,
} from '@/server/funding/service'
import { ConflictError, ForbiddenError, AppError } from '@/server/util/errors'

const defaultHandlers = [
  http.post(`${SANDBOX_BASE_URL}/v1/oauth2/token`, () => {
    return HttpResponse.json({
      access_token: 'mock_test_access_token_123',
      expires_in: 3600,
    })
  }),
]

const server = setupServer(...defaultHandlers)

describe('Funding Flow Integration (§5.5)', () => {
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

  it('fund returns approval_url and moves contract to FUNDING', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('ACCEPTED', buyer.id, seller.id)

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/checkout/orders`, () => {
        return HttpResponse.json({
          id: 'ORD_FUND_1',
          status: 'PAYER_ACTION_REQUIRED',
          links: [
            { href: 'https://sandbox.paypal.com/checkoutnow?token=ORD_FUND_1', rel: 'payer-action' },
          ],
        })
      })
    )

    const res = await startFunding({
      contractId: contract.id,
      user: { sub: buyer.id, role: 'buyer', email: buyer.email, is_agent: false },
    })

    expect(res.paypal_order_id).toBe('ORD_FUND_1')
    expect(res.approval_url).toBe('https://sandbox.paypal.com/checkoutnow?token=ORD_FUND_1')

    const [updated] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updated?.status).toBe('FUNDING')
    expect(updated?.paypal_order_id).toBe('ORD_FUND_1')
  })

  it('second fund call returns same order (no duplicate createOrder)', async () => {
    if (!dbActive) return
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('ACCEPTED', buyer.id, seller.id)

    let orderCreations = 0
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/checkout/orders`, () => {
        orderCreations++
        return HttpResponse.json({
          id: 'ORD_REUSE',
          status: 'PAYER_ACTION_REQUIRED',
          links: [
            { href: 'https://sandbox.paypal.com/checkoutnow?token=ORD_REUSE', rel: 'payer-action' },
          ],
        })
      }),
      http.get(`${SANDBOX_BASE_URL}/v2/checkout/orders/ORD_REUSE`, () => {
        return HttpResponse.json({
          id: 'ORD_REUSE',
          status: 'PAYER_ACTION_REQUIRED',
          links: [
            { href: 'https://sandbox.paypal.com/checkoutnow?token=ORD_REUSE', rel: 'payer-action' },
          ],
          purchase_units: [],
        })
      })
    )

    const buyerUser = { sub: buyer.id, role: 'buyer' as const, email: buyer.email, is_agent: false }
    const first = await startFunding({ contractId: contract.id, user: buyerUser })
    expect(first.paypal_order_id).toBe('ORD_REUSE')
    expect(orderCreations).toBe(1)

    // Second call: should reuse existing order (E-12)
    const second = await startFunding({ contractId: contract.id, user: buyerUser })
    expect(second.paypal_order_id).toBe('ORD_REUSE')
    expect(second.approval_url).toBe(first.approval_url)
    expect(orderCreations).toBe(1)
  })

  it('return handler authorizes and sets hold fields and milestone due dates', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('ACCEPTED', buyer.id, seller.id)

    // Add milestone
    await db.insert(milestones).values({
      contract_id: contract.id,
      milestone_key: 'm1',
      idx: 1,
      title: 'Milestone 1',
      amount_minor: 6000,
      due_in_days: 7,
      status: 'PENDING',
      deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
    })

    // Set contract to FUNDING
    await db
      .update(contracts)
      .set({ status: 'FUNDING', paypal_order_id: 'ORD_AUTH_OK' })
      .where(eq(contracts.id, contract.id))

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/checkout/orders/ORD_AUTH_OK/authorize`, () => {
        return HttpResponse.json({
          id: 'ORD_AUTH_OK',
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                authorizations: [
                  {
                    id: 'AUTH_TEST_100',
                    status: 'CREATED',
                    amount: { currency_code: 'USD', value: '100.00' },
                    create_time: '2026-11-04T12:00:00Z',
                    expiration_time: '2026-12-03T12:00:00Z',
                  },
                ],
              },
            },
          ],
        })
      })
    )

    const buyerUser = { sub: buyer.id, role: 'buyer' as const, email: buyer.email, is_agent: false }
    const result = await handlePayPalReturn({
      token: 'ORD_AUTH_OK',
      contractId: contract.id,
      user: buyerUser,
    })

    expect(result.success).toBe(true)
    expect(result.status).toBe('FUNDED')

    const [updatedContract] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updatedContract?.status).toBe('FUNDED')
    expect(updatedContract?.authorization_id).toBe('AUTH_TEST_100')
    expect(updatedContract?.auth_created_at).toBeTruthy()
    expect(updatedContract?.honor_until).toBeTruthy()
    expect(updatedContract?.auth_expires_at).toBeTruthy()
    expect(updatedContract?.funded_at).toBeTruthy()

    const [updatedM] = await db.select().from(milestones).where(eq(milestones.contract_id, contract.id))
    expect(updatedM?.due_at).toBeTruthy()
  })

  it('return with wrong token is rejected 400', async () => {
    if (!dbActive) return
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('ACCEPTED', buyer.id, seller.id)

    const db = getDb()
    await db
      .update(contracts)
      .set({ status: 'FUNDING', paypal_order_id: 'CORRECT_TOKEN' })
      .where(eq(contracts.id, contract.id))

    const buyerUser = { sub: buyer.id, role: 'buyer' as const, email: buyer.email, is_agent: false }

    await expect(
      handlePayPalReturn({
        token: 'WRONG_TOKEN',
        contractId: contract.id,
        user: buyerUser,
      })
    ).rejects.toThrow(AppError)
  })

  it('second return is idempotent', async () => {
    if (!dbActive) return
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const db = getDb()
    await db
      .update(contracts)
      .set({ paypal_order_id: 'ALREADY_DONE' })
      .where(eq(contracts.id, contract.id))

    const buyerUser = { sub: buyer.id, role: 'buyer' as const, email: buyer.email, is_agent: false }
    const res = await handlePayPalReturn({
      token: 'ALREADY_DONE',
      contractId: contract.id,
      user: buyerUser,
    })

    expect(res.success).toBe(true)
    expect(res.status).toBe('FUNDED')
  })

  it('cancel returns contract to ACCEPTED', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('ACCEPTED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ status: 'FUNDING', paypal_order_id: 'ORD_CANCEL_ME' })
      .where(eq(contracts.id, contract.id))

    const buyerUser = { sub: buyer.id, role: 'buyer' as const, email: buyer.email, is_agent: false }
    const res = await handlePayPalCancel({
      contractId: contract.id,
      user: buyerUser,
    })

    expect(res.success).toBe(true)
    expect(res.status).toBe('ACCEPTED')

    const [updated] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updated?.status).toBe('ACCEPTED')
    expect(updated?.paypal_order_id).toBeNull()
  })

  it('fund rejected when contract not ACCEPTED', async () => {
    if (!dbActive) return
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('DRAFT', buyer.id, seller.id)

    const buyerUser = { sub: buyer.id, role: 'buyer' as const, email: buyer.email, is_agent: false }
    await expect(
      startFunding({ contractId: contract.id, user: buyerUser })
    ).rejects.toThrow(ConflictError)
  })

  it('fund rejected for seller', async () => {
    if (!dbActive) return
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('ACCEPTED', buyer.id, seller.id)

    const sellerUser = { sub: seller.id, role: 'seller' as const, email: seller.email, is_agent: false }
    await expect(
      startFunding({ contractId: contract.id, user: sellerUser })
    ).rejects.toThrow(ForbiddenError)
  })

  it('PayPal 5xx on authorize leaves contract FUNDING and is reconcilable', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('ACCEPTED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ status: 'FUNDING', paypal_order_id: 'ORD_500' })
      .where(eq(contracts.id, contract.id))

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/checkout/orders/ORD_500/authorize`, () => {
        return new HttpResponse(JSON.stringify({ error: 'Server Error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      })
    )

    const buyerUser = { sub: buyer.id, role: 'buyer' as const, email: buyer.email, is_agent: false }

    await expect(
      handlePayPalReturn({ token: 'ORD_500', contractId: contract.id, user: buyerUser })
    ).rejects.toThrow()

    // Contract remains in FUNDING for reconciliation
    const [persisted] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(persisted?.status).toBe('FUNDING')
  })
})
