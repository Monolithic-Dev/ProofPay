/**
 * Contracts list API route — GET /api/v1/contracts
 * Implements phase-3-auth-and-contracts.md §3.8 & api-spec.md §3.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { getDb } from '@/server/db/client'
import { listContractsForUser } from '@/server/db/repos/contracts.repo'
import { buildContractView } from '@/server/contracts/view'
import { ContractStatus } from '@/shared/types'

const ListContractsQuerySchema = z.object({
  status: ContractStatus.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const GET = apiHandler(
  {
    auth: 'user',
    query: ListContractsQuerySchema,
  },
  async ({ user, query }) => {
    const rows = await listContractsForUser(getDb(), user!.sub, {
      status: query?.status,
      limit: query?.limit,
      orgId: user!.org_id,
      isAdmin: user!.role === 'admin',
    })

    const db = getDb()
    const views = await Promise.all(rows.map((r) => buildContractView(db, r)))

    return NextResponse.json(
      {
        contracts: views,
        total: views.length,
      },
      { status: 200 }
    )
  }
)
