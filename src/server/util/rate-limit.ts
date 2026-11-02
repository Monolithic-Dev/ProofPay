/**
 * In-memory sliding window rate limiter.
 * Implements phase-3-auth-and-contracts.md §3.2 & security-privacy.md SP-1.
 * (Assumes single web instance per deployment spec).
 */

interface RateLimitEntry {
  timestamps: number[]
}

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

export function rateLimit(options: RateLimitOptions): RateLimitResult {
  const { key, limit, windowMs } = options
  const now = Date.now()
  const windowStart = now - windowMs

  let entry = rateLimitStore.get(key)
  if (!entry) {
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
