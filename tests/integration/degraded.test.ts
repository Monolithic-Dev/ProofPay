/**
 * Integration Test: Degraded-Mode & Resilience Drills
 * Implements phase-8-testing-and-hardening.md §8.5 & ai-pipeline.md §7.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { setLlmTransport } from '@/server/ai/fake-llm'
import { compileContract } from '@/server/contracts/compile'
import { POST as compileRouteHandler } from '@/app/api/v1/contracts/compile/route'
import { runRubricStage } from '@/server/verify/rubric'
import { decide, type PolicyInput } from '@/server/verify/policy'
import { BudgetExceededError, AppError } from '@/server/util/errors'
import { env } from '@/server/config/env'
import { signSession } from '@/server/auth/session'
import { getDb, withTx } from '@/server/db/client'
import { contracts, users, jobs } from '@/server/db/schema'
import { enqueueJob, claimNextJob, completeJob } from '@/server/jobs/queue'
import { eq } from 'drizzle-orm'

describe('Degraded-Mode & Resilience Drills (§8.5)', () => {
  let sessionToken: string
  let testUserId: string

  beforeEach(async () => {
    // Find or seed a test buyer user
    const db = getDb()
    let [buyer] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'buyer'))
      .limit(1)

    if (!buyer) {
      testUserId = '11111111-2222-3333-4444-555555555555'
    } else {
      testUserId = buyer.id
    }

    sessionToken = await signSession({
      sub: testUserId,
      email: 'buyer@proofpay.test',
      role: 'buyer',
      is_agent: false,
    })
  })

  afterEach(() => {
    // Reset LLM transport
    setLlmTransport(null)
  })

  describe('Drill 1: Budget Exhaustion Handling', () => {
    it('compile route returns 429 when daily LLM budget is exhausted', async () => {
      // Mock LLM transport to throw BudgetExceededError
      setLlmTransport(async () => {
        throw new BudgetExceededError()
      })

      const req = new NextRequest('http://localhost:3000/api/v1/contracts/compile', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `pp_session=${sessionToken}`,
        },
        body: JSON.stringify({
          prompt: 'Create a dataset cleaning contract with 2 milestones',
        }),
      })

      const res = await compileRouteHandler(req)
      expect(res.status).toBe(429)
      const data = await res.json()
      expect(data.error.code).toBe('BUDGET_EXCEEDED')
      expect(data.error.message).toContain('budget exceeded')
    })

    it('verification policy escalates with VERIFIER_UNAVAILABLE when budget is exhausted', () => {
      const policyInput: PolicyInput = {
        stage1: [
          {
            criterion_key: 'c1_det',
            required: true,
            passed: true,
            status: 'pass',
          },
        ],
        stage2: null,
        stage3: { severity: 'none' },
        criteria: [
          { key: 'c1_det', type: 'deterministic', required: true },
          { key: 'c2_rubric', type: 'rubric', required: true },
        ],
        degraded: true, // Verifier flagged unavailable / budget exhausted
        confidenceMin: 0.6,
      }

      const decision = decide(policyInput)
      expect(decision.decision).toBe('ESCALATE')
      expect(decision.reasons.some((r) => r.code === 'VERIFIER_UNAVAILABLE')).toBe(true)
    })
  })

  describe('Drill 2: LLM Transport 500 Outage & Deterministic Reject Priority', () => {
    it('deterministic reject takes absolute priority even when LLM transport throws 500', async () => {
      // Mock LLM transport to simulate upstream Anthropic 500
      setLlmTransport(async () => {
        throw new Error('500 Internal Server Error: anthropic provider outage')
      })

      // Run rubric stage -> should gracefully return unavailable: true
      const rubricOut = await runRubricStage({
        contractId: 'mock-contract-1',
        criteria: [
          {
            key: 'semantic_accuracy',
            statement: 'Summaries must be factually consistent',
          },
        ],
        artifact: {
          text: 'Some test submission deliverable text',
        },
      })

      expect(rubricOut.unavailable).toBe(true)
      expect(rubricOut.results).toEqual([])

      // Feed into policy where Stage 1 (deterministic) has a failure
      const policyInput: PolicyInput = {
        stage1: [
          {
            criterion_key: 'det_row_count',
            check_name: 'min_row_count',
            required: true,
            passed: false,
            status: 'fail',
            reason: 'Dataset contained only 5 rows, minimum 10 required',
          },
        ],
        stage2: null,
        stage3: { severity: 'none' },
        criteria: [
          { key: 'det_row_count', type: 'deterministic', required: true },
          { key: 'semantic_accuracy', type: 'rubric', required: true },
        ],
        degraded: rubricOut.unavailable,
        confidenceMin: 0.6,
      }

      const decision = decide(policyInput)
      // INVARIANT: Deterministic failure MUST immediately REJECT, never falsely escalate or pass
      expect(decision.decision).toBe('REJECT')
      expect(decision.reasons[0]?.code).toBe('DET_FAIL')
      expect(decision.reasons[0]?.message).toContain('Dataset contained only 5 rows')
    })
  })

  describe('Drill 3: LLM Malformed JSON Output Recovery', () => {
    it('handles unparsable / invalid LLM outputs by marking stage unavailable', async () => {
      // Mock transport returning invalid data that fails schema
      setLlmTransport(async () => {
        return {
          usage: { promptTokens: 100, completionTokens: 50, costMicroUsd: 1000 },
          content: 'Not a JSON object at all. Just arbitrary text from model.',
        } as any
      })

      const rubricOut = await runRubricStage({
        contractId: 'mock-contract-2',
        criteria: [{ key: 'q1', statement: 'Check clarity' }],
        artifact: { text: 'deliverable content' },
      })

      // Must not crash, but safely report unavailable
      expect(rubricOut.unavailable).toBe(true)
    })
  })

  describe('Drill 4: Database Transaction Rollback & Reconnection Resilience', () => {
    it('aborted transaction rolls back cleanly without leaving orphan records', async () => {
      const db = getDb()
      const dummyId = '00000000-0000-4000-8000-000000000099'

      // Attempt transaction that inserts then intentionally throws
      await expect(
        withTx(async (tx) => {
          await tx.insert(contracts).values({
            id: dummyId,
            buyer_id: testUserId,
            title: 'Orphan Attempt Contract',
            status: 'DRAFT',
            contract_json: {},
            version: 1,
            currency: 'USD',
            total_minor: 5000,
          })

          // Intentionally abort transaction
          throw new Error('SIMULATED_DB_DISRUPTION_MID_TX')
        })
      ).rejects.toThrow('SIMULATED_DB_DISRUPTION_MID_TX')

      // Assert that dummyId does NOT exist in the database
      const [found] = await db
        .select({ id: contracts.id })
        .from(contracts)
        .where(eq(contracts.id, dummyId))

      expect(found).toBeUndefined()

      // Subsequent query works normally (connection pool is healthy)
      const healthyCheck = await db.select({ count: contracts.id }).from(contracts).limit(1)
      expect(healthyCheck).toBeDefined()
    })
  })

  describe('Drill 5: Job Outbox Worker Restart & Resumption', () => {
    it('resumes and processes pending jobs from outbox after simulated worker downtime', async () => {
      const db = getDb()

      // Enqueue job while worker is "offline"
      const testJobType = 'RECONCILE_PAYPAL'
      const testPayload = { contract_id: 'test-contract-resumption-123' }
      const dedupeKey = `drill-resumption-${Date.now()}`
      await enqueueJob(db, testJobType, testPayload, { dedupeKey })

      // Verify it was persisted in PENDING state
      const [enqueued] = await db.select().from(jobs).where(eq(jobs.dedupe_key, dedupeKey))
      expect(enqueued).toBeDefined()
      expect(enqueued?.status).toBe('PENDING')
      expect(enqueued?.type).toBe(testJobType)

      // Worker "restarts" and claims pending jobs
      const claimed = await claimNextJob()
      expect(claimed).not.toBeNull()
      expect(claimed?.status).toBe('RUNNING')
      if (claimed) {
        await completeJob(claimed.id)
      }
    })
  })
})
