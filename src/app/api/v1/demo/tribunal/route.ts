/**
 * Multi-Agent AI Dispute Tribunal API Route — /api/v1/demo/tribunal
 * Simulates autonomous AI agents debating deliverable disputes and issuing binding PayPal settlements.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { env } from '@/server/config/env'
import { AppError } from '@/server/util/errors'
import { SCENARIOS, type DisputeScenario, type TribunalTurn } from '@/shared/tribunal-data'

export type { DisputeScenario, TribunalTurn }

const TribunalExecuteSchema = z.object({
  scenarioId: z.string(),
})

export const GET = apiHandler(
  {
    auth: 'none',
  },
  async () => {
    return NextResponse.json({
      status: 'ready',
      feature: 'Multi-Agent AI Dispute Tribunal',
      governance_model: 'ProofPay Autonomous Dispute Resolution Protocol (ADRP)',
      scenarios: SCENARIOS.map((s) => ({
        id: s.id,
        title: s.title,
        holdAmount: `$${(s.holdAmountMinor / 100).toFixed(2)} ${s.currency}`,
        contractTitle: s.contractTitle,
        buyerClaim: s.buyerClaim,
        sellerDefense: s.sellerDefense,
      })),
    })
  }
)

export const POST = apiHandler(
  {
    auth: 'none',
    body: TribunalExecuteSchema,
  },
  async ({ body }) => {
    const scenario = SCENARIOS.find((s) => s.id === body?.scenarioId) ?? SCENARIOS[0]!

    return NextResponse.json({
      status: 'success',
      scenario,
    })
  }
)
