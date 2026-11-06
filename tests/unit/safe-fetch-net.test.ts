import { describe, it, expect } from 'vitest'
import { safeFetch, SsrBlockedError, ResponseTooLargeError } from '@/server/net/safe-fetch'

describe('PLAT-1 SSRF Safe Fetch (src/server/net/safe-fetch.ts)', () => {
  it('throws SSRF_BLOCKED for localhost and loopback targets', async () => {
    await expect(safeFetch('http://127.0.0.1:8080/secret')).rejects.toThrow(SsrBlockedError)
    await expect(safeFetch('http://localhost:3000')).rejects.toThrow(SsrBlockedError)
    await expect(safeFetch('http://169.254.169.254/latest/meta-data')).rejects.toThrow(SsrBlockedError)
  })

  it('rejects URLs with userinfo/credentials', async () => {
    await expect(safeFetch('http://user:password@example.com/')).rejects.toThrow(
      'URLs containing user credentials / userinfo are blocked.'
    )
  })

  it('rejects unsupported protocols like file: or gopher:', async () => {
    await expect(safeFetch('file:///etc/passwd')).rejects.toThrow(SsrBlockedError)
    await expect(safeFetch('gopher://evil.example')).rejects.toThrow(SsrBlockedError)
  })

  it('rejects disallowed ports', async () => {
    await expect(
      safeFetch('https://93.184.216.34:22/ssh', { allowedPorts: [80, 443] })
    ).rejects.toThrow(/not in the allowed ports list/)
  })

  it('rejects when host resolves to private IP via custom resolver', async () => {
    const maliciousResolver = async () => [{ address: '10.0.0.1', family: 4 }]
    await expect(
      safeFetch('https://evil-domain.com/', {}, maliciousResolver)
    ).rejects.toThrow(/resolved to private\/blocked IP/)
  })

  it('rejects when any multi-homed IP resolves to a private address', async () => {
    const rebindResolver = async () => [
      { address: '93.184.216.34', family: 4 }, // public
      { address: '127.0.0.1', family: 4 },     // private rebind attempt
    ]
    await expect(
      safeFetch('https://rebind-domain.com/', {}, rebindResolver)
    ).rejects.toThrow(/resolved to private\/blocked IP/)
  })
})

