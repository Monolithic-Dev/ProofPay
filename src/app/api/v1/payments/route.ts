import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/server/db/client'
import { contracts, milestones } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { sql, desc } from 'drizzle-orm'
import { toErrorResponse, httpStatusFor, UnauthorizedError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

export async function GET(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) throw new UnauthorizedError('UNAUTHENTICATED')

    const db = getDb()

    const userContracts = await db
      .select()
      .from(contracts)
      .where(
        user.org_id
          ? sql`(${contracts.buyer_id} = ${user.sub} OR ${contracts.seller_id} = ${user.sub} OR ${contracts.buyer_org_id} = ${user.org_id} OR ${contracts.seller_org_id} = ${user.org_id})`
          : sql`(${contracts.buyer_id} = ${user.sub} OR ${contracts.seller_id} = ${user.sub})`
      )
      .orderBy(desc(contracts.created_at))

    const contractIds = userContracts.map((c) => c.id)

    const paymentRows: Array<{
      id: string
      contract_id: string
      contract_title: string
      milestone_id?: string
      milestone_title?: string
      type: 'HOLD_AUTHORIZED' | 'CAPTURE_RELEASED' | 'HOLD_VOIDED'
      amount_minor: number
      currency: string
      paypal_id: string | null
      status: string
      receipt_url: string | null
      date: string
    }> = []

    if (contractIds.length > 0) {
      const allMilestones = await db
        .select()
        .from(milestones)
        .where(sql`${milestones.contract_id} IN ${contractIds}`)

      for (const c of userContracts) {
        if (c.authorization_id) {
          paymentRows.push({
            id: `auth-${c.id}`,
            contract_id: c.id,
            contract_title: c.title,
            type: 'HOLD_AUTHORIZED',
            amount_minor: c.total_minor,
            currency: c.currency,
            paypal_id: c.authorization_id,
            status: ['FUNDED', 'IN_PROGRESS'].includes(c.status) ? 'ACTIVE_HOLD' : c.status,
            receipt_url: null,
            date: (c.updated_at || c.created_at).toISOString(),
          })
        }

        const cMilestones = allMilestones.filter((m) => m.contract_id === c.id)
        for (const m of cMilestones) {
          if (m.status === 'RELEASED') {
            paymentRows.push({
              id: `cap-${m.id}`,
              contract_id: c.id,
              contract_title: c.title,
              milestone_id: m.id,
              milestone_title: m.title,
              type: 'CAPTURE_RELEASED',
              amount_minor: m.amount_minor,
              currency: c.currency,
              paypal_id: m.capture_id || 'CAP-SANDBOX',
              status: 'RELEASED',
              receipt_url: `/contracts/${c.id}/receipts/${m.id}`,
              date: (m.captured_at || c.created_at).toISOString(),
            })
          } else if (m.status === 'VOIDED') {
            paymentRows.push({
              id: `void-${m.id}`,
              contract_id: c.id,
              contract_title: c.title,
              milestone_id: m.id,
              milestone_title: m.title,
              type: 'HOLD_VOIDED',
              amount_minor: m.amount_minor,
              currency: c.currency,
              paypal_id: c.authorization_id,
              status: 'VOIDED',
              receipt_url: null,
              date: c.created_at.toISOString(),
            })
          }
        }
      }
    }

    return NextResponse.json({
      payments: paymentRows,
      total: paymentRows.length,
    }, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
