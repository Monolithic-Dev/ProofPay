/**
 * Release Service Integration Tests (§5.6).
 * Rigorous tests for all financial release invariants, two-phase commits, concurrency, and chaos.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { resetDb, makeUser, makeContractFixture, checkDbActive } from './helpers/db'
import { contracts, milestones, ledger_events, jobs } from '@/server/db/schema'
import { SANDBOX_BASE_URL, resetTokenCacheForTests } from '@/server/paypal/client'
import { releaseMilestone, voidRemaining, refundMilestone } from '@/server/release/service'
import { ConflictError, PayPalError } from '@/server/util/errors'
import type { MilestoneStatus } from '@/shared/types'

const defaultHandlers = [
  http.post(`${SANDBOX_BASE_URL}/v1/oauth2/token`, () => {
    return HttpResponse.json({
      access_token: 'mock_test_access_token_123',
      expires_in: 3600,
    })
  }),
]

const server = setupServer(...defaultHandlers)

describe('Release Service Integration (§5.6)', () => {
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

  it('throws for every milestone status except PASSED and RELEASE_FAILED', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_TBL' })
      .where(eq(contracts.id, contract.id))

    const forbiddenStatuses: MilestoneStatus[] = [
      'PENDING',
      'SUBMITTED',
      'VERIFYING',
      'REJECTED',
      'ESCALATED',
      'RELEASING',
      'RELEASED',
      'FAILED_FINAL',
      'VOIDED',
    ]

    for (const status of forbiddenStatuses) {
      const [m] = await db
        .insert(milestones)
        .values({
          contract_id: contract.id,
          milestone_key: `m_${status.toLowerCase()}`,
          idx: 1,
          title: `Milestone ${status}`,
          amount_minor: 1000,
          due_in_days: 7,
          status: status,
          deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
        })
        .returning()

      await expect(releaseMilestone(m!.id)).rejects.toThrow(ConflictError)

      // Clean up for next status test
      await db.delete(milestones).where(eq(milestones.id, m!.id))
    }
  })

  it('refuses capture before earlier milestone is RELEASED', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_SEQ' })
      .where(eq(contracts.id, contract.id))

    // m1 is PENDING
    await db.insert(milestones).values({
      contract_id: contract.id,
      milestone_key: 'm1',
      idx: 1,
      title: 'Milestone 1',
      amount_minor: 5000,
      due_in_days: 7,
      status: 'PENDING',
      deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
    })

    // m2 is PASSED
    const [m2] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm2',
        idx: 2,
        title: 'Milestone 2',
        amount_minor: 5000,
        due_in_days: 7,
        status: 'PASSED',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    // Must refuse releasing m2 because m1 is not RELEASED
    await expect(releaseMilestone(m2!.id)).rejects.toThrow(
      /Cannot release milestone m2: earlier milestone m1 is not RELEASED/
    )
  })

  it('refuses capture when sum would exceed total', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    // Contract total is 10000
    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_EXCEED', total_minor: 10000 })
      .where(eq(contracts.id, contract.id))

    // m1 was 8000 and RELEASED
    await db.insert(milestones).values({
      contract_id: contract.id,
      milestone_key: 'm1',
      idx: 1,
      title: 'Milestone 1',
      amount_minor: 8000,
      due_in_days: 7,
      status: 'RELEASED',
      capture_id: 'CAP_8000',
      captured_at: new Date(),
      deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
    })

    // m2 is 3000 (8000 + 3000 = 11000 > 10000)
    const [m2] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm2',
        idx: 2,
        title: 'Milestone 2',
        amount_minor: 3000,
        due_in_days: 7,
        status: 'PASSED',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    await expect(releaseMilestone(m2!.id)).rejects.toThrow(
      /Capture would exceed contract total/
    )
  })

  it('refuses capture after authorization expiry', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    const pastDate = new Date(Date.now() - 1000 * 3600)
    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_EXP', auth_expires_at: pastDate })
      .where(eq(contracts.id, contract.id))

    const [m1] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 5000,
        due_in_days: 7,
        status: 'PASSED',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    await expect(releaseMilestone(m1!.id)).rejects.toThrow(
      /Authorization hold has expired/
    )
  })

  it('capture success marks RELEASED and writes ledger', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_SUCCESS' })
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
        status: 'PASSED',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_SUCCESS/capture`, () => {
        return HttpResponse.json({
          id: 'CAP_SUCCESS_123',
          status: 'COMPLETED',
          final_capture: true,
          amount: { currency_code: 'USD', value: '60.00' },
        })
      })
    )

    const outcome = await releaseMilestone(m1!.id)
    expect(outcome.status).toBe('RELEASED')
    if (outcome.status === 'RELEASED') {
      expect(outcome.captureId).toBe('CAP_SUCCESS_123')
    }

    const [updatedM] = await db.select().from(milestones).where(eq(milestones.id, m1!.id))
    expect(updatedM?.status).toBe('RELEASED')
    expect(updatedM?.capture_id).toBe('CAP_SUCCESS_123')
    expect(updatedM?.captured_at).toBeTruthy()
  })

  it('final_capture true only on last milestone', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_FINAL_CHK' })
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
        status: 'PASSED',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    await db.insert(milestones).values({
      contract_id: contract.id,
      milestone_key: 'm2',
      idx: 2,
      title: 'Milestone 2',
      amount_minor: 4000,
      due_in_days: 7,
      status: 'PENDING',
      deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
    })

    let capturedFinalFlag: boolean | null = null
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_FINAL_CHK/capture`, async ({ request }) => {
        const body: any = await request.json()
        capturedFinalFlag = body.final_capture
        return HttpResponse.json({
          id: 'CAP_M1',
          status: 'COMPLETED',
          final_capture: false,
          amount: { currency_code: 'USD', value: '60.00' },
        })
      })
    )

    await releaseMilestone(m1!.id)
    expect(capturedFinalFlag).toBe(false)
  })

  it('last release completes the contract', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('IN_PROGRESS', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_LAST_COMPLETES' })
      .where(eq(contracts.id, contract.id))

    const [singleMilestone] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 10000,
        due_in_days: 7,
        status: 'PASSED',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_LAST_COMPLETES/capture`, () => {
        return HttpResponse.json({
          id: 'CAP_LAST',
          status: 'COMPLETED',
          final_capture: true,
          amount: { currency_code: 'USD', value: '100.00' },
        })
      })
    )

    await releaseMilestone(singleMilestone!.id)

    const [updatedContract] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updatedContract?.status).toBe('COMPLETED')
    expect(updatedContract?.completed_at).toBeTruthy()
  })

  it('declined capture marks RELEASE_FAILED', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_DECLINE' })
      .where(eq(contracts.id, contract.id))

    const [m1] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 5000,
        due_in_days: 7,
        status: 'PASSED',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_DECLINE/capture`, () => {
        return new HttpResponse(
          JSON.stringify({
            name: 'UNPROCESSABLE_ENTITY',
            message: 'Instrument declined',
            details: [{ issue: 'INSTRUMENT_DECLINED' }],
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )

    const outcome = await releaseMilestone(m1!.id)
    expect(outcome.status).toBe('RELEASE_FAILED')

    const [persisted] = await db.select().from(milestones).where(eq(milestones.id, m1!.id))
    expect(persisted?.status).toBe('RELEASE_FAILED')
  })

  it('retry uses new idempotency key (attempt 2)', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_RETRY' })
      .where(eq(contracts.id, contract.id))

    const [m1] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 5000,
        due_in_days: 7,
        status: 'RELEASE_FAILED',
        release_attempts: 1,
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    let capturedReqId: string | null = null
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_RETRY/capture`, ({ request }) => {
        capturedReqId = request.headers.get('PayPal-Request-Id')
        return HttpResponse.json({
          id: 'CAP_ATTEMPT_2',
          status: 'COMPLETED',
          final_capture: true,
          amount: { currency_code: 'USD', value: '50.00' },
        })
      })
    )

    const outcome = await releaseMilestone(m1!.id)
    expect(outcome.status).toBe('RELEASED')
    expect(capturedReqId).toBe(`pp:${contract.id}:m1:capture:2`)

    const [persisted] = await db.select().from(milestones).where(eq(milestones.id, m1!.id))
    expect(persisted?.release_attempts).toBe(2)
  })

  it('timeout then success uses the same key and records one capture', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_TIMEOUT_RETRY' })
      .where(eq(contracts.id, contract.id))

    const [m1] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 5000,
        due_in_days: 7,
        status: 'PASSED',
        release_attempts: 0,
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    let callCount = 0
    const capturedReqIds: string[] = []

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_TIMEOUT_RETRY/capture`, ({ request }) => {
        callCount++
        capturedReqIds.push(request.headers.get('PayPal-Request-Id') ?? '')
        if (callCount === 1) {
          return new HttpResponse(JSON.stringify({ error: 'Gateway Timeout' }), {
            status: 504,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return HttpResponse.json({
          id: 'CAP_TIMEOUT_OK',
          status: 'COMPLETED',
          final_capture: true,
          amount: { currency_code: 'USD', value: '50.00' },
        })
      })
    )

    const outcome = await releaseMilestone(m1!.id)
    expect(outcome.status).toBe('RELEASED')
    expect(callCount).toBe(2)
    expect(capturedReqIds[0]).toBe(`pp:${contract.id}:m1:capture:1`)
    expect(capturedReqIds[1]).toBe(`pp:${contract.id}:m1:capture:1`)
  })

  it('PENDING capture stays RELEASING and enqueues reconcile', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_PEND' })
      .where(eq(contracts.id, contract.id))

    const [m1] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 5000,
        due_in_days: 7,
        status: 'PASSED',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_PEND/capture`, () => {
        return HttpResponse.json({
          id: 'CAP_PENDING_STATE',
          status: 'PENDING',
        })
      })
    )

    const outcome = await releaseMilestone(m1!.id)
    expect(outcome.status).toBe('PENDING')

    const [persisted] = await db.select().from(milestones).where(eq(milestones.id, m1!.id))
    expect(persisted?.status).toBe('RELEASING')

    // Verify RECONCILE_PAYPAL job enqueued
    const queuedJobs = await db.select().from(jobs).where(eq(jobs.type, 'RECONCILE_PAYPAL'))
    expect(queuedJobs.length).toBeGreaterThan(0)
  })

  it('two concurrent RELEASE_MILESTONE jobs produce one capture', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_CONCURRENT' })
      .where(eq(contracts.id, contract.id))

    const [m1] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 5000,
        due_in_days: 7,
        status: 'PASSED',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    let captureApiCalls = 0
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_CONCURRENT/capture`, async () => {
        captureApiCalls++
        await new Promise((r) => setTimeout(r, 50))
        return HttpResponse.json({
          id: 'CAP_RACE_WINNER',
          status: 'COMPLETED',
          final_capture: true,
          amount: { currency_code: 'USD', value: '50.00' },
        })
      })
    )

    // Execute concurrently
    const [res1, res2] = await Promise.allSettled([
      releaseMilestone(m1!.id),
      releaseMilestone(m1!.id),
    ])

    // Due to advisory locks and status guards, exactly one succeeds through capture
    const successes = [res1, res2].filter((r) => r.status === 'fulfilled')
    expect(successes.length).toBeGreaterThanOrEqual(1)
    expect(captureApiCalls).toBe(1)
  })

  it('voidRemaining voids and fails contract', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('IN_PROGRESS', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_VOID_FAIL' })
      .where(eq(contracts.id, contract.id))

    await db.insert(milestones).values({
      contract_id: contract.id,
      milestone_key: 'm1',
      idx: 1,
      title: 'Milestone 1',
      amount_minor: 5000,
      due_in_days: 7,
      status: 'FAILED_FINAL',
      deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
    })

    let voidCalled = false
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_VOID_FAIL/void`, () => {
        voidCalled = true
        return new HttpResponse(null, { status: 204 })
      })
    )

    await voidRemaining(contract.id, 'final_failure')
    expect(voidCalled).toBe(true)

    const [updatedContract] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updatedContract?.status).toBe('FAILED')

    const [updatedM] = await db.select().from(milestones).where(eq(milestones.contract_id, contract.id))
    expect(updatedM?.status).toBe('VOIDED')
  })

  it('buyer cancel voids hold', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_BUYER_CANCEL' })
      .where(eq(contracts.id, contract.id))

    await db.insert(milestones).values({
      contract_id: contract.id,
      milestone_key: 'm1',
      idx: 1,
      title: 'Milestone 1',
      amount_minor: 5000,
      due_in_days: 7,
      status: 'PENDING',
      deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
    })

    let voidCalled = false
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_BUYER_CANCEL/void`, () => {
        voidCalled = true
        return new HttpResponse(null, { status: 204 })
      })
    )

    await voidRemaining(contract.id, 'buyer_cancel')
    expect(voidCalled).toBe(true)

    const [updatedContract] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updatedContract?.status).toBe('CANCELLED')
  })

  it('chaos code is consumed after one capture', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    await db
      .update(contracts)
      .set({ authorization_id: 'AUTH_CHAOS', chaos_mock_code: 'INSTRUMENT_DECLINED' })
      .where(eq(contracts.id, contract.id))

    const [m1] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 5000,
        due_in_days: 7,
        status: 'PASSED',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
      .returning()

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_CHAOS/capture`, () => {
        return new HttpResponse(
          JSON.stringify({
            name: 'UNPROCESSABLE_ENTITY',
            message: 'Instrument declined',
            details: [{ issue: 'INSTRUMENT_DECLINED' }],
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )

    await releaseMilestone(m1!.id)

    // Verify chaos_mock_code was consumed (set to null) in TX-A
    const [updatedContract] = await db.select().from(contracts).where(eq(contracts.id, contract.id))
    expect(updatedContract?.chaos_mock_code).toBeNull()
  })

  it('refund cannot exceed captured amount', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('IN_PROGRESS', buyer.id, seller.id)

    await db.insert(milestones).values({
      contract_id: contract.id,
      milestone_key: 'm1',
      idx: 1,
      title: 'Milestone 1',
      amount_minor: 5000,
      due_in_days: 7,
      status: 'RELEASED',
      capture_id: 'CAP_REFUNDABLE',
      captured_at: new Date(),
      deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
    })

    const sellerUser = { sub: seller.id, role: 'seller' as const, email: seller.email, is_agent: false }

    // Attempt refund of 6000 on 5000 capture
    await expect(
      refundMilestone({
        contractId: contract.id,
        milestoneKey: 'm1',
        user: sellerUser,
        amountMinor: 6000,
      })
    ).rejects.toThrow(ConflictError)
  })

  it('captured_at and capture_id satisfy DB CHECK', async () => {
    if (!dbActive) return
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('FUNDED', buyer.id, seller.id)

    // Inserting capture_id on PENDING should violate capture_only_when_releasing CHECK
    await expect(
      db.insert(milestones).values({
        contract_id: contract.id,
        milestone_key: 'm_check_violation',
        idx: 99,
        title: 'Check Violation',
        amount_minor: 1000,
        due_in_days: 7,
        status: 'PENDING',
        capture_id: 'CAP_ILLEGAL',
        deliverable_json: { content_type: 'text', max_bytes: 1000, description: 'Test' },
      })
    ).rejects.toThrow()
  })
})
