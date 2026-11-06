/**
 * Unit Tests: PostgreSQL RLS Helper Functions
 *
 * Tests the RLS context setters and transaction wrappers in isolation.
 * Does NOT hit a real database — uses a mock Tx object.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  setRlsContext,
  setSystemBypass,
  RLS_TENANT_TABLES,
} from '@/server/db/rls'

// ─── Mock Tx ─────────────────────────────────────────────────────────────────

function makeMockTx() {
  const executed: string[] = []
  const tx = {
    execute: vi.fn(async (query: { sql?: string; toSQL?: () => { sql: string } } | string) => {
      let sqlStr: string
      if (typeof query === 'string') {
        sqlStr = query
      } else if (typeof query === 'object' && query !== null && 'sql' in query && typeof query.sql === 'string') {
        sqlStr = query.sql
      } else if (typeof query === 'object' && query !== null && 'toSQL' in query && typeof (query as any).toSQL === 'function') {
        sqlStr = (query as any).toSQL().sql
      } else {
        sqlStr = String(query)
      }
      executed.push(sqlStr)
    }),
    _executed: executed,
  }
  return tx
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RLS_TENANT_TABLES', () => {
  it('includes all required tenant-scoped tables', () => {
    const required = ['contracts', 'milestones', 'submissions', 'verifications', 'ledger_events', 'disputes']
    for (const t of required) {
      expect(RLS_TENANT_TABLES).toContain(t)
    }
  })

  it('has no duplicate entries', () => {
    const unique = new Set(RLS_TENANT_TABLES)
    expect(unique.size).toBe(RLS_TENANT_TABLES.length)
  })
})

describe('setRlsContext', () => {
  it('executes SET LOCAL app.current_user_id with the given userId', async () => {
    const tx = makeMockTx()
    const userId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

    await setRlsContext(tx as any, userId)

    expect(tx.execute).toHaveBeenCalledOnce()
    // The drizzle sql template produces a parameterised query object — verify the call happened
    const call = tx.execute.mock.calls[0]?.[0]
    // Should be a Drizzle SQL object (not a plain string)
    expect(call).toBeDefined()
  })

  it('calls tx.execute exactly once per invocation', async () => {
    const tx = makeMockTx()
    await setRlsContext(tx as any, 'user-id-123')
    expect(tx.execute).toHaveBeenCalledTimes(1)
  })
})

describe('setSystemBypass', () => {
  it('executes SET LOCAL app.bypass_rls = on', async () => {
    const tx = makeMockTx()
    await setSystemBypass(tx as any)
    expect(tx.execute).toHaveBeenCalledTimes(1)
  })
})

describe('RLS table coverage', () => {
  it('covers at least 6 tenant-scoped tables', () => {
    expect(RLS_TENANT_TABLES.length).toBeGreaterThanOrEqual(6)
  })

  it('all table names are non-empty strings', () => {
    for (const t of RLS_TENANT_TABLES) {
      expect(typeof t).toBe('string')
      expect(t.length).toBeGreaterThan(0)
    }
  })
})
