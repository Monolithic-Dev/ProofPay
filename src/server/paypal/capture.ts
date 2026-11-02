/**
 * PayPal Payments v2 — capture (partial and final).
 * ONLY imported by src/server/release/ (enforced by ESLint).
 */
import { ppFetch } from './client'
import { newRequestId } from '@/server/util/ids'
import { PayPalError } from '@/server/util/errors'

export interface CaptureResult {
  id: string
  status: string
  amount: { currency_code: string; value: string }
  final_capture: boolean
  seller_receivable_breakdown?: Record<string, unknown>
  create_time?: string
}

export interface CaptureParams {
  authorizationId: string
  amountMinor: number
  isFinal: boolean
  idempotencyKey: string  // pp:{contractId}:{milestoneKey}:capture:{n}
  mockCode?: string
}

/**
 * Capture funds from an authorization.
 * Called ONLY from release/service.ts.
 */
export async function captureAuthorization(params: CaptureParams): Promise<CaptureResult> {
  const { authorizationId, amountMinor, isFinal, idempotencyKey, mockCode } = params
  const amount = (amountMinor / 100).toFixed(2)

  const result = await ppFetch<CaptureResult>(
    `/v2/payments/authorizations/${authorizationId}/capture`,
    {
      method: 'POST',
      requestId: newRequestId(),
      idempotencyKey,
      mockCode,
      body: {
        amount: { currency_code: 'USD', value: amount },
        final_capture: isFinal,
        invoice_id: idempotencyKey,
      },
    }
  )

  // Declined capture surfaces as a DECLINED status, not an HTTP error
  if (result.status === 'DECLINED') {
    throw new PayPalError('Capture declined by PayPal', { capture_id: result.id, status: result.status })
  }

  return result
}
