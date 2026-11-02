import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from './schema'

// ---------------------------------------------------------------------------
// Singleton DB client & connection pool
// ---------------------------------------------------------------------------
declare global {
  // eslint-disable-next-line no-var
  var __pg_client: ReturnType<typeof postgres> | undefined
  // eslint-disable-next-line no-var
  var __pg_db: PostgresJsDatabase<typeof schema> | undefined
}

function getDbUrl(): string {
  if (process.env['NODE_ENV'] === 'test') {
    return (
      process.env['TEST_DATABASE_URL'] ??
      process.env['DATABASE_URL'] ??
      'postgresql://proofpay:proofpay@localhost:5435/proofpay_test'
    )
  }
  return process.env['DATABASE_URL'] ?? ''
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!globalThis.__pg_db) {
    const url = getDbUrl()
    if (!url) throw new Error('DATABASE_URL is not set')

    const maxConnections = process.env['RUN_ROLE'] === 'web' ? 10 : 6

    globalThis.__pg_client = postgres(url, {
      max: maxConnections,
      idle_timeout: 20,
      connect_timeout: 10,
      connection: {
        application_name: 'proofpay',
      },
    })
    globalThis.__pg_db = drizzle(globalThis.__pg_client, { schema })
  }
  return globalThis.__pg_db
}

export type Db = ReturnType<typeof getDb>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Execute a function within a database transaction with standard timeouts.
 * Sets statement_timeout = '15s' and lock_timeout = '5s' to prevent stuck locks.
 */
export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = getDb()
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL statement_timeout = '15s'`)
    await tx.execute(sql`SET LOCAL lock_timeout = '5s'`)
    return fn(tx)
  })
}

/**
 * Acquire a transaction-level advisory lock on a contract.
 * Automatically released when the transaction ends (commit or rollback).
 * Ensures serial updates to the same contract (state transitions, ledger appends).
 */
export async function lockContract(tx: Tx, contractId: string): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${contractId}::text, 0))`
  )
}

/**
 * Close database connections (for tests and graceful process termination).
 */
export async function closeDb(): Promise<void> {
  if (globalThis.__pg_client) {
    await globalThis.__pg_client.end()
    globalThis.__pg_client = undefined
    globalThis.__pg_db = undefined
  }
}
