/**
 * Submissions Service.
 * Implements phase-4-verification-engine.md §4.9 & api-spec.md §3.
 *
 * Enforces seller ownership, contract state, milestone sequential order,
 * revision limits, artifact sanitization, and enqueues VERIFY_SUBMISSION.
 */
import { eq, and } from 'drizzle-orm'
import { getDb, withTx, lockContract } from '@/server/db/client'
import { contracts, milestones, submissions, verifications } from '@/server/db/schema'
import { parseArtifact } from '@/server/verify/artifact'
import { assertMilestoneTransition, assertContractTransition } from '@/server/contracts/transitions'
import { appendLedgerEvent } from '@/server/ledger/append'
import { enqueueJob } from '@/server/jobs/queue'
import { AppError } from '@/server/util/errors'
import type { SessionUser } from '@/server/auth/guards'

export interface SubmitDeliverableParams {
  contractId: string
  milestoneKey: string
  user: SessionUser
  body: {
    content_type: 'json_records' | 'text'
    content: string | unknown[]
    note?: string
  }
  idempotencyKey?: string
}

export interface SubmitDeliverableResult {
  submission_id: string
  verification_id: string
  attempt: number
  status: 'VERIFYING'
}

export async function submitDeliverable(
  params: SubmitDeliverableParams
): Promise<SubmitDeliverableResult> {
  const { contractId, milestoneKey, user, body } = params
  const db = getDb()

  const userId = user.sub

  // ---------------------------------------------------------------------------
  // 1. Load contract and verify seller authorization
  // ---------------------------------------------------------------------------
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))

  if (!contract) {
    throw new AppError('NOT_FOUND', `Contract ${contractId} not found`, 404)
  }

  if (contract.seller_id !== userId) {
    throw new AppError('FORBIDDEN', 'Only the seller party can submit deliverables', 403)
  }

  // Contract must be funded or in progress
  if (contract.status !== 'FUNDED' && contract.status !== 'IN_PROGRESS') {
    throw new AppError(
      'INVALID_STATE',
      `Deliverables can only be submitted for contracts in FUNDED or IN_PROGRESS state (current: ${contract.status})`,
      409,
      { current_status: contract.status }
    )
  }

  // ---------------------------------------------------------------------------
  // 2. Load milestone and verify status & deliverable type
  // ---------------------------------------------------------------------------
  const [milestone] = await db
    .select()
    .from(milestones)
    .where(
      and(
        eq(milestones.contract_id, contractId),
        eq(milestones.milestone_key, milestoneKey)
      )
    )

  if (!milestone) {
    throw new AppError('NOT_FOUND', `Milestone ${milestoneKey} not found`, 404)
  }

  if (milestone.status !== 'PENDING' && milestone.status !== 'REJECTED') {
    throw new AppError(
      'INVALID_STATE',
      `Milestone ${milestoneKey} is in ${milestone.status} state; cannot accept submissions`,
      409,
      { milestone_status: milestone.status }
    )
  }

  // Sequential rule: if idx > 1, preceding milestone must be RELEASED (or PASSED)
  if (milestone.idx > 1) {
    const [prevMilestone] = await db
      .select({ status: milestones.status })
      .from(milestones)
      .where(
        and(
          eq(milestones.contract_id, contractId),
          eq(milestones.idx, milestone.idx - 1)
        )
      )

    if (
      !prevMilestone ||
      (prevMilestone.status !== 'RELEASED' && prevMilestone.status !== 'PASSED')
    ) {
      throw new AppError(
        'INVALID_STATE',
        `Sequential milestone rule: milestone ${milestone.idx - 1} must be completed/released first`,
        409,
        { prev_status: prevMilestone?.status }
      )
    }
  }

  // Check deliverable content type matches milestone spec
  const deliverableSpec = milestone.deliverable_json as { type?: string } | null
  const expectedType = deliverableSpec?.type
  if (expectedType && expectedType !== body.content_type) {
    throw new AppError(
      'BAD_REQUEST',
      `Deliverable content_type '${body.content_type}' does not match expected '${expectedType}'`,
      400
    )
  }

  // ---------------------------------------------------------------------------
  // 3. Parse and sanitize artifact
  // ---------------------------------------------------------------------------
  const parsed = parseArtifact(body.content_type, body.content)

  // ---------------------------------------------------------------------------
  // 4. Transaction: lock contract, check revisions, insert submission & verification
  // ---------------------------------------------------------------------------
  return withTx(async (tx) => {
    await lockContract(tx, contractId)

    // Re-check existing submissions count for this milestone
    const existingSubs = await tx
      .select({ id: submissions.id })
      .from(submissions)
      .where(eq(submissions.milestone_id, milestone.id))

    const attempt = existingSubs.length + 1
    if (attempt > milestone.max_revisions + 1) {
      throw new AppError(
        'REVISIONS_EXHAUSTED',
        `Revisions exhausted: attempt ${attempt} exceeds maximum allowed (${milestone.max_revisions + 1})`,
        409
      )
    }

    // Insert submission
    const [sub] = await tx
      .insert(submissions)
      .values({
        milestone_id: milestone.id,
        attempt,
        submitted_by: userId,
        content_type: body.content_type,
        content_text: parsed.text,
        size_bytes: parsed.sizeBytes,
        sha256: parsed.sha256,
        note: body.note ?? null,
      })
      .returning()

    if (!sub) {
      throw new AppError('INTERNAL_ERROR', 'Failed to insert submission', 500)
    }

    // Insert verification row in RUNNING state
    const [ver] = await tx
      .insert(verifications)
      .values({
        submission_id: sub.id,
        status: 'RUNNING',
      })
      .returning()

    if (!ver) {
      throw new AppError('INTERNAL_ERROR', 'Failed to insert verification', 500)
    }

    // Transition milestone status to SUBMITTED
    assertMilestoneTransition(milestone.status as any, 'SUBMITTED')
    await tx
      .update(milestones)
      .set({ status: 'SUBMITTED' })
      .where(eq(milestones.id, milestone.id))

    // Transition contract FUNDED → IN_PROGRESS if this is the first submission
    if (contract.status === 'FUNDED') {
      assertContractTransition('FUNDED', 'IN_PROGRESS')
      await tx
        .update(contracts)
        .set({ status: 'IN_PROGRESS' })
        .where(eq(contracts.id, contractId))

      await appendLedgerEvent(tx, {
        contractId,
        type: 'CONTRACT_STATUS_CHANGED',
        actorType: 'system',
        payload: { from: 'FUNDED', to: 'IN_PROGRESS' },
      })
    }

    // Record ledger event
    await appendLedgerEvent(tx, {
      contractId,
      type: 'SUBMISSION_RECEIVED',
      actorType: 'seller',
      actorId: userId,
      payload: {
        milestone_id: milestone.id,
        milestone_key: milestone.milestone_key,
        submission_id: sub.id,
        attempt,
        sha256: parsed.sha256,
        size_bytes: parsed.sizeBytes,
      },
    })

    // Enqueue verification job in transactional outbox
    await enqueueJob(
      tx,
      'VERIFY_SUBMISSION',
      {
        contract_id: contractId,
        milestone_id: milestone.id,
        submission_id: sub.id,
        attempt,
      },
      {
        dedupeKey: `verify:${sub.id}`,
      }
    )

    return {
      submission_id: sub.id,
      verification_id: ver.id,
      attempt,
      status: 'VERIFYING',
    }
  })
}
