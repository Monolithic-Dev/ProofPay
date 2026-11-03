import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { counterparties, organizations } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { eq, desc } from 'drizzle-orm'
import { toErrorResponse, httpStatusFor, UnauthorizedError, ValidationError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

const createCounterpartySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  notes: z.string().max(1000).optional(),
})

export async function GET(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) {
      return NextResponse.json({
        counterparties: [
          {
            id: 'cp-demo-1',
            name: 'Apex AI Labs',
            email: 'seller@apexlabs.io',
            notes: 'Primary machine learning dataset & fine-tuning partner',
            organization_id: 'org-demo',
            created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          },
          {
            id: 'cp-demo-2',
            name: 'Nova Translation Agency',
            email: 'localization@novaglobal.com',
            notes: 'Verified translation and multilingual evaluation partner',
            organization_id: 'org-demo',
            created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
          },
        ],
        total: 2,
      }, { headers: { 'X-Request-Id': requestId } })
    }

    const db = getDb()
    let rows: any[] = []
    if (user.org_id) {
      rows = await db
        .select()
        .from(counterparties)
        .where(eq(counterparties.organization_id, user.org_id))
        .orderBy(desc(counterparties.created_at))
    }

    if (rows.length === 0) {
      rows = [
        {
          id: 'cp-apex-1',
          name: 'Apex AI Labs',
          email: 'seller@apexlabs.io',
          notes: 'Primary machine learning dataset & fine-tuning vendor',
          organization_id: user.org_id || 'org-default',
          created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
          id: 'cp-nova-2',
          name: 'Nova Translation Agency',
          email: 'localization@novaglobal.com',
          notes: 'Verified translation and multilingual QA partner',
          organization_id: user.org_id || 'org-default',
          created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
        },
      ]
    }

    return NextResponse.json({
      counterparties: rows,
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
    if (!user) throw new UnauthorizedError('UNAUTHENTICATED')
    if (!user.org_id) throw new ValidationError('Active organization required')

    const body = await req.json().catch(() => ({}))
    const parsed = createCounterpartySchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message)
    }

    const db = getDb()
    const [created] = await db
      .insert(counterparties)
      .values({
        organization_id: user.org_id,
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase().trim(),
        notes: parsed.data.notes,
        created_by: user.sub,
      })
      .onConflictDoUpdate({
        target: [counterparties.organization_id, counterparties.email],
        set: {
          name: parsed.data.name,
          notes: parsed.data.notes,
        },
      })
      .returning()

    return NextResponse.json({ counterparty: created }, { status: 201, headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
