import { describe, it, expect } from 'vitest'
import { isPrivateOrReservedHost, safeFetch, SecuritySSRFError } from '@/lib/security/safe-fetch'

describe('SSRF-Safe HTTP Client (safeFetch)', () => {
  it('correctly identifies private, loopback, and metadata hostnames', () => {
    expect(isPrivateOrReservedHost('localhost')).toBe(true)
    expect(isPrivateOrReservedHost('127.0.0.1')).toBe(true)
    expect(isPrivateOrReservedHost('169.254.169.254')).toBe(true)
    expect(isPrivateOrReservedHost('10.0.1.5')).toBe(true)
    expect(isPrivateOrReservedHost('192.168.1.1')).toBe(true)
    expect(isPrivateOrReservedHost('172.20.0.1')).toBe(true)
    expect(isPrivateOrReservedHost('api.sandbox.paypal.com')).toBe(false)
    expect(isPrivateOrReservedHost('example.com')).toBe(false)
  })

  it('rejects disallowed protocols like file: and gopher:', async () => {
    await expect(safeFetch('file:///etc/passwd')).rejects.toThrow(SecuritySSRFError)
    await expect(safeFetch('gopher://127.0.0.1')).rejects.toThrow(SecuritySSRFError)
  })

  it('blocks requests to internal hosts', async () => {
    await expect(safeFetch('http://169.254.169.254/latest/meta-data')).rejects.toThrow(
      /SSRF Guard: connection to internal/
    )
    await expect(safeFetch('http://localhost:8080/admin')).rejects.toThrow(
      /SSRF Guard: connection to internal/
    )
  })
})

