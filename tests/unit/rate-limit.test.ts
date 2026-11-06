import { describe, it, expect, beforeEach } from 'vitest'
import {
  rateLimit,
  rateLimitPersistent,
  clientIp,
  clearRateLimits,
  getRateLimitStoreSize,
} from '@/server/util/rate-limit'

describe('Rate Limiter (Finding S-4)', () => {
  beforeEach(() => {
    clearRateLimits()
  })

  it('allows requests within threshold and decrements remaining', () => {
    const opts = { key: 'test-ip-1', limit: 3, windowMs: 10_000 }

    const res1 = rateLimit(opts)
    expect(res1.ok).toBe(true)
    expect(res1.remaining).toBe(2)

    const res2 = rateLimit(opts)
    expect(res2.ok).toBe(true)
    expect(res2.remaining).toBe(1)

    const res3 = rateLimit(opts)
    expect(res3.ok).toBe(true)
    expect(res3.remaining).toBe(0)

    // 4th request exceeds limit
    const res4 = rateLimit(opts)
    expect(res4.ok).toBe(false)
    expect(res4.remaining).toBe(0)
    expect(res4.resetAt).toBeGreaterThan(Date.now())
  })

  it('isolates different keys independently', () => {
    const optsA = { key: 'client-A', limit: 1, windowMs: 5000 }
    const optsB = { key: 'client-B', limit: 1, windowMs: 5000 }

    expect(rateLimit(optsA).ok).toBe(true)
    expect(rateLimit(optsA).ok).toBe(false) // Client A blocked

    // Client B remains unaffected
    expect(rateLimit(optsB).ok).toBe(true)
  })

  it('extracts client IP correctly with fallback', () => {
    // x-forwarded-for with multiple hops
    const req1 = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' },
    })
    expect(clientIp(req1)).toBe('203.0.113.195')

    // x-real-ip
    const req2 = new Request('http://localhost', {
      headers: { 'x-real-ip': '198.51.100.1' },
    })
    expect(clientIp(req2)).toBe('198.51.100.1')

    // fallback to loopback
    const req3 = new Request('http://localhost')
    expect(clientIp(req3)).toBe('127.0.0.1')
  })

  it('falls back gracefully to memory store when DB is not configured in persistent mode', async () => {
    const opts = { key: 'fallback-test', limit: 2, windowMs: 10_000 }
    const res1 = await rateLimitPersistent(opts)
    expect(res1.ok).toBe(true)
    expect(res1.remaining).toBe(1)
  })

  it('tracks in-memory key counts and resets properly', () => {
    rateLimit({ key: 'k1', limit: 5, windowMs: 1000 })
    rateLimit({ key: 'k2', limit: 5, windowMs: 1000 })
    expect(getRateLimitStoreSize()).toBe(2)

    clearRateLimits()
    expect(getRateLimitStoreSize()).toBe(0)
  })
})
