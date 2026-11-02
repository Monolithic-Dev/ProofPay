/**
 * Retry milestone release API route — POST /api/v1/contracts/[id]/milestones/[mid]/retry-release
 * Implements phase-5-paypal-funding-and-release.md §5.6 & api-spec.md §6.
 */
import { NextResponse } from 'next/server'
import { apiHandler } from '@/server/http/handler'
import { getDb, withTx, lockContract, type Tx } from '@/server/db/client'
import { contracts, milestones } from '@/server/db/schema'
import { eq, and } from 'drizzle-orm'
import { enqueueJob } from '@/server/jobs/queue'
import { forbidAgent } from '@/server/auth/guards'
import { ConflictError, ForbiddenError, NotFoundError } from '@/server/util/errors'

export const POST = apiHandler(
  {
    auth: 'user',
  },
  async ({ user, params }) => {
    // Human buyer only
    forbidAgent(user!)

    const contractId = params['id']!
    const milestoneKeyOrId = params['mid']!
    const db = getDb()

    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))

    if (!contract) throw new NotFoundError(`Contract ${contractId} not found`)

    if (user!.sub !== contract.buyer_id && user!.role !== 'admin') {
      throw new ForbiddenError('Only the buyer can retry a release')
    }

    // Find milestone
    const [milestone] = await db
      .select()
      .from(milestones)
      .where(
        and(
          eq(milestones.contract_id, contractId),
          milestoneKeyOrId.startsWith('m')
            ? eq(milestones.milestone_key, milestoneKeyOrId)
            : eq(milestones.id, milestoneKeyOrId)
        )
      )

    if (!milestone) {
      throw new NotFoundError(`Milestone ${milestoneKeyOrId} not found`)
    }

    if (milestone.status !== 'RELEASE_FAILED') {
      throw new ConflictError(
        `Milestone is in status '${milestone.status}'. Only RELEASE_FAILED milestones can be retried.`
      )
    }

    const nextAttempt = milestone.release_attempts + 1

    await withTx(async (tx: Tx) => {
      await lockContract(tx, contractId)

      // Clear chaos mock code so retry can succeed
      await tx
        .update(contracts)
        .set({ chaos_mock_code: null })
        .where(eq(contracts.id, contractId))

      // Enqueue RELEASE_MILESTONE job with dedupeKey
      await enqueueJob(
        tx,
        'RELEASE_MILESTONE',
        {
          contract_id: contractId,
          milestone_id: milestone.id,
          milestone_key: milestone.milestone_key,
        },
        {
          dedupeKey: `release:${milestone.id}:${nextAttempt}`,
        }
      )
    })

    return NextResponse.json(
      {
        success: true,
        message: `Milestone release attempt ${nextAttempt} enqueued`,
        milestone_id: milestone.id,
        attempt: nextAttempt,
      },
      { status: 200 }
    )
  }
)
