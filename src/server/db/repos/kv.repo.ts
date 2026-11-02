/**
 * KV store repository — key/value storage for worker heartbeats and system state.
 * Implements phase-2-data-layer.md §2.10 and spec correction C-2.
 */
import { eq } from 'drizzle-orm'
import type { Tx, Db } from '@/server/db/client'
import { getDb } from '@/server/db/client'
import { kv } from '@/server/db/schema'

export async function kvSet(
  key: string,
  value: Record<string, unknown>,
  txOrDb?: Tx | Db
): Promise<void> {
  const db = txOrDb ?? getDb()
  await db
    .insert(kv)
    .values({
      key,
      value,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: kv.key,
      set: {
        value,
        updated_at: new Date(),
      },
    })
}

export async function kvGet<T = Record<string, unknown>>(
  key: string,
  txOrDb?: Tx | Db
): Promise<T | null> {
  const db = txOrDb ?? getDb()
  const rows = await db.select().from(kv).where(eq(kv.key, key)).limit(1)
  return (rows[0]?.value as T) ?? null
}
