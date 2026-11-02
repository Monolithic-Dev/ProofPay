/**
 * Current user — GET /api/v1/me
 */
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { users } from '@/server/db/schema'
import { authenticate } from '@/server/auth/guards'
import { toErrorResponse, httpStatusFor } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

export async function GET(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const session = await authenticate(req)
    const db = getDb()

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.sub))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'User not found', request_id: requestId } },
        { status: 404, headers: { 'X-Request-Id': requestId } }
      )
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      is_agent: user.is_agent,
      persona_key: user.persona_key,
    }, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(
      toErrorResponse(err, requestId),
      { status: httpStatusFor(err), headers: { 'X-Request-Id': requestId } }
    )
  }
}
