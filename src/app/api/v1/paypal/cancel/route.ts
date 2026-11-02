/**
 * PayPal cancel redirect route — GET /api/v1/paypal/cancel
 * Implements phase-5-paypal-funding-and-release.md §5.5 & api-spec.md §6.
 */
import { NextResponse } from 'next/server'
import { apiHandler } from '@/server/http/handler'
import { handlePayPalCancel } from '@/server/funding/service'
import { logger } from '@/server/util/logger'

export const GET = apiHandler(
  {
    auth: 'none',
  },
  async ({ req, user }) => {
    const url = req.nextUrl
    const contractId = url.searchParams.get('contract_id')

    if (!contractId) {
      return NextResponse.redirect(
        new URL('/contracts?error=missing_contract_id', req.url),
        302
      )
    }

    try {
      await handlePayPalCancel({
        contractId,
        user: user ?? {
          sub: 'buyer',
          role: 'buyer',
          email: 'buyer@proofpay.test',
          is_agent: false,
        },
      })

      return NextResponse.redirect(
        new URL(`/contracts/${contractId}?cancelled=1`, req.url),
        302
      )
    } catch (err) {
      logger.error({ err: String(err), contractId }, 'PayPal cancel handling failed')
      return NextResponse.redirect(
        new URL(`/contracts/${contractId}?error=cancel_failed`, req.url),
        302
      )
    }
  }
)
