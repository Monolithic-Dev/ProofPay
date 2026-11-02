/**
 * Escalation Decision Route — POST /api/v1/contracts/[id]/milestones/[mid]/decision
 * Implements phase-4-verification-engine.md §4.9 & api-spec.md §3.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { decideEscalation } from '@/server/submissions/decision'

const DecisionBodySchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().optional(),
})

export const POST = apiHandler(
  {
    auth: 'user',
    idempotent: true,
    body: DecisionBodySchema,
  },
  async ({ user, params, body }) => {
    const contractId = params['id']!
    const milestoneKey = params['mid']!

    const result = await decideEscalation({
      contractId,
      milestoneKey,
      user: user!,
      decision: body!.decision,
      note: body!.note,
    })

    return NextResponse.json(result, { status: 200 })
  }
)
