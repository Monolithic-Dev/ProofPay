/**
 * API key authentication — hashed keys for agent/machine access.
 */
import { createHash, randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { api_keys, users } from '@/server/db/schema'
import { UnauthorizedError } from '@/server/util/errors'
import type { SessionPayload } from './session'

const KEY_PREFIX = 'pp_k_'

/** Generate a new API key, store the hash, return the full secret (shown once) */
export async function createApiKey(userId: string, label: string): Promise<{
  secret: string
  prefix: string
}> {
  const db = getDb()
  const raw = randomBytes(32).toString('base64url')
  const secret = KEY_PREFIX + raw
  const hash = sha256(secret)
  const prefix = secret.slice(0, 12) // 'pp_k_' + 7 chars

  await db.insert(api_keys).values({
    user_id: userId,
    key_prefix: prefix,
    key_hash: hash,
    label,
  })

  return { secret, prefix }
}

/** Verify an API key from the Authorization header; returns session-like payload */
export async function verifyApiKey(secret: string): Promise<SessionPayload> {
  const db = getDb()
  const hash = sha256(secret)

  const [row] = await db
    .select({
      keyId: api_keys.id,
      revoked: api_keys.revoked_at,
      userId: api_keys.user_id,
      user: {
        email: users.email,
        role: users.role,
        is_agent: users.is_agent,
      },
    })
    .from(api_keys)
    .innerJoin(users, eq(api_keys.user_id, users.id))
    .where(eq(api_keys.key_hash, hash))
    .limit(1)

  if (!row) throw new UnauthorizedError('Invalid API key')
  if (row.revoked) throw new UnauthorizedError('API key has been revoked')

  // Update last_used_at (fire-and-forget, not awaited)
  db.update(api_keys)
    .set({ last_used_at: new Date() })
    .where(eq(api_keys.id, row.keyId))
    .catch(() => null)

  return {
    sub: row.userId,
    email: row.user.email,
    role: row.user.role as 'buyer' | 'seller' | 'admin',
    is_agent: row.user.is_agent,
  }
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}
