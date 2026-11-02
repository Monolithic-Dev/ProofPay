import { randomBytes } from 'crypto'

/** Generate a request-scoped ID: "req_" + 20 random base62 chars */
export function newRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(20)
  return 'req_' + Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

/** First 8 hex chars of a UUID for display purposes */
export function shortId(uuid: string): string {
  return uuid.replace(/-/g, '').slice(0, 8)
}

/** Generate a short random suffix (6 base62 chars) for idempotency */
export function nanoid6(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(6)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}
