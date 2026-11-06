import { describe, it, expect } from 'vitest'
import { buildCspHeader, generateCspNonce } from '@/server/security/csp'

describe('PLAT-11 CSP with Nonce (src/server/security/csp.ts)', () => {
  it('generates a unique base64 nonce', () => {
    const nonce1 = generateCspNonce()
    const nonce2 = generateCspNonce()
    expect(nonce1).toBeDefined()
    expect(nonce2).toBeDefined()
    expect(nonce1).not.toBe(nonce2)
    expect(nonce1.length).toBeGreaterThanOrEqual(16)
  })

  it('builds Content-Security-Policy header with strict dynamic and nonce', () => {
    const { headerName, headerValue, nonce } = buildCspHeader()

    expect(headerName).toBe('Content-Security-Policy')
    expect(headerValue).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`)
    expect(headerValue).not.toContain(`'unsafe-inline'` + '; script-src') // script-src must not contain unsafe-inline
    expect(headerValue).toContain(`frame-ancestors 'none'`)
    expect(headerValue).toContain(`form-action 'self' https://www.sandbox.paypal.com`)
    expect(headerValue).toContain(`report-uri /api/v1/csp-report`)
  })

  it('supports report-only mode header', () => {
    const { headerName } = buildCspHeader({ reportOnly: true })
    expect(headerName).toBe('Content-Security-Policy-Report-Only')
  })
})
