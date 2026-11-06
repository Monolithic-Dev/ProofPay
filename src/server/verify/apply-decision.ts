/**
 * Apply Verification Decision.
 * Implements phase-4-verification-engine.md §4.8.
 *
 * Atomically transitions milestone status, updates revision counts,
 * writes hash-chained ledger events, and enqueues follow-up outbox jobs.
 */
import { eq } from 'drizzle-orm'
import { withTx, lockContract } from '@/server/db/client'
import { milestones, contracts } from '@/server/db/schema'
import type { MilestoneStatus } from '@/shared/types'
import { createHash } from 'crypto'
import { createSignedDecision } from '@/lib/crypto/attestation'
import { assertMilestoneTransition } from '@/server/contracts/transitions'
import { appendLedgerEvent } from '@/server/ledger/append'
import { enqueueJob } from '@/server/jobs/queue'
import { now } from '@/server/util/time'
import { env } from '@/server/config/env'
import { logger } from '@/server/util/logger'
import { AppError } from '@/server/util/errors'

export interface ApplyDecisionParams {
  contractId: string
  milestoneId: string
  verificationId: string
  decision: 'PASS' | 'REJECT' | 'ESCALATE'
  reasons?: Array<{ code: string; criterion_key?: string; message: string }>
  attemptNumber?: number
  manipulationSeverity?: 'none' | 'low' | 'high'
}

export interface ApplyDecisionResult {
  applied: boolean
  newStatus: MilestoneStatus
}

