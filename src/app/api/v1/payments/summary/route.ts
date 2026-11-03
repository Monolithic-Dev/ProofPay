import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/server/db/client'
import { contracts, milestones } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { eq, or, sql } from 'drizzle-orm'
import { toErrorResponse, httpStatusFor, UnauthorizedError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

export async function GET(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) throw new UnauthorizedError('UNAUTHENTICATED')

    const db = getDb()

    // Query contracts belonging to user or active org
    const userContracts = await db
      .select()
      .from(contracts)
      .where(
        user.org_id
          ? sql`(${contracts.buyer_id} = ${user.sub} OR ${contracts.seller_id} = ${user.sub} OR ${contracts.buyer_org_id} = ${user.org_id} OR ${contracts.seller_org_id} = ${user.org_id})`
          : sql`(${contracts.buyer_id} = ${user.sub} OR ${contracts.seller_id} = ${user.sub})`
      )

    const contractIds = userContracts.map((c) => c.id)

    let heldMinor = 0
    let releasedMinorMonth = 0
    let voidedMinor = 0
    let refundedMinor = 0
    let atRiskMinor = 0

    if (contractIds.length > 0) {
      const allMilestones = await db
        .select()
        .from(milestones)
        .where(sql`${milestones.contract_id} IN ${contractIds}`)

      for (const m of allMilestones) {
        if (m.status === 'RELEASED') {
          releasedMinorMonth += m.amount_minor
        } else if (m.status === 'VOIDED') {
          voidedMinor += m.amount_minor
        }
      }

      for (const c of userContracts) {
        if (['FUNDED', 'IN_PROGRESS'].includes(c.status)) {
          const cMilestones = allMilestones.filter((m) => m.contract_id === c.id)
          const releasedForContract = cMilestones
            .filter((m) => m.status === 'RELEASED')
            .reduce((sum, m) => sum + m.amount_minor, 0)
          const voidedForContract = cMilestones
            .filter((m) => m.status === 'VOIDED')
            .reduce((sum, m) => sum + m.amount_minor, 0)

          const openHeld = Math.max(0, c.total_minor - releasedForContract - voidedForContract)
          heldMinor += openHeld

          // If milestone is escalated or near deadline, treat as at-risk
          const hasEscalated = cMilestones.some((m) => m.status === 'ESCALATED')
          if (hasEscalated) {
            atRiskMinor += openHeld
          }
        }
      }
    }

    return NextResponse.json({
      held_minor: heldMinor,
      released_minor_month: releasedMinorMonth,
      voided_minor: voidedMinor,
      refunded_minor: refundedMinor,
      at_risk_minor: atRiskMinor,
      currency: 'USD',
    }, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
