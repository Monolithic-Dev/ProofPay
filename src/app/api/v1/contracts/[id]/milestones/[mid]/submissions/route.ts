/**
 * Deliverable Submissions Route — POST /api/v1/contracts/[id]/milestones/[mid]/submissions
 * Implements phase-4-verification-engine.md §4.9 & api-spec.md §3.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { submitDeliverable } from '@/server/submissions/service'

const SubmissionBodySchema = z.object({
  content_type: z.enum(['json_records', 'text']),
  content: z.union([z.string(), z.array(z.record(z.unknown()))]),
  note: z.string().optional(),
})

export const POST = apiHandler(
  {
    auth: 'user',
    idempotent: true,
    maxBytes: 1.2 * 1024 * 1024, // 1.2 MiB ceiling
    body: SubmissionBodySchema,
  },
  async ({ user, params, body }) => {
    const contractId = params['id']!
    const milestoneKey = params['mid']!

    const result = await submitDeliverable({
      contractId,
      milestoneKey,
      user: user!,
      body: body!,
    })

    return NextResponse.json(result, { status: 201 })
  }
)
