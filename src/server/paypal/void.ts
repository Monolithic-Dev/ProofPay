/**
 * PayPal Authorizations Void API v2 adapter.
 * Implements phase-5-paypal-funding-and-release.md §5.4 & paypal-integration.md §3.4.
 *
 * NOTE: This module must ONLY be imported by src/server/release/ (lint enforced).
 */
import { paypalFetch } from './client'

/**
 * Void an authorization hold.
 * Succeeds on HTTP 204 No Content.
 */
export async function voidAuthorization(
  authorizationId: string,
  requestId?: string
): Promise<void> {
  await paypalFetch<void>(
    'POST',
    `/v2/payments/authorizations/${authorizationId}/void`,
    {
      body: {},
      requestId,
    }
  )
}
