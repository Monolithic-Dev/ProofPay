/**
 * Chaos mock injection route — POST /api/v1/contracts/[id]/chaos
 * Implements phase-5-paypal-funding-and-release.md §5.6 & paypal-integration.md §9.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { env } from '@/server/config/env'
import { getDb } from '@/server/db/client'
import { contracts } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { NotFoundError, ForbiddenError } from '@/server/util/errors'

const ChaosBodySchema = z.object({
  mock_code: z.enum([
    'INSTRUMENT_DECLINED',
    'TRANSACTION_REFUSED',
    'INTERNAL_SERVER_ERROR',
    'DUPLICATE_INVOICE_ID',
  ]),
})

export const POST = apiHandler(
  {
    auth: 'user',
    body: ChaosBodySchema,
  },
  async ({ user, params, body }) => {
    // 404 unless CHAOS_MODE is true
    if (!env.CHAOS_MODE) {
      throw new NotFoundError('Chaos injection endpoint is disabled (CHAOS_MODE=false)')
    }

    const contractId = params['id']!
    const db = getDb()

    const [contract] = await db
      .select({ id: contracts.id, buyer_id: contracts.buyer_id })
      .from(contracts)
      .where(eq(contracts.id, contractId))

    if (!contract) throw new NotFoundError(`Contract ${contractId} not found`)

    if (user!.sub !== contract.buyer_id && user!.role !== 'admin') {
      throw new ForbiddenError('Only the buyer can configure chaos mock on this contract')
    }

    await db
      .update(contracts)
      .set({ chaos_mock_code: body!.mock_code })
      .where(eq(contracts.id, contractId))

    return NextResponse.json(
      {
        success: true,
        contract_id: contractId,
        mock_code: body!.mock_code,
      },
      { status: 200 }
    )
  }
)
