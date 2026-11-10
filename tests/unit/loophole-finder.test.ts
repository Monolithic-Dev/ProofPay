import { describe, it, expect } from 'vitest'
import {
  scanContractForLoopholes,
  DEMO_LOOPHOLE_PRESETS,
} from '@/server/contracts/loophole-finder'
import { applyPatchSafe } from '@/server/contracts/lint/patch'
import { parseContract } from '@/server/contracts/schema'

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
    expect(loophole?.patch_ops.length).toBeGreaterThan(0)
    expect(loophole?.retest_result.closed).toBe(true)
  })

  it('closes confirmed loopholes cleanly via RFC 6902 patch_ops on canonical ContractSchema contracts', async () => {
    const presetLoose = DEMO_LOOPHOLE_PRESETS[0]!
    let workingContract = parseContract(presetLoose.contract)

    const initialScan = await scanContractForLoopholes(workingContract)
    expect(initialScan.loopholes_confirmed).toBe(3)
    expect(
      initialScan.confirmed_loopholes.every((l) => l.retest_result.closed)
    ).toBe(true)

    // Progressively apply each confirmed loophole's RFC 6902 patch until 0 remain
    let currentScan = initialScan
    for (let guard = 0; guard < 5 && currentScan.loopholes_confirmed > 0; guard++) {
      const target = currentScan.confirmed_loopholes[0]!
      const patched = applyPatchSafe(workingContract, target.patch_ops)
      expect(patched.ok).toBe(true)
      expect(patched.contract).toBeDefined()
      workingContract = patched.contract!
      currentScan = await scanContractForLoopholes(workingContract)
    }

    expect(currentScan.loopholes_confirmed).toBe(0)
    expect(currentScan.summary_badge).toContain('0 loopholes confirmed')
  })

  it('reports zero confirmed loopholes on the hardened reference contract and text reports close via patches too', async () => {
    const hardened = DEMO_LOOPHOLE_PRESETS.find((p) => p.id === 'hardened_production')!
    const hardScan = await scanContractForLoopholes(hardened.contract)
    expect(hardScan.loopholes_confirmed).toBe(0)

    const textLoose = DEMO_LOOPHOLE_PRESETS.find((p) => p.id === 'security_report_loose')!
    let workingText = parseContract(textLoose.contract)
    let textScan = await scanContractForLoopholes(workingText)
    expect(textScan.loopholes_confirmed).toBeGreaterThan(0)

    for (let guard = 0; guard < 5 && textScan.loopholes_confirmed > 0; guard++) {
      const patched = applyPatchSafe(workingText, textScan.confirmed_loopholes[0]!.patch_ops)
      expect(patched.ok).toBe(true)
      workingText = patched.contract!
      textScan = await scanContractForLoopholes(workingText)
    }
    expect(textScan.loopholes_confirmed).toBe(0)
  })
})
