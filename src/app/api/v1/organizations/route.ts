import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { organizations, org_members, users } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { toErrorResponse, httpStatusFor, ValidationError, UnauthorizedError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
})

export async function GET(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) {
      throw new UnauthorizedError('UNAUTHENTICATED')
    }

    const db = getDb()

    // Fetch orgs where the user is a member
    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        logo_url: organizations.logo_url,
        role: org_members.role,
        joined_at: org_members.created_at,
        created_at: organizations.created_at,
      })
      .from(org_members)
      .innerJoin(organizations, eq(org_members.org_id, organizations.id))
      .where(eq(org_members.user_id, user.sub))
      .orderBy(desc(org_members.created_at))

    return NextResponse.json({
      organizations: rows,
      total: rows.length,
    }, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}

export async function POST(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) {
      throw new UnauthorizedError('UNAUTHENTICATED')
    }

    const body = await req.json().catch(() => ({}))
    const parsed = createOrgSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(`Invalid organization details: ${parsed.error.message}`)
    }

    const db = getDb()
    const name = parsed.data.name
    const slug =
      parsed.data.slug ||
      `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`

    const [newOrg] = await db
      .insert(organizations)
      .values({
        name,
        slug,
      })
      .returning()

    if (!newOrg) {
      throw new Error('Failed to create organization')
    }

    // Add user as Owner
    await db.insert(org_members).values({
      org_id: newOrg.id,
      user_id: user.sub,
      role: 'owner',
    })

    return NextResponse.json({
      organization: newOrg,
      role: 'owner',
    }, { status: 201, headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
