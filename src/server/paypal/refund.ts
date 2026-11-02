/**
 * PayPal refund — ONLY imported by src/server/release/.
 */
import { ppFetch } from './client'
import { newRequestId } from '@/server/util/ids'

export interface RefundResult {
  id: string
  status: string
  amount: { currency_code: string; value: string }
}

export async function refundCapture(
  captureId: string,
  amountMinor: number,
  note?: string
): Promise<RefundResult> {
  return ppFetch<RefundResult>(
    `/v2/payments/captures/${captureId}/refund`,
    {
      method: 'POST',
      requestId: newRequestId(),
      idempotencyKey: `pp:refund:${captureId}`,
      body: {
        amount: {
          currency_code: 'USD',
          value: (amountMinor / 100).toFixed(2),
        },
        note_to_payer: note?.slice(0, 255),
      },
    }
  )
}
