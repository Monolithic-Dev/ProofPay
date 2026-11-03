import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { contract_invitations, contracts } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { toErrorResponse, httpStatusFor, ValidationError, UnauthorizedError, NotFoundError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'
import crypto from 'node:crypto'

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['seller', 'buyer']).default('seller'),
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
    const contractId = params.id
    const db = getDb()

    const list = await db
      .select({
        id: contract_invitations.id,
        email: contract_invitations.email,
        role: contract_invitations.role,
        expires_at: contract_invitations.expires_at,
        accepted_at: contract_invitations.accepted_at,
        created_at: contract_invitations.created_at,
      })
      .from(contract_invitations)
      .where(eq(contract_invitations.contract_id, contractId))
      .orderBy(desc(contract_invitations.created_at))

    return NextResponse.json({ invitations: list }, { headers: { 'X-Request-Id': requestId } })
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
    const contractId = params.id
    const db = getDb()

    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1)

    if (!contract) throw new NotFoundError('Contract not found')

    const body = await req.json().catch(() => ({}))
    const parsed = createInviteSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(`Invalid email: ${parsed.error.message}`)
    }

    const { email, role } = parsed.data
    const token = crypto.randomBytes(24).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days

    const [invitation] = await db
      .insert(contract_invitations)
      .values({
        contract_id: contractId,
        email,
        role,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .returning()

    if (!invitation) throw new Error('Failed to create invitation')

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
        invite_url: `/invite/${token}`,
        token,
      },
    }, { status: 201, headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
