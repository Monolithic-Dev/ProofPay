/**
 * PayPal authorization management — get, reauthorize, void.
 * Void is ONLY imported by src/server/release/ (enforced by ESLint).
 */
import { ppFetch } from './client'
import { newRequestId } from '@/server/util/ids'

export interface PayPalAuthorization {
  id: string
  status: string
  amount: { currency_code: string; value: string }
  expiration_time?: string
  create_time?: string
  seller_protection?: { status: string }
}

export async function getAuthorization(authId: string): Promise<PayPalAuthorization> {
  return ppFetch<PayPalAuthorization>(
    `/v2/payments/authorizations/${authId}`,
    { requestId: newRequestId() }
  )
}

export interface ReauthorizeResult {
  id: string
  status: string
  expiration_time?: string
}

export async function reauthorize(authId: string, amountMinor: number): Promise<ReauthorizeResult> {
  return ppFetch<ReauthorizeResult>(
    `/v2/payments/authorizations/${authId}/reauthorize`,
    {
      method: 'POST',
      requestId: newRequestId(),
      idempotencyKey: `pp:reauth:${authId}`,
      body: {
        amount: {
          currency_code: 'USD',
          value: (amountMinor / 100).toFixed(2),
        },
      },
    }
  )
}
