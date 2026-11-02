/**
 * Buyer Escalation Decision Service.
 * Implements phase-4-verification-engine.md §4.9 & api-spec.md §3.
 *
 * Forbids autonomous agents from resolving human escalations.
 * Enforces buyer ownership, milestone ESCALATED state,
 * records BUYER_DECISION on the ledger, and enqueues release or increments revisions.
 */
import { eq, and } from 'drizzle-orm'
import { getDb, withTx, lockContract } from '@/server/db/client'
import { contracts, milestones } from '@/server/db/schema'
import { assertMilestoneTransition } from '@/server/contracts/transitions'
import { appendLedgerEvent } from '@/server/ledger/append'
import { enqueueJob } from '@/server/jobs/queue'
import { AppError } from '@/server/util/errors'
import type { SessionUser } from '@/server/auth/guards'
import type { MilestoneStatus } from '@/shared/types'

export interface DecideEscalationParams {
  contractId: string
  milestoneKey: string
  user: SessionUser
  decision: 'APPROVE' | 'REJECT'
  note?: string
}

export interface DecideEscalationResult {
  milestone_key: string
  status: MilestoneStatus
  decision: 'APPROVE' | 'REJECT'
}

export async function decideEscalation(
  params: DecideEscalationParams
): Promise<DecideEscalationResult> {
  const { contractId, milestoneKey, user, decision, note } = params
  const db = getDb()

  // ---------------------------------------------------------------------------
  // 1. Forbid AI agents from deciding human escalations
  // ---------------------------------------------------------------------------
  if (user.is_agent) {
    throw new AppError(
      'FORBIDDEN',
      'Autonomous AI agents are not permitted to resolve human buyer escalations',
      403
    )
  }

  const userId = user.sub

  // ---------------------------------------------------------------------------
  // 2. Load contract and verify buyer authorization
  // ---------------------------------------------------------------------------
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))

  if (!contract) {
    throw new AppError('NOT_FOUND', `Contract ${contractId} not found`, 404)
  }

  if (contract.buyer_id !== userId) {
    throw new AppError('FORBIDDEN', 'Only the buyer party can resolve escalations', 403)
  }

  // ---------------------------------------------------------------------------
  // 3. Transaction with contract lock
  // ---------------------------------------------------------------------------
  return withTx(async (tx) => {
    await lockContract(tx, contractId)

    const [milestone] = await tx
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

    if (milestone.status !== 'ESCALATED') {
      throw new AppError(
        'INVALID_STATE',
        `Milestone ${milestoneKey} is not in ESCALATED state (current: ${milestone.status})`,
        409,
        { milestone_status: milestone.status }
      )
    }

    if (decision === 'APPROVE') {
      // ESCALATED → PASSED
      assertMilestoneTransition('ESCALATED', 'PASSED')

      await tx
        .update(milestones)
        .set({ status: 'PASSED' })
        .where(eq(milestones.id, milestone.id))

      await appendLedgerEvent(tx, {
        contractId,
        type: 'BUYER_DECISION',
        actorType: 'buyer',
        actorId: userId,
        payload: {
          milestone_id: milestone.id,
          milestone_key: milestone.milestone_key,
          decision: 'APPROVE',
          note: note ?? null,
        },
      })

      // Enqueue release job
      await enqueueJob(
        tx,
        'RELEASE_MILESTONE',
        {
          contract_id: contractId,
          milestone_id: milestone.id,
        },
        {
          dedupeKey: `release:${milestone.id}`,
        }
      )

      return {
        milestone_key: milestone.milestone_key,
        status: 'PASSED',
        decision: 'APPROVE',
      }
    }

    if (decision === 'REJECT') {
      const newRevisionsUsed = milestone.revisions_used + 1

      if (newRevisionsUsed > milestone.max_revisions) {
        // Revisions exhausted: ESCALATED → REJECTED → FAILED_FINAL
        assertMilestoneTransition('ESCALATED', 'REJECTED')
        assertMilestoneTransition('REJECTED', 'FAILED_FINAL')

        await tx
          .update(milestones)
          .set({
            status: 'FAILED_FINAL',
            revisions_used: newRevisionsUsed,
          })
          .where(eq(milestones.id, milestone.id))

        await appendLedgerEvent(tx, {
          contractId,
          type: 'BUYER_DECISION',
          actorType: 'buyer',
          actorId: userId,
          payload: {
            milestone_id: milestone.id,
            milestone_key: milestone.milestone_key,
            decision: 'REJECT',
            final_failure: true,
            revisions_used: newRevisionsUsed,
            note: note ?? null,
          },
        })

        return {
          milestone_key: milestone.milestone_key,
          status: 'FAILED_FINAL',
          decision: 'REJECT',
        }
      }

      // Revisions remaining: ESCALATED → REJECTED
      assertMilestoneTransition('ESCALATED', 'REJECTED')

      await tx
        .update(milestones)
        .set({
          status: 'REJECTED',
          revisions_used: newRevisionsUsed,
        })
        .where(eq(milestones.id, milestone.id))

      await appendLedgerEvent(tx, {
        contractId,
        type: 'BUYER_DECISION',
        actorType: 'buyer',
        actorId: userId,
        payload: {
          milestone_id: milestone.id,
          milestone_key: milestone.milestone_key,
          decision: 'REJECT',
          final_failure: false,
          revisions_used: newRevisionsUsed,
          note: note ?? null,
        },
      })

      return {
        milestone_key: milestone.milestone_key,
        status: 'REJECTED',
        decision: 'REJECT',
      }
    }

    throw new AppError('BAD_REQUEST', `Invalid decision: ${decision}`, 400)
  })
}
