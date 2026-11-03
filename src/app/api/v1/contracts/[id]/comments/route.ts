import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { contract_comments, users, contracts } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { toErrorResponse, httpStatusFor, ValidationError, UnauthorizedError, NotFoundError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

const commentSchema = z.object({
  content: z.string().min(1).max(2000),
  milestone_id: z.string().uuid().optional(),
})

export async function GET(
  req: NextRequest,
  context: any = {}
) {
  const requestId = newRequestId()
  const contractId = context?.params?.id

  try {
    const user = await readSession(req)
    if (!user) {
      throw new UnauthorizedError('UNAUTHENTICATED')
    }

    const db = getDb()

    // Fetch comments joined with user details
    const rows = await db
      .select({
        id: contract_comments.id,
        contract_id: contract_comments.contract_id,
        milestone_id: contract_comments.milestone_id,
        user_id: contract_comments.user_id,
        content: contract_comments.content,
        created_at: contract_comments.created_at,
        author_name: users.display_name,
        author_email: users.email,
        author_role: users.role,
        is_agent: users.is_agent,
      })
      .from(contract_comments)
      .innerJoin(users, eq(contract_comments.user_id, users.id))
      .where(eq(contract_comments.contract_id, contractId))
      .orderBy(asc(contract_comments.created_at))

    return NextResponse.json({
      comments: rows,
      total: rows.length,
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
  const contractId = context?.params?.id

  try {
    const user = await readSession(req)
    if (!user) {
      throw new UnauthorizedError('UNAUTHENTICATED')
    }

    const body = await req.json().catch(() => ({}))
    const parsed = commentSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(`Invalid comment payload: ${parsed.error.message}`)
    }

    const db = getDb()

    // Check contract exists
    const [contract] = await db
      .select({ id: contracts.id })
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1)

    if (!contract) {
      throw new NotFoundError(`Contract ${contractId} not found`)
    }

    const [comment] = await db
      .insert(contract_comments)
      .values({
        contract_id: contractId,
        milestone_id: parsed.data.milestone_id,
        user_id: user.sub,
        content: parsed.data.content,
      })
      .returning()

    return NextResponse.json({
      comment: {
        ...comment,
        author_email: user.email,
      },
    }, { status: 201, headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
