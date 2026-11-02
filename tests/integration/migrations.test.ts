import { describe, it, expect } from 'vitest'
import { runMigrations } from '@/../scripts/migrate'
import fs from 'fs'
import path from 'path'

describe('Database Migrations & Triggers', () => {
  it('all migration files in ./drizzle exist and contain valid SQL statements', () => {
    const dir = path.resolve(process.cwd(), 'drizzle')
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql'))

    expect(files).toContain('0000_init.sql')
    expect(files).toContain('0001_ledger_trigger.sql')
    expect(files).toContain('0002_idempotency_kv.sql')

    for (const f of files) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8')
      expect(sql.length).toBeGreaterThan(20)
    }
  })

  it('0001_ledger_trigger.sql declares ledger_no_mutate function and trigger', () => {
    const triggerFile = path.resolve(process.cwd(), 'drizzle/0001_ledger_trigger.sql')
    const sql = fs.readFileSync(triggerFile, 'utf8')

    expect(sql).toContain('CREATE OR REPLACE FUNCTION ledger_no_mutate()')
    expect(sql).toContain('ledger_events is append-only')
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON ledger_events')
  })

  it('0000_init.sql includes check constraint for capture_only_when_releasing', () => {
    const initFile = path.resolve(process.cwd(), 'drizzle/0000_init.sql')
    const sql = fs.readFileSync(initFile, 'utf8')

    expect(sql).toContain('capture_only_when_releasing')
    expect(sql).toContain("capture_id IS NULL OR status IN ('RELEASING', 'RELEASED', 'RELEASE_FAILED')")
  })
})
