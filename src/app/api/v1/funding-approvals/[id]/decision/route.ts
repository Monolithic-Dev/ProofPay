import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { funding_approvals, org_members } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { eq, and } from 'drizzle-orm'
import { toErrorResponse, httpStatusFor, UnauthorizedError, NotFoundError, ForbiddenError, ValidationError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().max(500).optional(),
})

export async function POST(
  req: NextRequest,
  context: any = {}
) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) throw new UnauthorizedError('UNAUTHENTICATED')

    const params = await context.params
    const approvalId = params.id
    const db = getDb()

    const [approval] = await db
      .select()
      .from(funding_approvals)
      .where(eq(funding_approvals.id, approvalId))
      .limit(1)

    if (!approval) throw new NotFoundError('Funding approval request not found')

    // Four-eyes rule: approver cannot be the same person who requested the approval
    if (approval.requested_by === user.sub && user.role !== 'admin') {
      throw new ForbiddenError('Four-eyes policy: Approver cannot approve their own funding request')
    }

    // Role check: must be owner, admin, or finance in the organization
    if (user.role !== 'admin' && user.org_role !== 'owner' && user.org_role !== 'admin' && user.org_role !== 'finance') {
      throw new ForbiddenError('Only Organization Owner, Admin, or Finance can decide funding approvals')
    }

    const body = await req.json().catch(() => ({}))
    const parsed = decisionSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message)
    }

    const [updated] = await db
      .update(funding_approvals)
      .set({
        status: parsed.data.decision,
        decided_by: user.sub,
        decision_note: parsed.data.note,
        decided_at: new Date(),
      })
      .where(eq(funding_approvals.id, approvalId))
      .returning()

    return NextResponse.json({ approval: updated }, { status: 200, headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
