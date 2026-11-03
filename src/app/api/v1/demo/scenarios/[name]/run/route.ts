/**
 * Demo Scenario Run Route — POST /api/v1/demo/scenarios/[name]/run
 * Implements phase-7-agents-judge-mode-mcp.md §7.3 & api-spec.md §8.
 *
 * Starts an asynchronous scenario execution.
 * Guards: DEMO_MODE required, rate limited 5/h/IP, authenticated buyer persona.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { env } from '@/server/config/env'
import { startScenario } from '@/demo/runner'
import { AppError } from '@/server/util/errors'

const ScenarioNameSchema = z.enum([
  'happy_path',
  'reject_then_pass',
  'injection_attack',
  'capture_declined',
  'silent_buyer_autorelease',
])

export const POST = apiHandler(
  {
    auth: 'user',
    rateLimit: {
      limit: 5,
      windowMs: 3600_000, // 5 per hour per IP
    },
  },
  async ({ user, params }) => {
    // 1. Guard: DEMO_MODE must be enabled
    if (!env.DEMO_MODE) {
      throw new AppError('DEMO_MODE_DISABLED', 'Scenario runs are only available when DEMO_MODE is active', 404)
    }

    // 2. Validate scenario name
    const rawName = params['name']
    const parseResult = ScenarioNameSchema.safeParse(rawName)
    if (!parseResult.success) {
      throw new AppError('INVALID_SCENARIO', `Invalid scenario name: ${rawName}`, 400)
    }
    const scenarioName = parseResult.data

    // 3. User must be logged in (buyer persona)
    const userId = user!.sub

    // 4. Start scenario runner
    const result = await startScenario({
      name: scenarioName,
      userId,
    })

    return NextResponse.json(
      {
        run_id: result.run_id,
        scenario: scenarioName,
        status: 'RUNNING',
      },
      { status: 202 }
    )
  }
)
