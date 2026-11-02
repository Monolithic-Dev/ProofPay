/**
 * VERIFY_SUBMISSION Job Handler.
 * Implements phase-4-verification-engine.md §4.8.
 *
 * Runs the 4-stage pipeline, updates verification, applies policy decision,
 * and handles retry exhaustion with forced escalation.
 */
import { eq, and } from 'drizzle-orm'
import { getDb, withTx, lockContract } from '@/server/db/client'
import { milestones, verifications, submissions } from '@/server/db/schema'
import { runVerificationPipeline } from '@/server/verify/pipeline'
import { applyDecision } from '@/server/verify/apply-decision'
import { assertMilestoneTransition } from '@/server/contracts/transitions'
import { logger } from '@/server/util/logger'
import { AppError } from '@/server/util/errors'

export interface VerifySubmissionPayload {
  contract_id: string
  milestone_id: string
  submission_id: string
  attempt?: number
  verification_id?: string
}

export async function handleVerifySubmission(payload: VerifySubmissionPayload): Promise<void> {
  const { contract_id, milestone_id, submission_id } = payload
  const db = getDb()
  const log = logger.child({
    contract_id,
    milestone_id,
    submission_id,
  })

  // ---------------------------------------------------------------------------
  // 1. Move milestone SUBMITTED → VERIFYING inside tx
  // ---------------------------------------------------------------------------
  let verificationId = payload.verification_id

  await withTx(async (tx) => {
    await lockContract(tx, contract_id)

    const [milestone] = await tx
      .select()
      .from(milestones)
      .where(eq(milestones.id, milestone_id))

    if (!milestone) return

    if (milestone.status === 'SUBMITTED') {
      assertMilestoneTransition('SUBMITTED', 'VERIFYING')
      await tx
        .update(milestones)
        .set({ status: 'VERIFYING' })
        .where(eq(milestones.id, milestone_id))
    }

    if (!verificationId) {
      const [existingVer] = await tx
        .select({ id: verifications.id })
        .from(verifications)
        .where(eq(verifications.submission_id, submission_id))

      if (existingVer) {
        verificationId = existingVer.id
      } else {
        const [newVer] = await tx
          .insert(verifications)
          .values({
            submission_id,
            status: 'RUNNING',
          })
          .returning()
        verificationId = newVer?.id
      }
    }
  })

  if (!verificationId) {
    throw new AppError('INTERNAL_ERROR', `Failed to find or create verification for ${submission_id}`, 500)
  }

  // ---------------------------------------------------------------------------
  // 2. Run the 4-stage pipeline (outside transaction to avoid holding locks)
  // ---------------------------------------------------------------------------
  try {
    await runVerificationPipeline({
      verificationId,
      submissionId: submission_id,
      contractId: contract_id,
      milestoneId: milestone_id,
    })
  } catch (err) {
    log.error({ err: String(err) }, 'Verification pipeline failed in job handler')
    // Re-throw so job queue retry logic handles it
    throw err
  }

  // ---------------------------------------------------------------------------
  // 3. Load completed verification
  // ---------------------------------------------------------------------------
  const [verification] = await db
    .select()
    .from(verifications)
    .where(eq(verifications.id, verificationId))

  if (!verification || verification.status !== 'COMPLETE') {
    throw new AppError(
      'INTERNAL_ERROR',
      `Verification ${verificationId} did not complete successfully`,
      500
    )
  }

  const decision = verification.decision
  if (!decision) {
    throw new AppError(
      'INTERNAL_ERROR',
      `Verification ${verificationId} produced null decision`,
      500
    )
  }

  // ---------------------------------------------------------------------------
  // 4. Apply decision atomically
  // ---------------------------------------------------------------------------
  await applyDecision({
    contractId: contract_id,
    milestoneId: milestone_id,
    verificationId,
    decision,
    reasons: (verification.reasons as any) || [],
    manipulationSeverity: (verification.manipulation_severity as any) || 'none',
  })

  log.info({ decision, verification_id: verificationId }, 'handleVerifySubmission finished')
}
