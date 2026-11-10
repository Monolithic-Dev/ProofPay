/**
 * Apply automatic lint fix API route — POST /api/v1/contracts/[id]/lint/apply
 * Implements phase-3-auth-and-contracts.md §3.8.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { applyLintFix } from '@/server/contracts/service'

const ApplyFixBodySchema = z
  .object({
    issue_code: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.issue_code || data.code), {
    message: 'issue_code is required',
  })

export const POST = apiHandler(
  {
    auth: 'user',
    body: ApplyFixBodySchema,
  },
  async ({ user, params, body }) => {
    const contractId = params['id']!
    const issueCode = (body!.issue_code ?? body!.code)!
    const contract = await applyLintFix(contractId, user!, issueCode)

    return NextResponse.json({ contract }, { status: 200 })
  }
)
