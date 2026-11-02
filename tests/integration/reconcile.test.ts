/**
 * Reconciliation, Reauthorization, and Housekeeping Integration Tests (§5.8).
 * Tests reconcileContract, handleReauthCheck, handleExpireContract, and scheduleSweeps.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { resetDb, makeUser, makeContractFixture, checkDbActive } from './helpers/db'
import { contracts, milestones, ledger_events, jobs } from '@/server/db/schema'
import { SANDBOX_BASE_URL, resetTokenCacheForTests } from '@/server/paypal/client'
import { reconcileContract } from '@/server/release/reconcile'
import { handleReauthCheck } from '@/server/jobs/handlers/reauth-check'
import { handleExpireContract } from '@/server/jobs/handlers/expire-contract'
import { scheduleSweeps } from '@/worker/schedulers'
import { setNowForTests } from '@/server/util/time'

const defaultHandlers = [
  http.post(`${SANDBOX_BASE_URL}/v1/oauth2/token`, () => {
    return HttpResponse.json({
      access_token: 'mock_test_access_token_123',
      expires_in: 3600,
    })
  }),
]

const server = setupServer(...defaultHandlers)

describe('Reconciliation & Housekeeping Integration (§5.8)', () => {
  let dbActive = false

  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
  beforeEach(async () => {
    dbActive = await checkDbActive()
    if (dbActive) {
      await resetDb()
    }
    server.resetHandlers(...defaultHandlers)
    resetTokenCacheForTests()
    setNowForTests(null)
  })
  afterEach(() => {
    server.resetHandlers(...defaultHandlers)
    resetTokenCacheForTests()
    setNowForTests(null)
  })
  afterAll(() => server.close())

  it('finalizes RELEASING when order shows COMPLETED capture', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const shortId = contract.id.slice(0, 8)
    const orderId = 'ORD-RECON-1'
    await db
      .update(contracts)
      .set({ paypal_order_id: orderId })
      .where(eq(contracts.id, contract.id))

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

    server.use(
      http.get(`${SANDBOX_BASE_URL}/v2/checkout/orders/${orderId}`, () => {
        return HttpResponse.json({
          id: orderId,
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'CAP-RECON-OK',
                    status: 'COMPLETED',
                    invoice_id: `PP-${shortId}-m1`,
                    amount: { currency_code: 'USD', value: '60.00' },
                  },
                ],
              },
            },
          ],
        })
      })
    )

    const result = await reconcileContract(contract.id)
    expect(result.reconciled).toBe(true)

    const [updatedM] = await db.select().from(milestones).where(eq(milestones.id, m1!.id))
    expect(updatedM?.status).toBe('RELEASED')
    expect(updatedM?.capture_id).toBe('CAP-RECON-OK')

    const [updatedC] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updatedC?.status).toBe('COMPLETED')

    const ledger = await db
      .select()
      .from(ledger_events)
      .where(
        and(
          eq(ledger_events.contract_id, contract.id),
          eq(ledger_events.type, 'CAPTURE_COMPLETED')
        )
      )
    expect(ledger).toHaveLength(1)
  })

  it('marks RELEASE_FAILED when capture DECLINED', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const shortId = contract.id.slice(0, 8)
    const orderId = 'ORD-RECON-DECLINED'
    await db
      .update(contracts)
      .set({ paypal_order_id: orderId })
      .where(eq(contracts.id, contract.id))

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

    server.use(
      http.get(`${SANDBOX_BASE_URL}/v2/checkout/orders/${orderId}`, () => {
        return HttpResponse.json({
          id: orderId,
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'CAP-DECLINED',
                    status: 'DECLINED',
                    invoice_id: `PP-${shortId}-m1`,
                    amount: { currency_code: 'USD', value: '60.00' },
                  },
                ],
              },
            },
          ],
        })
      })
    )

    const result = await reconcileContract(contract.id)
    expect(result.reconciled).toBe(true)

    const [updatedM] = await db.select().from(milestones).where(eq(milestones.id, m1!.id))
    expect(updatedM?.status).toBe('RELEASE_FAILED')

    const ledger = await db
      .select()
      .from(ledger_events)
      .where(
        and(
          eq(ledger_events.contract_id, contract.id),
          eq(ledger_events.type, 'CAPTURE_FAILED')
        )
      )
    expect(ledger).toHaveLength(1)
  })

  it('keeps RELEASING while PENDING', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const shortId = contract.id.slice(0, 8)
    const orderId = 'ORD-RECON-PENDING'
    await db
      .update(contracts)
      .set({ paypal_order_id: orderId })
      .where(eq(contracts.id, contract.id))

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

    server.use(
      http.get(`${SANDBOX_BASE_URL}/v2/checkout/orders/${orderId}`, () => {
        return HttpResponse.json({
          id: orderId,
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'CAP-PENDING',
                    status: 'PENDING',
                    invoice_id: `PP-${shortId}-m1`,
                    amount: { currency_code: 'USD', value: '60.00' },
                  },
                ],
              },
            },
          ],
        })
      })
    )

    await reconcileContract(contract.id)

    const [updatedM] = await db.select().from(milestones).where(eq(milestones.id, m1!.id))
    expect(updatedM?.status).toBe('RELEASING')
  })

  it('authorizes order when FUNDING but approved', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDING', buyer.id, seller.id)

    const orderId = 'ORD-APPROVED-STUCK'
    await db
      .update(contracts)
      .set({ paypal_order_id: orderId })
      .where(eq(contracts.id, contract.id))

    server.use(
      http.get(`${SANDBOX_BASE_URL}/v2/checkout/orders/${orderId}`, () => {
        return HttpResponse.json({
          id: orderId,
          status: 'APPROVED',
        })
      }),
      http.post(`${SANDBOX_BASE_URL}/v2/checkout/orders/${orderId}/authorize`, () => {
        return HttpResponse.json({
          id: orderId,
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                authorizations: [
                  {
                    id: 'AUTH-RECON-APPROVED',
                    status: 'CREATED',
                    create_time: new Date().toISOString(),
                  },
                ],
              },
            },
          ],
        })
      })
    )

    const result = await reconcileContract(contract.id)
    expect(result.reconciled).toBe(true)

    const [updatedC] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updatedC?.status).toBe('FUNDED')
    expect(updatedC?.authorization_id).toBe('AUTH-RECON-APPROVED')
  })

  it('reverts stale FUNDING to ACCEPTED', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDING', buyer.id, seller.id)

    const orderId = 'ORD-ABANDONED-CREATED'
    await db
      .update(contracts)
      .set({ paypal_order_id: orderId })
      .where(eq(contracts.id, contract.id))

    server.use(
      http.get(`${SANDBOX_BASE_URL}/v2/checkout/orders/${orderId}`, () => {
        return HttpResponse.json({
          id: orderId,
          status: 'CREATED',
        })
      })
    )

    const result = await reconcileContract(contract.id)
    expect(result.reconciled).toBe(true)

    const [updatedC] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updatedC?.status).toBe('ACCEPTED')
    expect(updatedC?.paypal_order_id).toBeNull()

    const ledger = await db
      .select()
      .from(ledger_events)
      .where(
        and(
          eq(ledger_events.contract_id, contract.id),
          eq(ledger_events.type, 'FUNDING_CANCELLED')
        )
      )
    expect(ledger).toHaveLength(1)
  })

  it('reauth runs only after honor_until', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const baseTime = new Date('2026-11-01T12:00:00Z')
    const honorUntil = new Date('2026-11-04T12:00:00Z') // +3 days
    const authExpires = new Date('2026-11-30T12:00:00Z') // +29 days

    await db
      .update(contracts)
      .set({
        authorization_id: 'AUTH-TEST-REAUTH',
        honor_until: honorUntil,
        auth_expires_at: authExpires,
      })
      .where(eq(contracts.id, contract.id))

    let reauthCalled = false
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH-TEST-REAUTH/reauthorize`, () => {
        reauthCalled = true
        return HttpResponse.json({
          id: 'AUTH-NEW-REAUTHORIZED',
          status: 'CREATED',
        })
      })
    )

    // 1. Clock is before honor_until
    setNowForTests(new Date('2026-11-02T12:00:00Z'))
    await handleReauthCheck()
    expect(reauthCalled).toBe(false)

    // 2. Clock is at/after honor_until
    setNowForTests(new Date('2026-11-05T12:00:00Z'))
    await handleReauthCheck()
    expect(reauthCalled).toBe(true)
  })

  it('reauth success updates authorization_id and honor_until and writes REAUTHORIZED', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const honorUntil = new Date('2026-11-04T12:00:00Z')
    const authExpires = new Date('2026-11-30T12:00:00Z')

    await db
      .update(contracts)
      .set({
        authorization_id: 'AUTH-REAUTH-SUCCESS',
        honor_until: honorUntil,
        auth_expires_at: authExpires,
      })
      .where(eq(contracts.id, contract.id))

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH-REAUTH-SUCCESS/reauthorize`, () => {
        return HttpResponse.json({
          id: 'AUTH-NEW-EXTENDED',
          status: 'CREATED',
        })
      })
    )

    setNowForTests(new Date('2026-11-05T12:00:00Z'))
    await handleReauthCheck()

    const [updatedC] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updatedC?.authorization_id).toBe('AUTH-NEW-EXTENDED')
    expect(updatedC?.honor_until?.getTime()).toBeGreaterThan(honorUntil.getTime())

    const ledger = await db
      .select()
      .from(ledger_events)
      .where(
        and(
          eq(ledger_events.contract_id, contract.id),
          eq(ledger_events.type, 'REAUTHORIZED')
        )
      )
    expect(ledger).toHaveLength(1)
    expect(ledger[0]?.payload).toMatchObject({
      old_authorization_id: 'AUTH-REAUTH-SUCCESS',
      new_authorization_id: 'AUTH-NEW-EXTENDED',
    })
  })

  it('reauth failure sets funding_at_risk', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const honorUntil = new Date('2026-11-04T12:00:00Z')
    const authExpires = new Date('2026-11-30T12:00:00Z')

    await db
      .update(contracts)
      .set({
        authorization_id: 'AUTH-REAUTH-FAIL',
        honor_until: honorUntil,
        auth_expires_at: authExpires,
        funding_at_risk: false,
      })
      .where(eq(contracts.id, contract.id))

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH-REAUTH-FAIL/reauthorize`, () => {
        return HttpResponse.json(
          { name: 'UNPROCESSABLE_ENTITY', message: 'Reauthorization declined' },
          { status: 422 }
        )
      })
    )

    setNowForTests(new Date('2026-11-05T12:00:00Z'))
    await handleReauthCheck()

    const [updatedC] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updatedC?.funding_at_risk).toBe(true)
  })

  it('expiry voids and marks EXPIRED', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const pastExpiry = new Date('2026-10-01T12:00:00Z')
    await db
      .update(contracts)
      .set({
        authorization_id: 'AUTH-TO-EXPIRE',
        auth_expires_at: pastExpiry,
      })
      .where(eq(contracts.id, contract.id))

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH-TO-EXPIRE/void`, () => {
        return new HttpResponse(null, { status: 204 })
      })
    )

    await handleExpireContract({ contract_id: contract.id })

    const [updatedC] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updatedC?.status).toBe('EXPIRED')

    const ledger = await db
      .select()
      .from(ledger_events)
      .where(
        and(
          eq(ledger_events.contract_id, contract.id),
          eq(ledger_events.type, 'CONTRACT_EXPIRED')
        )
      )
    expect(ledger).toHaveLength(1)
  })

  it('sweeps enqueue with dedupe keys (second tick adds nothing)', async () => {
    if (!dbActive) return
    const db = getDb()
    const fixedTime = new Date('2026-11-02T15:23:45Z')

    // First sweep
    const keys1 = await scheduleSweeps(fixedTime)
    expect(keys1.reconcileKey).toContain('reconcile-sweep:')
    expect(keys1.reauthKey).toContain('reauth-sweep:')
    expect(keys1.expireKey).toContain('expire-sweep:')

    const jobsAfterFirst = await db.select().from(jobs)
    const initialCount = jobsAfterFirst.length
    expect(initialCount).toBe(3)

    // Second sweep at the same slot
    const keys2 = await scheduleSweeps(fixedTime)
    expect(keys2.reconcileKey).toBe(keys1.reconcileKey)

    const jobsAfterSecond = await db.select().from(jobs)
    expect(jobsAfterSecond.length).toBe(initialCount)
  })
})
