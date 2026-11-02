/**
 * Verification View Route — GET /api/v1/verifications/[vid]
 * Implements phase-4-verification-engine.md §4.9 & api-spec.md §3.
 * Security: strangers get 404 (IDOR prevention).
 */
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { contracts, milestones, submissions, verifications } from '@/server/db/schema'
import { apiHandler } from '@/server/http/handler'
import { toVerificationView } from '@/server/verify/view'
import { NotFoundError } from '@/server/util/errors'

export const GET = apiHandler(
  { auth: 'user' },
  async ({ user, params }) => {
    const verificationId = params['vid']!
    const db = getDb()
    const userId = user!.sub

    // 1. Load verification
    const [ver] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.id, verificationId))

    if (!ver) {
      throw new NotFoundError('Verification')
    }

    // 2. Load submission
    const [sub] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, ver.submission_id))

    if (!sub) {
      throw new NotFoundError('Submission')
    }

    // 3. Load milestone
    const [milestone] = await db
      .select()
      .from(milestones)
      .where(eq(milestones.id, sub.milestone_id))

    if (!milestone) {
      throw new NotFoundError('Milestone')
    }

    // 4. Load contract and verify authorization (strangers get 404)
    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, milestone.contract_id))

    if (!contract) {
      throw new NotFoundError('Contract')
    }

    if (
      contract.buyer_id !== userId &&
      contract.seller_id !== userId &&
      user!.role !== 'admin'
    ) {
      throw new NotFoundError('Verification')
    }

    const verificationView = toVerificationView(ver, milestone.milestone_key)

    return NextResponse.json(
      { verification: verificationView },
      { status: 200 }
    )
  }
)
