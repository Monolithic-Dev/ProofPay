/**
 * Contract cancel API route — POST /api/v1/contracts/[id]/cancel
 * Implements phase-3-auth-and-contracts.md §3.8 & security rule §3.12 (agents forbidden).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { cancelContract } from '@/server/contracts/service'

const CancelBodySchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .optional()

export const POST = apiHandler(
  {
    auth: 'user',
    body: CancelBodySchema,
  },
  async ({ user, params, body }) => {
    const contractId = params['id']!
    const contract = await cancelContract(
      contractId,
      user!,
      body?.reason
    )

    return NextResponse.json({ contract }, { status: 200 })
  }
)
