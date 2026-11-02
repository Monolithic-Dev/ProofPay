/**
 * Contract funding status badge route — GET /api/v1/contracts/[id]/funding-status
 * Implements phase-5-paypal-funding-and-release.md §5.5 (C-7) & api-spec.md §6.
 * Powers the "✓ Verified with PayPal" badge; cached 30s.
 */
import { NextResponse } from 'next/server'
import { apiHandler } from '@/server/http/handler'
import { getFundingStatus } from '@/server/funding/service'

export const GET = apiHandler(
  {
    auth: 'none',
  },
  async ({ params }) => {
    const contractId = params['id']!
    const result = await getFundingStatus(contractId)
    return NextResponse.json(result, { status: 200 })
  }
)
