/**
 * PayPal Captures Refund API v2 adapter.
 * Implements phase-5-paypal-funding-and-release.md §5.4 & paypal-integration.md §3.6.
 *
 * NOTE: This module must ONLY be imported by src/server/release/ (lint enforced).
 */
import { paypalFetch } from './client'
import { toPayPalValue } from './money'

export interface RefundCaptureParams {
  captureId: string
  amountMinor?: number
  note?: string
  requestId?: string
}

export interface RefundCaptureResult {
  id: string
  status: string
  amount?: { currency_code: string; value: string }
  note_to_payer?: string
  raw?: unknown
}

/**
 * Refund a captured milestone payment.
 * Omits amount object if amountMinor is not provided, triggering a full refund.
 */
export async function refundCapture(
  params: RefundCaptureParams
): Promise<RefundCaptureResult> {
  const { captureId, amountMinor, note, requestId } = params

  const body: Record<string, unknown> = {}
  if (amountMinor !== undefined) {
    body['amount'] = {
      currency_code: 'USD',
      value: toPayPalValue(amountMinor),
    }
  }
  if (note) {
    body['note_to_payer'] = note.slice(0, 255)
  }

  const res = await paypalFetch<any>(
    'POST',
    `/v2/payments/captures/${captureId}/refund`,
    {
      body,
      requestId,
    }
  )

  return {
    id: res.id,
    status: res.status,
    amount: res.amount,
    note_to_payer: res.note_to_payer,
    raw: res,
  }
}
