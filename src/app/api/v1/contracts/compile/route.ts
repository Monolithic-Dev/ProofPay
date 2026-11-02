/**
 * Contract compilation API route — POST /api/v1/contracts/compile
 * Implements phase-3-auth-and-contracts.md §3.8.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { compileContract } from '@/server/contracts/compile'

const CompileBodySchema = z.object({
  prompt: z
    .string()
    .min(1, 'Job prompt cannot be empty')
    .max(2000, 'Job prompt exceeds 2,000 characters'),
  seller_email: z.string().email().optional(),
  budget_cap_minor: z.number().int().positive().optional(),
})

export const POST = apiHandler(
  {
    auth: 'user',
    body: CompileBodySchema,
    rateLimit: {
      limit: 10,
      windowMs: 60_000,
    },
  },
  async ({ user, body }) => {
    const result = await compileContract({
      prompt: body!.prompt,
      userId: user!.sub,
      sellerEmail: body!.seller_email,
      budgetCapMinor: body!.budget_cap_minor,
    })

    return NextResponse.json(result, { status: 201 })
  }
)
