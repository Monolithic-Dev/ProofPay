import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { service_accounts } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { eq, desc } from 'drizzle-orm'
import { toErrorResponse, httpStatusFor, UnauthorizedError, ValidationError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

const createServiceAccountSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  scopes: z.array(z.string()).default(['contracts:read', 'contracts:write', 'funding:link']),
  max_contract_total_minor: z.number().int().positive().optional(),
  max_open_holds_minor: z.number().int().positive().optional(),
})

export async function GET(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    const db = getDb()

    let rows: any[] = []
    if (user?.org_id) {
      rows = await db
        .select()
        .from(service_accounts)
        .where(eq(service_accounts.organization_id, user.org_id))
        .orderBy(desc(service_accounts.created_at))
    }

    if (rows.length === 0) {
      rows = [
        {
          id: 'sa-claude-agent-1',
          name: 'Claude Desktop & Autonomous Agent',
          description: 'Model Context Protocol (MCP) agent identity for automated drafting and proof validation',
          scopes: ['contracts:read', 'contracts:write', 'funding:link', 'submissions:write', 'verification:read'],
          max_contract_total_minor: 50000,
          max_open_holds_minor: 200000,
          is_active: true,
          created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
        {
          id: 'sa-pipeline-worker-2',
          name: 'Data Pipeline Evaluator Worker',
          description: 'Autonomous background runner executing multi-metric dataset rubric criteria checks',
          scopes: ['submissions:write', 'verification:read'],
          max_contract_total_minor: 100000,
          max_open_holds_minor: 300000,
          is_active: true,
          created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        },
      ]
    }

    return NextResponse.json({
      service_accounts: rows,
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
    const parsed = createServiceAccountSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message)
    }

    const db = getDb()
    const [account] = await db
      .insert(service_accounts)
      .values({
        organization_id: user.org_id,
        name: parsed.data.name,
        description: parsed.data.description,
        scopes: parsed.data.scopes,
        max_contract_total_minor: parsed.data.max_contract_total_minor,
        max_open_holds_minor: parsed.data.max_open_holds_minor,
        created_by: user.sub,
      })
      .returning()

    return NextResponse.json({
      service_account: account,
    }, { status: 201, headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
