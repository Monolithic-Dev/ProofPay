/**
 * Contract fund API route — POST /api/v1/contracts/[id]/fund
 * Implements phase-5-paypal-funding-and-release.md §5.5 & api-spec.md §6.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { startFunding } from '@/server/funding/service'

const FundBodySchema = z
  .object({
    idempotency_key: z.string().optional(),
  })
  .optional()

export const POST = apiHandler(
  {
    auth: 'user',
    body: FundBodySchema,
  },
  async ({ user, params, body }) => {
    const contractId = params['id']!
    const result = await startFunding({
      contractId,
      user: user!,
      idempotencyKey: body?.idempotency_key,
    })

    return NextResponse.json(result, { status: 200 })
  }
)
