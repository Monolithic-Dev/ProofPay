/**
 * PayPal Authorizations API v2 adapter.
 * Implements phase-5-paypal-funding-and-release.md §5.3 & paypal-integration.md §3.5, §3.7.
 */
import { paypalFetch } from './client'

export interface PayPalAuthorizationDetails {
  id: string
  status: string
  amount: { currency_code: string; value: string }
  expiration_time?: string
  create_time?: string
  seller_protection?: { status: string }
  links?: Array<{ href: string; rel: string; method?: string }>
}

export interface ReauthorizeResult {
  newAuthorizationId: string
  status: string
  expirationTime?: string
  amount?: { currency_code: string; value: string }
}

/**
 * Get live authorization status. Powers the "✓ Verified with PayPal" badge and reconciliation.
 */
export async function getAuthorization(authorizationId: string): Promise<PayPalAuthorizationDetails> {
  return paypalFetch<PayPalAuthorizationDetails>(
    'GET',
    `/v2/payments/authorizations/${authorizationId}`
  )
}

/**
 * Reauthorize an authorization after the 3-day honor window.
 * Returns the new authorization ID.
 */
export async function reauthorize(
  authorizationId: string,
  requestId?: string
): Promise<ReauthorizeResult> {
  const res = await paypalFetch<any>(
    'POST',
    `/v2/payments/authorizations/${authorizationId}/reauthorize`,
    {
      body: {},
      requestId,
    }
  )

  return {
    newAuthorizationId: res.id,
    status: res.status,
    expirationTime: res.expiration_time,
    amount: res.amount,
  }
}
