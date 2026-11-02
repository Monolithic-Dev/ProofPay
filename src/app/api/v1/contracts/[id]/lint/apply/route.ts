/**
 * Apply automatic lint fix API route — POST /api/v1/contracts/[id]/lint/apply
 * Implements phase-3-auth-and-contracts.md §3.8.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { applyLintFix } from '@/server/contracts/service'

const ApplyFixBodySchema = z.object({
  issue_code: z.string().min(1, 'issue_code is required'),
})

export const POST = apiHandler(
  {
    auth: 'user',
    body: ApplyFixBodySchema,
  },
  async ({ user, params, body }) => {
    const contractId = params['id']!
    const contract = await applyLintFix(contractId, user!, body!.issue_code)

    return NextResponse.json({ contract }, { status: 200 })
  }
)
