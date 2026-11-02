/**
 * PayPal return redirect route — GET /api/v1/paypal/return
 * Implements phase-5-paypal-funding-and-release.md §5.5 & api-spec.md §6.
 */
import { NextResponse } from 'next/server'
import { apiHandler } from '@/server/http/handler'
import { handlePayPalReturn } from '@/server/funding/service'
import { logger } from '@/server/util/logger'

export const GET = apiHandler(
  {
    auth: 'none',
  },
  async ({ req, user }) => {
    const url = req.nextUrl
    const token = url.searchParams.get('token') || url.searchParams.get('order_id')
    const contractId = url.searchParams.get('contract_id')

    if (!contractId || !token) {
      return NextResponse.redirect(
        new URL('/contracts?error=invalid_return_params', req.url),
        302
      )
    }

    try {
      await handlePayPalReturn({
        token,
        contractId,
        user: user ?? {
          sub: 'buyer',
          role: 'buyer',
          email: 'buyer@proofpay.test',
          is_agent: false,
        },
      })

      return NextResponse.redirect(
        new URL(`/contracts/${contractId}?funded=1`, req.url),
        302
      )
    } catch (err: any) {
      logger.error({ err: String(err), contractId, token }, 'PayPal return handling failed')
      const code = err?.code ?? 'funding_failed'
      return NextResponse.redirect(
        new URL(`/contracts/${contractId}?error=${encodeURIComponent(code)}`, req.url),
        302
      )
    }
  }
)
