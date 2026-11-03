import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/server/db/client'
import { contracts, funding_approvals, organizations, org_members } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { eq, and } from 'drizzle-orm'
import { toErrorResponse, httpStatusFor, UnauthorizedError, NotFoundError, ForbiddenError, ValidationError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

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

    const orgId = contract.buyer_org_id || user.org_id
    if (!orgId) throw new ValidationError('Contract is not linked to a buyer organization')

    // Check if pending approval already exists
    const [existing] = await db
      .select()
      .from(funding_approvals)
      .where(
        and(
          eq(funding_approvals.contract_id, contractId),
          eq(funding_approvals.status, 'PENDING')
        )
      )
      .limit(1)

    if (existing) {
      return NextResponse.json({ approval: existing }, { status: 200, headers: { 'X-Request-Id': requestId } })
    }

    const [approval] = await db
      .insert(funding_approvals)
      .values({
        contract_id: contractId,
        organization_id: orgId,
        requested_by: user.sub,
        total_minor: contract.total_minor,
        status: 'PENDING',
      })
      .returning()

    return NextResponse.json({ approval }, { status: 201, headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
