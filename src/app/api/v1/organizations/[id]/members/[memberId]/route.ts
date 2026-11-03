import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { org_members } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { toErrorResponse, httpStatusFor, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'finance', 'member', 'viewer']),
})

export async function PATCH(
  req: NextRequest,
  context: any = {}
) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) throw new UnauthorizedError('UNAUTHENTICATED')

    const params = await context.params
    const orgId = params.id
    const memberId = params.memberId
    const db = getDb()

    // Verify caller membership & permission
    const [callerMembership] = await db
      .select()
      .from(org_members)
      .where(and(eq(org_members.org_id, orgId), eq(org_members.user_id, user.sub)))
      .limit(1)

    if (!callerMembership) throw new ForbiddenError('Not a member of this organization')

    const authCheck = can(
      { id: user.sub, email: user.email, orgRole: callerMembership.role as any, orgId },
      'member:update_role'
    )
    if (!authCheck.ok) {
      throw new ForbiddenError(authCheck.reason || 'Insufficient permissions to update roles')
    }

    // Find target member
    const [targetMember] = await db
      .select()
      .from(org_members)
      .where(and(eq(org_members.id, memberId), eq(org_members.org_id, orgId)))
      .limit(1)

    if (!targetMember) throw new NotFoundError('Member not found')

    // Protect last owner
    if (targetMember.role === 'owner') {
      const ownerCount = await db
        .select()
        .from(org_members)
        .where(and(eq(org_members.org_id, orgId), eq(org_members.role, 'owner')))

      if (ownerCount.length <= 1) {
        throw new ValidationError('Cannot demote the only owner of the organization')
      }
    }

    const body = await req.json().catch(() => ({}))
    const parsed = updateRoleSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(`Invalid role: ${parsed.error.message}`)
    }

    const [updated] = await db
      .update(org_members)
      .set({ role: parsed.data.role })
      .where(eq(org_members.id, memberId))
      .returning()

    return NextResponse.json({ member: updated }, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}

export async function DELETE(
  req: NextRequest,
  context: any = {}
) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) throw new UnauthorizedError('UNAUTHENTICATED')

    const params = await context.params
    const orgId = params.id
    const memberId = params.memberId
    const db = getDb()

    // Verify caller membership & permission
    const [callerMembership] = await db
      .select()
      .from(org_members)
      .where(and(eq(org_members.org_id, orgId), eq(org_members.user_id, user.sub)))
      .limit(1)

    if (!callerMembership) throw new ForbiddenError('Not a member of this organization')

    const authCheck = can(
      { id: user.sub, email: user.email, orgRole: callerMembership.role as any, orgId },
      'member:remove'
    )
    if (!authCheck.ok) {
      throw new ForbiddenError(authCheck.reason || 'Insufficient permissions to remove members')
    }

    // Find target member
    const [targetMember] = await db
      .select()
      .from(org_members)
      .where(and(eq(org_members.id, memberId), eq(org_members.org_id, orgId)))
      .limit(1)

    if (!targetMember) throw new NotFoundError('Member not found')

    // Protect last owner
    if (targetMember.role === 'owner') {
      const ownerCount = await db
        .select()
        .from(org_members)
        .where(and(eq(org_members.org_id, orgId), eq(org_members.role, 'owner')))

      if (ownerCount.length <= 1) {
        throw new ValidationError('Cannot remove the only owner of the organization')
      }
    }

    await db.delete(org_members).where(eq(org_members.id, memberId))

    return NextResponse.json({ ok: true, removed_id: memberId }, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
