/**
 * Contract propose API route — POST /api/v1/contracts/[id]/propose
 * Implements phase-3-auth-and-contracts.md §3.8.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { proposeContract } from '@/server/contracts/service'

const ProposeBodySchema = z
  .object({
    seller_email: z.string().email().optional(),
  })
  .optional()

export const POST = apiHandler(
  {
    auth: 'user',
    body: ProposeBodySchema,
  },
  async ({ user, params, body }) => {
    const contractId = params['id']!
    const contract = await proposeContract(
      contractId,
      user!,
      body?.seller_email
    )

    return NextResponse.json({ contract }, { status: 200 })
  }
)
