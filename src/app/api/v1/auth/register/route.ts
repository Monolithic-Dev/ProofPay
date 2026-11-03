import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { users, organizations, org_members } from '@/server/db/schema'
import { createSession, setSessionCookie } from '@/server/auth/session'
import { toErrorResponse, httpStatusFor, ValidationError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

const registerSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(2).max(100),
  role: z.enum(['buyer', 'seller']),
})

export async function POST(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const body = await req.json().catch(() => ({}))
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(`Invalid registration payload: ${parsed.error.message}`)
    }

    const { email, display_name, role } = parsed.data
    const db = getDb()

    // Check if user already exists
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)

    let userId: string

    if (existing) {
      // Update display name and role if already registered
      const [updated] = await db
        .update(users)
        .set({ display_name, role })
        .where(eq(users.id, existing.id))
        .returning()
      userId = updated?.id ?? existing.id
    } else {
      const [created] = await db
        .insert(users)
        .values({
          email,
          display_name,
          role,
          is_agent: false,
        })
        .returning()

      if (!created) {
        throw new Error('Failed to create user record')
      }
      userId = created.id

      // Auto-provision personal organization
      const slug = `${display_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`
      const [newOrg] = await db
        .insert(organizations)
        .values({
          name: `${display_name}'s Workspace`,
          slug,
        })
        .returning()

      if (newOrg) {
        await db.insert(org_members).values({
          org_id: newOrg.id,
          user_id: userId,
          role: 'owner',
        })
      }
    }

    const token = await createSession({
      sub: userId,
      email,
      role,
      is_agent: false,
    })

    await setSessionCookie(token)

    return NextResponse.json(
      {
        id: userId,
        email,
        display_name,
        role,
        is_agent: false,
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
