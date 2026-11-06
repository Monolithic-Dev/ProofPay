/**
 * Content Security Policy (CSP) with per-request nonces.
 * Implements PLAT-11 (Audit S-4, S-5).
 *
 * Enforces strict XSS protections, bans inline scripts without valid nonces,
 * prevents clickjacking via frame-ancestors 'none', and directs violations
 * to the CSP report endpoint.
 */
import * as crypto from 'node:crypto'

export interface CspHeaderOptions {
  nonce?: string
  reportOnly?: boolean
  reportUri?: string
}

export function generateCspNonce(): string {
  return crypto.randomBytes(16).toString('base64')
}

export function buildCspHeader(options?: CspHeaderOptions): { headerName: string; headerValue: string; nonce: string } {
  const nonce = options?.nonce || generateCspNonce()
  const reportUri = options?.reportUri || '/api/v1/csp-report'

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `connect-src 'self' https://api-m.sandbox.paypal.com`,
    `frame-ancestors 'none'`,
    `form-action 'self' https://www.sandbox.paypal.com`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `report-uri ${reportUri}`,
  ]

  const headerName = options?.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'
  const headerValue = directives.join('; ')

  return { headerName, headerValue, nonce }
}

