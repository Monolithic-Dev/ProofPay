import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { users, organizations, org_members } from '@/server/db/schema'
import { createSession, setSessionCookie } from '@/server/auth/session'
import { toErrorResponse, httpStatusFor, ValidationError, NotFoundError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

const loginSchema = z.object({
  email: z.string().email(),
  role: z.enum(['buyer', 'seller', 'admin']).optional(),
  display_name: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const body = await req.json().catch(() => ({}))
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(`Invalid login payload: ${parsed.error.message}`)
    }

    const { email, role = 'buyer', display_name } = parsed.data
    const db = getDb()

    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

    // If user does not exist yet, provision an account on the fly
    if (!user) {
      const generatedName = display_name || email.split('@')[0] || 'User'
      const [created] = await db
        .insert(users)
        .values({
          email,
          display_name: generatedName,
          role,
          is_agent: false,
        })
        .returning()

      user = created
    }

    if (!user) {
      throw new NotFoundError(`User with email '${email}' could not be authenticated`)
    }

    let orgId: string | undefined
    let orgRole: string | undefined

    const [membership] = await db
      .select()
      .from(org_members)
      .where(eq(org_members.user_id, user.id))
      .limit(1)

    if (membership) {
      orgId = membership.org_id
      orgRole = membership.role
    } else {
      let [org] = await db.select().from(organizations).limit(1)
      if (!org) {
        const [newOrg] = await db
          .insert(organizations)
          .values({
            name: `${user.display_name}'s Team`,
            slug: `team-${user.id.slice(0, 8)}`,
          })
          .returning()
        org = newOrg
      }
      if (org) {
        orgId = org.id
        orgRole = 'owner'
        await db
          .insert(org_members)
          .values({
            org_id: org.id,
            user_id: user.id,
            role: 'owner',
          })
          .onConflictDoNothing()
      }
    }

    const token = await createSession({
      sub: user.id,
      email: user.email,
      role: user.role as 'buyer' | 'seller' | 'admin',
      is_agent: user.is_agent,
      org_id: orgId,
      org_role: orgRole,
    })

    await setSessionCookie(token)

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        is_agent: user.is_agent,
        persona_key: user.persona_key,
        org_id: orgId,
        org_role: orgRole,
      },
      { headers: { 'X-Request-Id': requestId } }
    )
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
