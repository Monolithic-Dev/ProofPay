/**
 * Contract retrieval & draft update API route — GET, PATCH /api/v1/contracts/[id]
 * Implements phase-3-auth-and-contracts.md §3.8 & security rule §3.12 (strangers 404).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { getContractView, updateContractDraft } from '@/server/contracts/service'

export const GET = apiHandler(
  { auth: 'user' },
  async ({ user, params }) => {
    const contractId = params['id']!
    const contract = await getContractView(contractId, user!)

    return NextResponse.json({ contract }, { status: 200 })
  }
)

const PatchBodySchema = z.union([
  z.array(
    z.object({
      op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
      path: z.string(),
      value: z.unknown().optional(),
      from: z.string().optional(),
    })
  ),
  z.record(z.unknown()),
])

export const PATCH = apiHandler(
  {
    auth: 'user',
    body: PatchBodySchema,
  },
  async ({ user, params, body }) => {
    const contractId = params['id']!
    const contract = await updateContractDraft(contractId, user!, body as any)

    return NextResponse.json({ contract }, { status: 200 })
  }
)
