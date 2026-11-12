/**
 * Demo login — POST /api/v1/auth/demo-login
 * Creates a session for one of the 4 demo personas.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { users, organizations, org_members } from '@/server/db/schema'
import { createSession, setSessionCookie } from '@/server/auth/session'
import { toErrorResponse, httpStatusFor, ValidationError, NotFoundError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'
import { env } from '@/server/config/env'

const PERSONA_ALIASES: Record<string, string> = {
  buyer_sarah: 'buyer',
  seller_alex: 'seller',
  agent_buyer: 'buyer_agent',
  agent_seller: 'worker_agent',
}

const bodySchema = z.object({
  persona_key: z.enum(['buyer', 'seller', 'buyer_agent', 'worker_agent']),
})

export async function POST(req: NextRequest) {
  const requestId = newRequestId()

  try {
    if (!env.DEMO_MODE) {
      throw new NotFoundError('Demo persona login is disabled (DEMO_MODE=false)')
    }

    const rawBody = await req.json().catch(() => ({}))
    const rawPersona = rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>).persona_key : undefined
    const normalizedPersona =
      typeof rawPersona === 'string'
        ? (PERSONA_ALIASES[rawPersona] ?? rawPersona)
        : rawPersona

    const { persona_key } = bodySchema.parse({
      ...(rawBody && typeof rawBody === 'object' ? rawBody : {}),
      persona_key: normalizedPersona,
    })

    const db = getDb()
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.persona_key, persona_key))
      .limit(1)

    if (!user) {
      throw new ValidationError(`Demo persona '${persona_key}' not found. Run: npm run seed`)
    }

    // Ensure Demo Workspace organization exists per v2 spec
    let [org] = await db.select().from(organizations).where(eq(organizations.slug, 'demo-workspace')).limit(1)
    if (!org) {
      const [createdOrg] = await db
        .insert(organizations)
        .values({
          name: 'Demo Workspace',
          slug: 'demo-workspace',
        })
        .returning()
      org = createdOrg
    }

    const orgRole =
      persona_key === 'buyer'
        ? 'owner'
        : persona_key === 'seller'
        ? 'member'
        : 'admin'

    if (org) {
      await db
        .insert(org_members)
        .values({
          org_id: org.id,
          user_id: user.id,
          role: orgRole,
        })
        .onConflictDoNothing()
    }

    const token = await createSession({
      sub: user.id,
      email: user.email,
      role: user.role as 'buyer' | 'seller' | 'admin',
      is_agent: user.is_agent,
      org_id: org?.id,
      org_role: orgRole,
    })

    await setSessionCookie(token)

    return NextResponse.json({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      is_agent: user.is_agent,
      persona_key: user.persona_key,
      org_id: org?.id,
      org_role: orgRole,
    }, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(
      toErrorResponse(err, requestId),
      { status: httpStatusFor(err), headers: { 'X-Request-Id': requestId } }
    )
  }
}
