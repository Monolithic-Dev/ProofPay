/**
 * VERIFY_SUBMISSION job handler.
 * Claims a submission, runs the 4-stage pipeline, updates milestone state.
 */
import { eq, and, sql } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { milestones, verifications, contracts } from '@/server/db/schema'
import { runVerificationPipeline } from '@/server/verify/pipeline'
import { appendLedgerEvent } from '@/server/ledger/append'
import { assertMilestoneTransition } from '@/server/contracts/transitions'
import { enqueueJob } from '@/server/jobs/queue'
import { addHours } from '@/server/util/time'
import { logger } from '@/server/util/logger'
import type { Db } from '@/server/db/client'

interface VerifySubmissionPayload {
  contract_id: string
  milestone_key: string
  submission_id: string
  verification_id: string
}

export async function handleVerifySubmission(payload: VerifySubmissionPayload): Promise<void> {
  const { contract_id, milestone_key, submission_id, verification_id } = payload
  const db = getDb()
  const log = logger.child({ contract_id, milestone_key, verification_id })

  // Move milestone SUBMITTED → VERIFYING
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${contract_id}::text, 0)::bigint)`
    )
    const [m] = await tx
      .select({ status: milestones.status, id: milestones.id })
      .from(milestones)
      .where(
        and(
          eq(milestones.contract_id, contract_id),
          eq(milestones.milestone_key, milestone_key)
        )
      )

    if (!m) return
    if (m.status !== 'SUBMITTED') {
      log.warn({ status: m.status }, 'Milestone not in SUBMITTED, skipping')
      return
    }

    await tx.update(milestones).set({ status: 'VERIFYING' }).where(eq(milestones.id, m.id))
  })

  // Run the pipeline (outside transaction — can be long-running)
  await runVerificationPipeline({ submissionId: submission_id, contractId: contract_id, milestoneKey: milestone_key, verificationId: verification_id })

  // Read verification result
  const [verification] = await db
    .select()
    .from(verifications)
    .where(eq(verifications.id, verification_id))

  if (!verification || verification.status !== 'COMPLETE') {
    throw new Error(`Verification ${verification_id} did not complete`)
  }

  const decision = verification.decision!

  // Apply result: VERIFYING → PASSED/REJECTED/ESCALATED
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${contract_id}::text, 0)::bigint)`
    )

    const [m] = await tx
      .select()
      .from(milestones)
      .where(and(eq(milestones.contract_id, contract_id), eq(milestones.milestone_key, milestone_key)))
      .for('update')

    if (!m) return

    const [contract] = await tx.select({ policy: contracts.contract_json }).from(contracts).where(eq(contracts.id, contract_id))
    const policy = (contract?.policy as Record<string, unknown> | undefined) ?? {}
    const autoReleaseHours = (policy['auto_release_hours'] as number | undefined) ?? 48

    let newStatus: 'PASSED' | 'REJECTED' | 'ESCALATED' | 'FAILED_FINAL'
    let revisions = m.revisions_used

    if (decision === 'PASS') {
      newStatus = 'PASSED'
    } else if (decision === 'ESCALATE') {
      newStatus = 'ESCALATED'
    } else {
      // REJECT
      revisions = (m.revisions_used ?? 0) + 1
      newStatus = revisions > m.max_revisions ? 'FAILED_FINAL' : 'REJECTED'
    }

    const escalatedAt = newStatus === 'ESCALATED' ? new Date() : null
    const autoReleaseAt = newStatus === 'ESCALATED' ? addHours(new Date(), autoReleaseHours) : null

    await tx.update(milestones).set({
      status: newStatus,
      revisions_used: revisions,
      escalated_at: escalatedAt,
      auto_release_at: autoReleaseAt,
    }).where(eq(milestones.id, m.id))

    const eventType =
      newStatus === 'PASSED' ? 'MILESTONE_PASSED'
      : newStatus === 'ESCALATED' ? 'MILESTONE_ESCALATED'
      : newStatus === 'FAILED_FINAL' ? 'CONTRACT_FAILED'
      : 'MILESTONE_REJECTED'

    await appendLedgerEvent(tx as unknown as Db, {
      contractId: contract_id,
      type: eventType,
      actorType: 'system',
      payload: { milestone_key, revisions_used: revisions },
    })

    if (verification.manipulation_severity === 'high' || verification.manipulation_severity === 'low') {
      await appendLedgerEvent(tx as unknown as Db, {
        contractId: contract_id,
        type: 'INJECTION_FLAGGED',
        actorType: 'verifier',
        payload: {
          milestone_key,
          severity: verification.manipulation_severity,
          spans: ((verification.stage3_json as Record<string, unknown> | null)?.['spans'] as string[] | undefined) ?? [],
        },
      })
    }

    // Enqueue next step
    if (newStatus === 'PASSED') {
      await enqueueJob(tx as unknown as Db, 'RELEASE_MILESTONE', { contract_id, milestone_key }, {
        dedupeKey: `release:${m.id}:${revisions}`,
      })
    } else if (newStatus === 'FAILED_FINAL') {
      await enqueueJob(tx as unknown as Db, 'VOID_REMAINING', { contract_id, reason: 'milestone_failed_final' }, {
        dedupeKey: `void:${contract_id}`,
      })
    }
  })

  log.info({ decision, milestone_key }, 'Verification job complete')
}
