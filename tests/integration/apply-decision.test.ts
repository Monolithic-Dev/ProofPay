/**
 * Integration tests for applyDecision.
 * Implements phase-4-verification-engine.md §4.8 & task 4.8 tests.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { resetDb, makeUser, makeContractFixture } from './helpers/db'
import { milestones, jobs, ledger_events, submissions, verifications } from '@/server/db/schema'
import { applyDecision } from '@/server/verify/apply-decision'
import { verifyLedger } from '@/server/ledger/verify'

describe('applyDecision Integration', () => {
  beforeEach(async () => {
    await resetDb()
  })

  async function setupVerifyingMilestone(maxRevisions = 2, revisionsUsed = 0) {
    const db = getDb()
    const buyer = await makeUser('buyer')
    const seller = await makeUser('seller')
    const contract = await makeContractFixture('IN_PROGRESS', buyer.id, seller.id)

    const [milestone] = await db
      .insert(milestones)
      .values({
        contract_id: contract.id,
        milestone_key: 'm1',
        idx: 1,
        title: 'Milestone 1',
        amount_minor: 5000,
        due_in_days: 7,
        status: 'VERIFYING',
        max_revisions: maxRevisions,
        revisions_used: revisionsUsed,
        deliverable_json: { type: 'text', description: 'Test' },
      })
      .returning()

    const [sub] = await db
      .insert(submissions)
      .values({
        milestone_id: milestone!.id,
        attempt: revisionsUsed + 1,
        submitted_by: seller.id,
        content_type: 'text',
        content_text: 'Test deliverable content',
        size_bytes: 24,
        sha256: 'abc123sha256',
      })
      .returning()

    const [ver] = await db
      .insert(verifications)
      .values({
        submission_id: sub!.id,
        status: 'RUNNING',
      })
      .returning()

    return { contract, milestone: milestone!, submission: sub!, verification: ver! }
  }

  it('PASS enqueues exactly one RELEASE_MILESTONE and marks milestone PASSED', async () => {
    const db = getDb()
    const { contract, milestone, verification } = await setupVerifyingMilestone()

    const res = await applyDecision({
      contractId: contract.id,
      milestoneId: milestone.id,
      verificationId: verification.id,
      decision: 'PASS',
    })

    expect(res.applied).toBe(true)
    expect(res.newStatus).toBe('PASSED')

    const [updatedMilestone] = await db
      .select()
      .from(milestones)
      .where(eq(milestones.id, milestone.id))
    expect(updatedMilestone?.status).toBe('PASSED')

    const enqueuedJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.type, 'RELEASE_MILESTONE'))
    expect(enqueuedJobs.length).toBe(1)
    expect((enqueuedJobs[0]?.payload as any).milestone_id).toBe(milestone.id)

    const events = await db
      .select()
      .from(ledger_events)
      .where(eq(ledger_events.contract_id, contract.id))
    expect(events.some((e) => e.type === 'MILESTONE_PASSED')).toBe(true)
  })

  it('REJECT increments revisions_used and transitions to REJECTED when under max', async () => {
    const db = getDb()
    const { contract, milestone, verification } = await setupVerifyingMilestone(2, 0)

    const res = await applyDecision({
      contractId: contract.id,
      milestoneId: milestone.id,
      verificationId: verification.id,
      decision: 'REJECT',
      reasons: [{ code: 'DET_FAIL', message: 'Row count too low' }],
    })

    expect(res.applied).toBe(true)
    expect(res.newStatus).toBe('REJECTED')

    const [updatedMilestone] = await db
      .select()
      .from(milestones)
      .where(eq(milestones.id, milestone.id))
    expect(updatedMilestone?.status).toBe('REJECTED')
    expect(updatedMilestone?.revisions_used).toBe(1)

    const events = await db
      .select()
      .from(ledger_events)
      .where(eq(ledger_events.contract_id, contract.id))
    expect(events.some((e) => e.type === 'MILESTONE_REJECTED')).toBe(true)
  })

  it('third rejection with max_revisions=2 becomes FAILED_FINAL', async () => {
    const db = getDb()
    // Already used 2 revisions, so 3rd failure (newRevisionsUsed = 3 > 2) triggers FAILED_FINAL
    const { contract, milestone, verification } = await setupVerifyingMilestone(2, 2)

    const res = await applyDecision({
      contractId: contract.id,
      milestoneId: milestone.id,
      verificationId: verification.id,
      decision: 'REJECT',
      reasons: [{ code: 'RUBRIC_FAIL', message: 'Poor quality' }],
    })

    expect(res.applied).toBe(true)
    expect(res.newStatus).toBe('FAILED_FINAL')

    const [updatedMilestone] = await db
      .select()
      .from(milestones)
      .where(eq(milestones.id, milestone.id))
    expect(updatedMilestone?.status).toBe('FAILED_FINAL')
    expect(updatedMilestone?.revisions_used).toBe(3)

    const events = await db
      .select()
      .from(ledger_events)
      .where(eq(ledger_events.contract_id, contract.id))
    expect(events.some((e) => e.type === 'MILESTONE_FAILED_FINAL')).toBe(true)
  })

  it('ESCALATE sets auto_release_at using DEMO_TIME_SCALE and enqueues AUTO_RELEASE', async () => {
    const db = getDb()
    const { contract, milestone, verification } = await setupVerifyingMilestone()

    const before = Date.now()
    const res = await applyDecision({
      contractId: contract.id,
      milestoneId: milestone.id,
      verificationId: verification.id,
      decision: 'ESCALATE',
      reasons: [{ code: 'LOW_CONFIDENCE', message: 'Rubric ambiguous' }],
    })

    expect(res.applied).toBe(true)
    expect(res.newStatus).toBe('ESCALATED')

    const [updatedMilestone] = await db
      .select()
      .from(milestones)
      .where(eq(milestones.id, milestone.id))
    expect(updatedMilestone?.status).toBe('ESCALATED')
    expect(updatedMilestone?.auto_release_at).not.toBeNull()
    expect(new Date(updatedMilestone!.auto_release_at!).getTime()).toBeGreaterThan(before)

    const enqueuedJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.type, 'AUTO_RELEASE'))
    expect(enqueuedJobs.length).toBe(1)
    expect((enqueuedJobs[0]?.payload as any).milestone_id).toBe(milestone.id)
  })

  it('second call is an idempotent no-op', async () => {
    const db = getDb()
    const { contract, milestone, verification } = await setupVerifyingMilestone()

    const res1 = await applyDecision({
      contractId: contract.id,
      milestoneId: milestone.id,
      verificationId: verification.id,
      decision: 'PASS',
    })
    expect(res1.applied).toBe(true)

    // Second call on already PASSED milestone
    const res2 = await applyDecision({
      contractId: contract.id,
      milestoneId: milestone.id,
      verificationId: verification.id,
      decision: 'PASS',
    })
    expect(res2.applied).toBe(false)
    expect(res2.newStatus).toBe('PASSED')

    // Release jobs should still be only 1
    const releaseJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.type, 'RELEASE_MILESTONE'))
    expect(releaseJobs.length).toBe(1)
  })

  it('records INJECTION_FLAGGED when manipulation severity is high', async () => {
    const db = getDb()
    const { contract, milestone, verification } = await setupVerifyingMilestone()

    await applyDecision({
      contractId: contract.id,
      milestoneId: milestone.id,
      verificationId: verification.id,
      decision: 'REJECT',
      manipulationSeverity: 'high',
      reasons: [{ code: 'MANIPULATION_DETECTED', message: 'Injection detected' }],
    })

    const events = await db
      .select()
      .from(ledger_events)
      .where(eq(ledger_events.contract_id, contract.id))
    expect(events.some((e) => e.type === 'INJECTION_FLAGGED')).toBe(true)
  })

  it('maintains valid hash-chained ledger after sequence of events', async () => {
    const { contract, milestone, verification } = await setupVerifyingMilestone()

    await applyDecision({
      contractId: contract.id,
      milestoneId: milestone.id,
      verificationId: verification.id,
      decision: 'PASS',
    })

    const res = await verifyLedger(contract.id)
    expect(res.valid).toBe(true)
  })
})