export async function applyDecision(params: ApplyDecisionParams): Promise<ApplyDecisionResult> {
  const {
    contractId,
    milestoneId,
    verificationId,
    decision,
    reasons = [],
    manipulationSeverity = 'none',
  } = params

  return withTx(async (tx) => {
    // Acquire transaction-level advisory lock to serialize updates on this contract
    await lockContract(tx, contractId)

    const [milestone] = await tx
      .select()
      .from(milestones)
      .where(eq(milestones.id, milestoneId))

    if (!milestone) {
      throw new AppError('NOT_FOUND', `Milestone ${milestoneId} not found`, 404)
    }

    const [contractRow] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))

    if (!contractRow) {
      throw new AppError('NOT_FOUND', `Contract ${contractId} not found`, 404)
    }

    // Idempotency: if milestone is already transitioned out of VERIFYING, no-op
    if (milestone.status !== 'VERIFYING') {
      logger.info(
        {
          milestone_id: milestoneId,
          current_status: milestone.status,
          decision,
        },
        'applyDecision: milestone is not in VERIFYING state, skipping transition (idempotent)'
      )
      return { applied: false, newStatus: milestone.status as MilestoneStatus }
    }

    // Record high manipulation security flag if detected
    if (manipulationSeverity === 'high') {
      await appendLedgerEvent(tx, {
        contractId,
        type: 'INJECTION_FLAGGED',
        actorType: 'verifier',
        payload: {
          milestone_id: milestoneId,
          milestone_key: milestone.milestone_key,
          verification_id: verificationId,
          severity: 'high',
        },
      })
    }

    // Generate Ed25519 decision attestation (Finding P1 / Next Level Strategy F1)
    const attestation = createSignedDecision({
      contract_id: contractId,
      milestone_key: milestone.milestone_key,
      decision,
      criteria_hash: createHash('sha256')
        .update(`${contractId}:${milestone.milestone_key}:${verificationId}`)
        .digest('hex'),
      timestamp_iso: new Date().toISOString(),
      authority_id: 'proofpay-ed25519-authority-v1',
    })

    // -------------------------------------------------------------------------
    // PASS: Transition to PASSED & enqueue RELEASE_MILESTONE
    // -------------------------------------------------------------------------
    if (decision === 'PASS') {
      assertMilestoneTransition('VERIFYING', 'PASSED')

      await tx
        .update(milestones)
        .set({ status: 'PASSED' })
        .where(eq(milestones.id, milestoneId))

      await appendLedgerEvent(tx, {
        contractId,
        type: 'MILESTONE_PASSED',
        actorType: 'system',
        payload: {
          milestone_id: milestoneId,
          milestone_key: milestone.milestone_key,
          verification_id: verificationId,
          attestation,
        },
      })

      await enqueueJob(
        tx,
        'RELEASE_MILESTONE',
        {
          contract_id: contractId,
          milestone_id: milestoneId,
          verification_id: verificationId,
        },
        {
          dedupeKey: `release:${milestoneId}`,
        }
      )

      return { applied: true, newStatus: 'PASSED' }
    }

    // -------------------------------------------------------------------------
    // REJECT: Increment revisions_used, check max_revisions
    // -------------------------------------------------------------------------
    if (decision === 'REJECT') {
      const newRevisionsUsed = milestone.revisions_used + 1

      if (newRevisionsUsed > milestone.max_revisions) {
        // Revisions exhausted: VERIFYING → REJECTED → FAILED_FINAL
        assertMilestoneTransition('VERIFYING', 'REJECTED')
        assertMilestoneTransition('REJECTED', 'FAILED_FINAL')

        await tx
          .update(milestones)
          .set({
            status: 'FAILED_FINAL',
            revisions_used: newRevisionsUsed,
          })
          .where(eq(milestones.id, milestoneId))

        await appendLedgerEvent(tx, {
          contractId,
          type: 'MILESTONE_FAILED_FINAL',
          actorType: 'system',
          payload: {
            milestone_id: milestoneId,
            milestone_key: milestone.milestone_key,
            verification_id: verificationId,
            reasons,
            revisions_used: newRevisionsUsed,
            max_revisions: milestone.max_revisions,
            attestation,
          },
        })

        // Enqueue VOID_REMAINING per phase-5-paypal-funding-and-release.md §5.6
        await enqueueJob(
          tx,
          'VOID_REMAINING',
          {
            contract_id: contractId,
            reason: 'final_failure',
          },
          {
            dedupeKey: `void:${contractId}`,
          }
        )

        return { applied: true, newStatus: 'FAILED_FINAL' }
      }

      // Revisions remaining: VERIFYING → REJECTED
      assertMilestoneTransition('VERIFYING', 'REJECTED')

      await tx
        .update(milestones)
        .set({
          status: 'REJECTED',
          revisions_used: newRevisionsUsed,
        })
        .where(eq(milestones.id, milestoneId))

      await appendLedgerEvent(tx, {
        contractId,
        type: 'MILESTONE_REJECTED',
        actorType: 'system',
        payload: {
          milestone_id: milestoneId,
          milestone_key: milestone.milestone_key,
          verification_id: verificationId,
          reasons,
          revisions_used: newRevisionsUsed,
          max_revisions: milestone.max_revisions,
          attestation,
        },
      })

      return { applied: true, newStatus: 'REJECTED' }
    }

    // -------------------------------------------------------------------------
    // ESCALATE: Set auto_release_at using review window and DEMO_TIME_SCALE
    // -------------------------------------------------------------------------
    if (decision === 'ESCALATE') {
      assertMilestoneTransition('VERIFYING', 'ESCALATED')

      const contractJson = contractRow.contract_json as {
        policy?: { buyer_review_window_hours?: number }
      } | null
      const reviewHours = contractJson?.policy?.buyer_review_window_hours ?? 72
      const timeScale = env.DEMO_TIME_SCALE > 0 ? env.DEMO_TIME_SCALE : 1
      const windowMs = Math.max(1000, Math.floor((reviewHours * 3600 * 1000) / timeScale))
      const autoReleaseAt = new Date(Date.now() + windowMs)

      await tx
        .update(milestones)
        .set({
          status: 'ESCALATED',
          escalated_at: now(),
          auto_release_at: autoReleaseAt,
        })
        .where(eq(milestones.id, milestoneId))

      await appendLedgerEvent(tx, {
        contractId,
        type: 'SUBMISSION_ESCALATED',
        actorType: 'system',
        payload: {
          milestone_id: milestoneId,
          milestone_key: milestone.milestone_key,
          verification_id: verificationId,
          reasons,
          auto_release_at: autoReleaseAt.toISOString(),
          attestation,
        },
      })

      await enqueueJob(
        tx,
        'AUTO_RELEASE',
        {
          contract_id: contractId,
          milestone_id: milestoneId,
          verification_id: verificationId,
        },
        {
          runAt: autoReleaseAt,
          dedupeKey: `auto_release:${milestoneId}`,
        }
      )

      return { applied: true, newStatus: 'ESCALATED' }
    }

    throw new AppError('BAD_REQUEST', `Unknown verification decision: ${decision}`, 400)
  })
}
