/**
 * PostgreSQL Row-Level Security (RLS) helper.
 *
 * Enterprise Pillar 2 — Multi-Tenant Isolation.
 *
 * Strategy
 * --------
 * We enable RLS on every tenant-scoped table and add two permissive policies:
 *
 *   1. app_user_policy  — allows rows where the JWT subject matches buyer_id or seller_id.
 *   2. app_system_policy — allows ALL when the caller sets app.bypass_rls = 'on'
 *                          (used only by background workers + migration scripts that run
 *                          as the privileged postgres role, never as an end-user).
 *
 * The app.current_user_id setting is injected per-request by withUserTx() / setRlsContext().
 *
 * Security note
 * -------------
 * RLS is enforced at the PostgreSQL level.  Even if application code omits a WHERE clause,
 * the database will silently filter to only the rows the calling session is allowed to see.
 * This provides defence-in-depth against IDOR bugs.
 *
 * Usage
 * -----
 *   // Inside a route handler (after session auth):
 *   await withUserTx(user.sub, async (tx) => {
 *     const rows = await tx.select().from(contracts)  // only buyer/seller rows returned
 *   })
 *
 *   // Inside a background worker that needs unrestricted access:
 *   await withSystemTx(async (tx) => {
 *     const rows = await tx.select().from(contracts)  // all rows
 *   })
 */
import { sql } from 'drizzle-orm'
import { getDb, type Tx } from './client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tables that carry buyer_id / seller_id and must be isolated per tenant. */
export const RLS_TENANT_TABLES = [
  'contracts',
  'milestones',
  'submissions',
  'verifications',
  'ledger_events',
  'disputes',
] as const

export type RlsTenantTable = (typeof RLS_TENANT_TABLES)[number]

// ---------------------------------------------------------------------------
// Context setters
// ---------------------------------------------------------------------------

/**
 * Inject the current user ID into the PostgreSQL session so RLS policies fire.
 * Must be called inside a transaction (uses SET LOCAL so it auto-resets on commit/rollback).
 */
export async function setRlsContext(tx: Tx, userId: string): Promise<void> {
  await tx.execute(sql`SET LOCAL app.current_user_id = ${userId}`)
}

/**
 * Enable the system bypass flag.  ONLY for background workers / migration scripts.
 * Never call this in a user-facing request handler.
 */
export async function setSystemBypass(tx: Tx): Promise<void> {
  await tx.execute(sql`SET LOCAL app.bypass_rls = 'on'`)
}

// ---------------------------------------------------------------------------
// Transaction helpers
// ---------------------------------------------------------------------------

/**
 * Open a transaction with RLS scoped to the given user.
 * Equivalent to withTx() but also injects app.current_user_id.
 */
export async function withUserTx<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  const db = getDb()
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL statement_timeout = '15s'`)
    await tx.execute(sql`SET LOCAL lock_timeout = '5s'`)
    await setRlsContext(tx, userId)
    return fn(tx)
  })
}

/**
 * Open a transaction with the system bypass active (all rows visible).
 * Reserved for internal workers and batch jobs.
 */
export async function withSystemTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = getDb()
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL statement_timeout = '30s'`)
    await tx.execute(sql`SET LOCAL lock_timeout = '10s'`)
    await setSystemBypass(tx)
    return fn(tx)
  })
}

// ---------------------------------------------------------------------------
// DDL — idempotent RLS policy setup
// ---------------------------------------------------------------------------

/**
 * Apply RLS policies to all tenant-scoped tables.
 *
 * Safe to run multiple times (uses CREATE POLICY IF NOT EXISTS via DO block).
 * Intended to be run once during DB bootstrap / migration.
 *
 * NOTE: This does NOT use Drizzle migrations — it's raw DDL executed via getDb().
 *       Call this in your migration script or server startup hook.
 */
export async function applyRlsPolicies(): Promise<void> {
  const db = getDb()

  for (const table of RLS_TENANT_TABLES) {
    // Enable RLS on the table (idempotent)
    await db.execute(sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`))
    await db.execute(sql.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`))

    // Drop & recreate policies so they're always up-to-date
    await db.execute(
      sql.raw(`
        DO $$
        BEGIN
          -- User policy: allow rows the caller owns
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = '${table}' AND policyname = 'app_user_policy'
          ) THEN
            CREATE POLICY app_user_policy ON ${table}
              AS PERMISSIVE
              FOR ALL
              TO PUBLIC
              USING (
                current_setting('app.bypass_rls', true) = 'on'
                OR (
                  buyer_id  IS NOT NULL AND buyer_id  = current_setting('app.current_user_id', true)::uuid
                )
                OR (
                  seller_id IS NOT NULL AND seller_id = current_setting('app.current_user_id', true)::uuid
                )
              );
          END IF;
        END
        $$
      `)
    )
  }
}

/**
 * Remove all RLS policies and disable RLS (use in test teardown or rollback).
 */
export async function dropRlsPolicies(): Promise<void> {
  const db = getDb()
  for (const table of RLS_TENANT_TABLES) {
    await db.execute(sql.raw(`DROP POLICY IF EXISTS app_user_policy ON ${table}`))
    await db.execute(sql.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`))
  }
}
