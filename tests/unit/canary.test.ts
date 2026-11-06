import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { runCanary, type CanaryCase } from '../../scripts/run-canary'
import { getLastCanaryResult } from '@/server/canary/last-run'

describe('AIP-5 (lite): Nightly Canary Verification', () => {
  it('loads exactly 12 fixed canary cases across P, F, A categories', () => {
    const casesPath = path.join(process.cwd(), 'tests', 'canary', 'cases.json')
    expect(fs.existsSync(casesPath)).toBe(true)

    const cases: CanaryCase[] = JSON.parse(fs.readFileSync(casesPath, 'utf8'))
    expect(cases).toHaveLength(12)

    const pCases = cases.filter((c) => c.id.startsWith('CANARY-P'))
    const fCases = cases.filter((c) => c.id.startsWith('CANARY-F'))
    const aCases = cases.filter((c) => c.id.startsWith('CANARY-A'))

    expect(pCases).toHaveLength(4)
    expect(fCases).toHaveLength(4)
    expect(aCases).toHaveLength(4)
  })

  it('runs canary suite and verifies all 12 cases pass with zero regressions', async () => {
    const summary = await runCanary()
    expect(summary.total).toBe(12)
    expect(summary.passed).toBe(12)
    expect(summary.failed).toBe(0)

    for (const r of summary.results) {
      expect(r.matched).toBe(true)
    }
  })

  it('exposes last canary run result for health status reporting', () => {
    const last = getLastCanaryResult()
    expect(last).not.toBeNull()
    expect(last?.total).toBe(12)
    expect(last?.passed).toBe(12)
    expect(last?.at).toBeDefined()
  })
})
