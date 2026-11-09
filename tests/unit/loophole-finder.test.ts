import { describe, it, expect } from 'vitest'
import { scanContractForLoopholes } from '@/server/contracts/loophole-finder'

describe('Loophole Finder Engine (N1)', () => {
  it('identifies confirmed loophole when contract criteria lack duplicate/junk protection', async () => {
    const looseContract = {
      id: 'c-loose',
      version: 1,
      milestones: [
        {
          deliverable_json: { type: 'json_records' },
          criteria: [
            {
              type: 'deterministic',
              check: 'row_count',
              spec: { min: 25 },
            },
          ],
        },
      ],
    }

    const scan = await scanContractForLoopholes(looseContract)

    expect(scan.attempts_tested).toBeGreaterThan(0)
    expect(scan.loopholes_confirmed).toBeGreaterThan(0)
    expect(scan.confirmed_loopholes.length).toBeGreaterThan(0)

    const loophole = scan.confirmed_loopholes[0]
    expect(loophole?.strategy_tag).toBe('repeated_rows')
    expect(loophole?.passed_criteria).toContain('row_count')
    expect(loophole?.closing_fix_description).toBeDefined()
    expect(loophole?.patch).toBeDefined()
  })

  it('reports zero confirmed loopholes when junk_detector filter is applied', async () => {
    const tightContract = {
      id: 'c-tight',
      version: 1,
      milestones: [
        {
          deliverable_json: { type: 'json_records' },
          criteria: [
            {
              type: 'deterministic',
              check: 'row_count',
              spec: { min: 25 },
            },
            {
              type: 'deterministic',
              check: 'unique_field',
              spec: { field: 'sku' },
            },
            {
              type: 'deterministic',
              check: 'junk_detector',
              spec: { max_duplicate_ratio: 0.1, max_placeholder_ratio: 0.05 },
            },
          ],
        },
      ],
    }

    const scan = await scanContractForLoopholes(tightContract)
    // The candidate duplicate artifact has duplicate SKUs, so unique_field blocks it
    const dupLoophole = scan.confirmed_loopholes.find((l) => l.strategy_tag === 'repeated_rows')
    expect(dupLoophole).toBeUndefined()
  })
})
