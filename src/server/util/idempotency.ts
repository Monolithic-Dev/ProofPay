/**
 * Idempotency key helper — implements spec correction C-1 & data-model.md §3.14.
 * Caches API endpoint responses per (user_id, route, key) tuple.
 */
import { eq, and, sql } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { idempotency_keys } from '@/server/db/schema'
import { canonicalize, sha256Hex } from '@/server/contracts/canonical'
import { AppError } from '@/server/util/errors'

export interface IdempotencyParams {
  userId: string
  route: string
  key: string
  requestBody: unknown
  ttlHours?: number
}

export interface IdempotencyResult<T> {
  status: number
  body: T
}

/**
 * Execute an operation with idempotency protection.
 * - Replays identical responses if the key and payload hash match within TTL.
 * - Throws 409 Conflict if the key was already used with a different request payload.
 */
export async function withIdempotency<T>(
  params: IdempotencyParams,
  handler: () => Promise<IdempotencyResult<T>>
): Promise<IdempotencyResult<T>> {
  const { userId, route, key, requestBody, ttlHours = 24 } = params
  const db = getDb()
  const requestHash = sha256Hex(canonicalize(requestBody ?? {}))

  // 1. Check for existing idempotency record
  const existing = await db
    .select()
    .from(idempotency_keys)
    .where(
      and(
        eq(idempotency_keys.user_id, userId),
        eq(idempotency_keys.route, route),
        eq(idempotency_keys.key, key)
      )
    )
    .limit(1)

  const record = existing[0]

  if (record) {
    const ageMs = Date.now() - new Date(record.created_at).getTime()
    const maxAgeMs = ttlHours * 60 * 60 * 1000

    if (ageMs < maxAgeMs) {
      if (record.request_hash !== requestHash) {
        throw new AppError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key already used with a different request payload',
          409
        )
      }
      return {
        status: record.response_status,
        body: record.response_body as T,
      }
    }
  }

  // 2. Execute handler
  const result = await handler()

  // 3. Store result in idempotency_keys table
  try {
    await db
      .insert(idempotency_keys)
      .values({
        user_id: userId,
        route,
        key,
        request_hash: requestHash,
        response_status: result.status,
        response_body: result.body,
        created_at: new Date(),
      })
      .onConflictDoUpdate({
        target: [idempotency_keys.user_id, idempotency_keys.route, idempotency_keys.key],
        set: {
          request_hash: requestHash,
          response_status: result.status,
          response_body: result.body,
          created_at: new Date(),
        },
      })
  } catch (err) {
    // Non-fatal if caching failed, still return handler result
    console.warn('Failed to save idempotency response', err)
  }

  return result
}
