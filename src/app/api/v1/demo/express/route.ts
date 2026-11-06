/**
 * Demo Express Route — /api/v1/demo/express
 * Implements AIP-13 90-Second Express Judge Lane.
 *
 * GET  — Returns pre-authorized pool metrics and readiness status.
 * POST — Claims a pre-authorized contract and initiates the express autonomous verification & capture pipeline.
 */
import { NextResponse } from 'next/server'
import { apiHandler } from '@/server/http/handler'
import { env } from '@/server/config/env'
import { AppError } from '@/server/util/errors'
import { getDemoPoolStatus, claimExpressContract } from '@/server/demo/pool'
import { startScenario } from '@/demo/runner'

export const GET = apiHandler(
  {
    auth: 'none',
  },
  async () => {
    if (!env.DEMO_MODE) {
      throw new AppError('DEMO_MODE_DISABLED', 'Express lane requires DEMO_MODE', 404)
    }

    const status = await getDemoPoolStatus()
    return NextResponse.json(status)
  }
)

export const POST = apiHandler(
  {
    auth: 'user',
    rateLimit: {
      limit: 30,
      windowMs: 3600_000,
    },
  },
  async ({ user }) => {
    if (!env.DEMO_MODE) {
      throw new AppError('DEMO_MODE_DISABLED', 'Express lane requires DEMO_MODE', 404)
    }

    const userId = user!.sub

    // Start express scenario
    const runResult = await startScenario({
      name: 'express_happy_path',
      userId,
    })

    return NextResponse.json(
      {
        run_id: runResult.run_id,
        scenario: 'express_happy_path',
        status: 'RUNNING',
      },
      { status: 202 }
    )
  }
)
