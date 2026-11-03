import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { org_members, org_invitations, users, organizations } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { toErrorResponse, httpStatusFor, ValidationError, UnauthorizedError, ForbiddenError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'
import crypto from 'node:crypto'

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'finance', 'member', 'viewer']).default('member'),
})

export async function GET(
  req: NextRequest,
  context: any = {}
) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) throw new UnauthorizedError('UNAUTHENTICATED')

    const params = await context.params
    const orgId = params.id
    const db = getDb()

    // Verify caller membership
    const [membership] = await db
      .select()
      .from(org_members)
      .where(and(eq(org_members.org_id, orgId), eq(org_members.user_id, user.sub)))
      .limit(1)

    if (!membership) {
      throw new ForbiddenError('Not a member of this organization')
    }

    // List members
    const membersList = await db
      .select({
        id: org_members.id,
        user_id: org_members.user_id,
        role: org_members.role,
        joined_at: org_members.created_at,
        email: users.email,
        display_name: users.display_name,
      })
      .from(org_members)
      .innerJoin(users, eq(org_members.user_id, users.id))
      .where(eq(org_members.org_id, orgId))
      .orderBy(desc(org_members.created_at))

    // List pending invitations
    const pendingInvites = await db
      .select({
        id: org_invitations.id,
        email: org_invitations.email,
        role: org_invitations.role,
        expires_at: org_invitations.expires_at,
        created_at: org_invitations.created_at,
      })
      .from(org_invitations)
      .where(and(eq(org_invitations.org_id, orgId), eq(org_invitations.accepted_at, null as any)))
      .orderBy(desc(org_invitations.created_at))

    return NextResponse.json({
      members: membersList,
      pending_invitations: pendingInvites,
      total_members: membersList.length,
    }, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}

export async function POST(
  req: NextRequest,
  context: any = {}
) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) throw new UnauthorizedError('UNAUTHENTICATED')

    const params = await context.params
    const orgId = params.id
    const db = getDb()

    // Verify caller membership & permission
    const [membership] = await db
      .select()
      .from(org_members)
      .where(and(eq(org_members.org_id, orgId), eq(org_members.user_id, user.sub)))
      .limit(1)

    if (!membership) {
      throw new ForbiddenError('Not a member of this organization')
    }

    const authCheck = can(
      { id: user.sub, email: user.email, orgRole: membership.role as any, orgId },
      'member:invite'
    )
    if (!authCheck.ok) {
      throw new ForbiddenError(authCheck.reason || 'Insufficient permissions to invite members')
    }

    const body = await req.json().catch(() => ({}))
    const parsed = inviteMemberSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(`Invalid invitation payload: ${parsed.error.message}`)
    }

    const { email, role } = parsed.data

    // Check if user is already a member
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser) {
      const [alreadyMember] = await db
        .select()
        .from(org_members)
        .where(and(eq(org_members.org_id, orgId), eq(org_members.user_id, existingUser.id)))
        .limit(1)

      if (alreadyMember) {
        throw new ValidationError('User is already a member of this organization')
      }
    }

    // Generate invitation token
    const token = crypto.randomBytes(24).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const [invite] = await db
      .insert(org_invitations)
      .values({
        org_id: orgId,
        email,
        role,
        token_hash: tokenHash,
        invited_by_id: user.sub,
        expires_at: expiresAt,
      })
      .returning()

    if (!invite) {
      throw new Error('Failed to create invitation')
    }

    return NextResponse.json({
      invitation: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expires_at: invite.expires_at,
        token, // Provided once for invite link generation
      },
    }, { status: 201, headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
