/**
 * PayPal Payments Capture API v2 adapter.
 * Implements phase-5-paypal-funding-and-release.md §5.4 & paypal-integration.md §3.3.
 *
 * NOTE: This module must ONLY be imported by src/server/release/ (lint enforced).
 */
import { paypalFetch } from './client'
import { toPayPalValue } from './money'

export interface CaptureAuthorizationParams {
  authorizationId: string
  amountMinor: number
  finalCapture: boolean
  invoiceId: string
  note?: string
  requestId?: string
  mockCode?: string
}

export interface CaptureAuthorizationResult {
  captureId: string
  status: 'COMPLETED' | 'PENDING' | 'DECLINED' | string
  amount?: { currency_code: string; value: string }
  finalCapture?: boolean
  raw: unknown
}

/**
 * Capture funds (partial or final) from an active authorization.
 */
export async function captureAuthorization(
  params: CaptureAuthorizationParams
): Promise<CaptureAuthorizationResult> {
  const { authorizationId, amountMinor, finalCapture, invoiceId, note, requestId, mockCode } = params

  const body = {
    amount: {
      currency_code: 'USD',
      value: toPayPalValue(amountMinor),
    },
    final_capture: finalCapture,
    invoice_id: invoiceId,
    note_to_payer: note ?? 'ProofPay milestone release',
  }

  const res = await paypalFetch<any>(
    'POST',
    `/v2/payments/authorizations/${authorizationId}/capture`,
    {
      body,
      requestId,
      mockCode,
    }
  )

  return {
    captureId: res.id,
    status: res.status,
    amount: res.amount,
    finalCapture: res.final_capture,
    raw: res,
  }
}
