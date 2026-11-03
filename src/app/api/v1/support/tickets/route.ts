import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { support_tickets } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { toErrorResponse, httpStatusFor, ValidationError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

const ticketSchema = z.object({
  email: z.string().email(),
  subject: z.string().min(3).max(200),
  body: z.string().min(5).max(5000).optional(),
  message: z.string().min(5).max(5000).optional(),
  name: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
  contract_id: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    const body = await req.json().catch(() => ({}))
    const parsed = ticketSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message)
    }

    const messageContent = parsed.data.body || parsed.data.message || 'Support inquiry'
    const fullBody = parsed.data.name
      ? `From: ${parsed.data.name} (Category: ${parsed.data.category || 'General'})\n\n${messageContent}`
      : messageContent

    const db = getDb()
    const rows = await db
      .insert(support_tickets)
      .values({
        user_id: user?.sub,
        organization_id: user?.org_id,
        contract_id: parsed.data.contract_id,
        email: parsed.data.email,
        subject: parsed.data.subject,
        body: fullBody,
        status: 'OPEN',
      })
      .returning()

    const ticket = rows[0] || {
      id: newRequestId(),
      subject: parsed.data.subject,
      email: parsed.data.email,
      created_at: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      ticket,
      ticket_id: ticket.id,
      message: 'Support ticket submitted. A staff specialist will reply within 24 hours.',
    }, { status: 201, headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
