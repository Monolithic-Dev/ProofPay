/**
 * API key authentication — hashed keys for agent and machine access.
 * Implements phase-3-auth-and-contracts.md §3.1.
 */
import { randomBytes } from 'crypto'
import { eq, and, isNull } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { api_keys, users } from '@/server/db/schema'
import { sha256Hex } from '@/server/contracts/canonical'
import { UnauthorizedError, NotFoundError } from '@/server/util/errors'
import type { SessionUser } from './session'

const KEY_PREFIX = 'pp_k_'

/**
 * Generate a new API key for a user:
 * - Secret: pp_k_ + 32 base64url random bytes
 * - Stores: key_prefix (first 8 chars after prefix), key_hash (SHA-256)
 * - Returns: id, prefix, secret (shown once)
 */
export async function createApiKey(
  userId: string,
  label: string
): Promise<{
  id: string
  keyPrefix: string
  secret: string
}> {
  const db = getDb()
  const raw = randomBytes(32).toString('base64url')
  const secret = KEY_PREFIX + raw
  const hash = sha256Hex(secret)
  const keyPrefix = raw.slice(0, 8)

  const [row] = await db
    .insert(api_keys)
    .values({
      user_id: userId,
      key_prefix: keyPrefix,
      key_hash: hash,
      label,
    })
    .returning()

  if (!row) throw new Error('Failed to generate API key')

  return {
    id: row.id,
    keyPrefix,
    secret,
  }
}

/**
 * Authenticate an API key from Authorization header or direct secret string.
 * Updates last_used_at at most once per minute.
 */
export async function authenticateApiKey(authHeaderOrSecret: string): Promise<SessionUser> {
  let secret = authHeaderOrSecret.trim()
  if (secret.startsWith('Bearer ')) {
    secret = secret.slice(7).trim()
  }

  if (!secret.startsWith(KEY_PREFIX)) {
    throw new UnauthorizedError('INVALID_API_KEY')
  }

  const hash = sha256Hex(secret)
  const db = getDb()

  const [record] = await db
    .select({
      id: api_keys.id,
      userId: api_keys.user_id,
      lastUsedAt: api_keys.last_used_at,
      revokedAt: api_keys.revoked_at,
      user: {
        id: users.id,
        email: users.email,
        role: users.role,
        is_agent: users.is_agent,
      },
    })
    .from(api_keys)
    .innerJoin(users, eq(api_keys.user_id, users.id))
    .where(eq(api_keys.key_hash, hash))
    .limit(1)

  if (!record) {
    throw new UnauthorizedError('INVALID_API_KEY')
  }

  if (record.revokedAt) {
    throw new UnauthorizedError('INVALID_API_KEY (revoked)')
  }

  // Throttle last_used_at updates to once per minute
  const now = new Date()
  const lastUsed = record.lastUsedAt ? new Date(record.lastUsedAt).getTime() : 0
  if (now.getTime() - lastUsed > 60_000) {
    db.update(api_keys)
      .set({ last_used_at: now })
      .where(eq(api_keys.id, record.id))
      .catch((err) => console.warn('Failed to update api key last_used_at', err))
  }

  return {
    sub: record.user.id,
    email: record.user.email,
    role: record.user.role,
    is_agent: record.user.is_agent,
  }
}

export const verifyApiKey = authenticateApiKey

/**
 * Revoke an API key.
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<void> {
  const db = getDb()
  const [updated] = await db
    .update(api_keys)
    .set({ revoked_at: new Date() })
    .where(and(eq(api_keys.id, keyId), eq(api_keys.user_id, userId), isNull(api_keys.revoked_at)))
    .returning()

  if (!updated) {
    throw new NotFoundError('API key not found or already revoked')
  }
}

/**
 * List active API keys for a user (without hashes or secrets).
 */
export async function listApiKeys(userId: string) {
  const db = getDb()
  return db
    .select({
      id: api_keys.id,
      label: api_keys.label,
      keyPrefix: api_keys.key_prefix,
      createdAt: api_keys.created_at,
      lastUsedAt: api_keys.last_used_at,
      revokedAt: api_keys.revoked_at,
    })
    .from(api_keys)
    .where(eq(api_keys.user_id, userId))
}
