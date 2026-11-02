/**
 * Contract accept API route — POST /api/v1/contracts/[id]/accept
 * Implements phase-3-auth-and-contracts.md §3.8.
 */
import { NextResponse } from 'next/server'
import { apiHandler } from '@/server/http/handler'
import { acceptContract } from '@/server/contracts/service'

export const POST = apiHandler(
  { auth: 'user' },
  async ({ user, params }) => {
    const contractId = params['id']!
    const contract = await acceptContract(contractId, user!)

    return NextResponse.json({ contract }, { status: 200 })
  }
)
