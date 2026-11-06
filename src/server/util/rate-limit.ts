/**
 * Sliding window rate limiter with persistent DB backing and bounded in-memory fallback.
 * Implements phase-3-auth-and-contracts.md §3.2 & security-privacy.md SP-1.
 * Prevents memory exhaustion attacks via bounded LRU/FIFO eviction.
 */
import type { Tx, Db } from '@/server/db/client'
import { kvGet, kvSet } from '@/server/db/repos/kv.repo'

interface RateLimitEntry {
  timestamps: number[]
}

export const MAX_STORE_KEYS = 50_000
const rateLimitStore = new Map<string, RateLimitEntry>()

// Periodic cleanup of stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < 3600_000)
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS).unref?.()

/**
 * Resets the in-memory rate limit store (used in testing).
 */
export function clearRateLimits(): void {
  rateLimitStore.clear()
}

/**
 * Inspects total keys tracked in-memory.
 */
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size
}

export interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

/**
 * Fast synchronous sliding window rate limiter.
 * Caps maximum store capacity to prevent memory exhaustion / DoS attacks.
 */
export function rateLimit(options: RateLimitOptions): RateLimitResult {
  const { key, limit, windowMs } = options
  const now = Date.now()
  const windowStart = now - windowMs

  let entry = rateLimitStore.get(key)
  if (!entry) {
    // Evict oldest entry if at capacity
    if (rateLimitStore.size >= MAX_STORE_KEYS) {
      const oldestKey = rateLimitStore.keys().next().value
      if (oldestKey) rateLimitStore.delete(oldestKey)
    }
    entry = { timestamps: [] }
    rateLimitStore.set(key, entry)
  }

  // Filter timestamps within current window
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart)

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0] ?? now
    const resetAt = oldest + windowMs
    return {
      ok: false,
      remaining: 0,
      resetAt,
    }
  }

  entry.timestamps.push(now)
  const remaining = Math.max(0, limit - entry.timestamps.length)
  const resetAt = now + windowMs

  return {
    ok: true,
    remaining,
    resetAt,
  }
}

/**
 * Persistent distributed sliding window rate limiter backed by the PostgreSQL kv table.
 * Falls back transparently to in-memory rate limiting if database is unavailable.
 */
export async function rateLimitPersistent(
  options: RateLimitOptions,
  db?: Tx | Db
): Promise<RateLimitResult> {
  const { key, limit, windowMs } = options
  const kvKey = `rl:${key}`
  const now = Date.now()
  const windowStart = now - windowMs

  try {
    const existing = await kvGet<{ timestamps: number[] }>(kvKey, db)
    const rawTimestamps = Array.isArray(existing?.timestamps) ? existing.timestamps : []
    const validTimestamps = rawTimestamps.filter((ts) => typeof ts === 'number' && ts > windowStart)

    if (validTimestamps.length >= limit) {
      const oldest = validTimestamps[0] ?? now
      return {
        ok: false,
        remaining: 0,
        resetAt: oldest + windowMs,
      }
    }

    validTimestamps.push(now)
    await kvSet(kvKey, { timestamps: validTimestamps }, db)

    return {
      ok: true,
      remaining: Math.max(0, limit - validTimestamps.length),
      resetAt: now + windowMs,
    }
  } catch {
    // If DB read/write fails, fallback to bounded in-memory limiter
    return rateLimit(options)
  }
}

/**
 * Extract client IP address from standard reverse-proxy headers.
 */
export function clientIp(req: Request): string {
  const xForwardedFor = req.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return '127.0.0.1'
}
