/**
 * Milestone View Route — GET /api/v1/contracts/[id]/milestones/[mid]
 * Implements phase-4-verification-engine.md §4.9 & api-spec.md §3.
 * Security: strangers get 404 (IDOR prevention).
 */
import { NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { contracts, milestones, submissions, verifications } from '@/server/db/schema'
import { apiHandler } from '@/server/http/handler'
import { toMilestoneView, toVerificationView } from '@/server/verify/view'
import { NotFoundError } from '@/server/util/errors'

export const GET = apiHandler(
  { auth: 'user' },
  async ({ user, params }) => {
    const contractId = params['id']!
    const milestoneKey = params['mid']!
    const db = getDb()
    const userId = user!.sub

    // 1. Verify contract and authorization (strangers get 404)
    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))

    if (!contract) {
      throw new NotFoundError('Contract')
    }

    if (
      contract.buyer_id !== userId &&
      contract.seller_id !== userId &&
      user!.role !== 'admin'
    ) {
      throw new NotFoundError('Contract')
    }

    // 2. Query milestone
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
      throw new NotFoundError('Milestone')
    }

    // 3. Query all submissions for this milestone
    const subRows = await db
      .select()
      .from(submissions)
      .where(eq(submissions.milestone_id, milestone.id))
      .orderBy(desc(submissions.attempt))

    // 4. Query latest verification if submissions exist
    let latestVerificationView = null
    const latestSub = subRows[0]
    if (latestSub) {
      const [ver] = await db
        .select()
        .from(verifications)
        .where(eq(verifications.submission_id, latestSub.id))

      if (ver) {
        latestVerificationView = toVerificationView(ver, milestone.milestone_key)
      }
    }

    const milestoneView = toMilestoneView(milestone, latestVerificationView)

    return NextResponse.json(
      {
        milestone: milestoneView,
        submissions: subRows.map((s) => ({
          id: s.id,
          attempt: s.attempt,
          content_type: s.content_type,
          size_bytes: s.size_bytes,
          sha256: s.sha256,
          note: s.note,
          created_at: s.created_at ? new Date(s.created_at).toISOString() : '',
        })),
      },
      { status: 200 }
    )
  }
)
