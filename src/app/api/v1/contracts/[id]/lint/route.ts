/**
 * Contract re-lint API route — POST /api/v1/contracts/[id]/lint
 * Implements phase-3-auth-and-contracts.md §3.8.
 */
import { NextResponse } from 'next/server'
import { apiHandler } from '@/server/http/handler'
import { lintContract } from '@/server/contracts/service'

export const POST = apiHandler(
  { auth: 'user' },
  async ({ user, params }) => {
    const contractId = params['id']!
    const result = await lintContract(contractId, user!)

    return NextResponse.json(result, { status: 200 })
  }
)
