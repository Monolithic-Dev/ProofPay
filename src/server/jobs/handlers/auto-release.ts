/**
 * AUTO_RELEASE Job Handler.
 * Implements phase-4-verification-engine.md §4.8.
 *
 * Automatically releases milestone hold when a buyer remains silent during the review window.
 */
import { eq } from 'drizzle-orm'
import { withTx, lockContract } from '@/server/db/client'
import { milestones } from '@/server/db/schema'
import { assertMilestoneTransition } from '@/server/contracts/transitions'
import { appendLedgerEvent } from '@/server/ledger/append'
import { enqueueJob } from '@/server/jobs/queue'
import { logger } from '@/server/util/logger'
import { AppError } from '@/server/util/errors'

export interface AutoReleasePayload {
  contract_id: string
  milestone_id: string
  verification_id?: string
}

export async function handleAutoRelease(payload: AutoReleasePayload): Promise<void> {
  const { contract_id, milestone_id, verification_id } = payload
  const log = logger.child({ contract_id, milestone_id, verification_id })

  await withTx(async (tx) => {
    await lockContract(tx, contract_id)

    const [milestone] = await tx
      .select()
      .from(milestones)
      .where(eq(milestones.id, milestone_id))

    if (!milestone) {
      throw new AppError('NOT_FOUND', `Milestone ${milestone_id} not found`, 404)
    }

    // If milestone is no longer in ESCALATED state, buyer resolved it: safe no-op
    if (milestone.status !== 'ESCALATED') {
      log.info(
        { status: milestone.status },
        'handleAutoRelease: milestone is no longer ESCALATED; skipping'
      )
      return
    }

    // Verify deadline has passed
    if (milestone.auto_release_at && new Date() < new Date(milestone.auto_release_at)) {
      log.warn(
        { auto_release_at: milestone.auto_release_at },
        'handleAutoRelease: triggered before auto_release_at deadline; skipping'
      )
      return
    }

    // Transition ESCALATED → PASSED
    assertMilestoneTransition('ESCALATED', 'PASSED')

    await tx
      .update(milestones)
      .set({ status: 'PASSED' })
      .where(eq(milestones.id, milestone_id))

    await appendLedgerEvent(tx, {
      contractId: contract_id,
      type: 'AUTO_RELEASE_TRIGGERED',
      actorType: 'system',
      payload: {
        milestone_id,
        milestone_key: milestone.milestone_key,
        verification_id: verification_id ?? null,
        deadline: milestone.auto_release_at ? new Date(milestone.auto_release_at).toISOString() : null,
      },
    })

    // Enqueue release milestone job
    await enqueueJob(
      tx,
      'RELEASE_MILESTONE',
      {
        contract_id,
        milestone_id,
        verification_id,
      },
      {
        dedupeKey: `release:${milestone_id}`,
      }
    )

    log.info({ milestone_id }, 'handleAutoRelease: milestone passed and release enqueued')
  })
}
