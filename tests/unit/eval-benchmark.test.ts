import { describe, it, expect } from 'vitest'
import { generateAllCases, isHeldOut, ADVERSARIAL_FAMILIES } from '../eval/generate'
import { wilsonInterval, formatConfidenceInterval } from '@/lib/wilson'
import { scoreBenchmark } from '../../scripts/score-bench'
import { runExternalAttacks } from '../../scripts/run-external-attacks'

describe('AIP-14: 120-Case Benchmark, Statistics & Red Team', () => {
  it('generates exactly 120 cases deterministically', () => {
    const run1 = generateAllCases()
    const run2 = generateAllCases()

    expect(run1).toHaveLength(120)
    expect(run2).toHaveLength(120)

    const pCases = run1.filter((c) => c.group === 'P')
    const fCases = run1.filter((c) => c.group === 'F')
    const aCases = run1.filter((c) => c.group === 'A')

    expect(pCases).toHaveLength(30)
    expect(fCases).toHaveLength(30)
    expect(aCases).toHaveLength(60)

    // Verify determinism
    expect(run1[0]!.id).toBe('P01')
    expect(run1[0]!.artifact).toEqual(run2[0]!.artifact)
  })

  it('covers all 12 adversarial families with 5 cases each', () => {
    const cases = generateAllCases()
    const aCases = cases.filter((c) => c.group === 'A')

    expect(aCases).toHaveLength(60)
    expect(ADVERSARIAL_FAMILIES).toHaveLength(12)

    for (const fam of ADVERSARIAL_FAMILIES) {
      const match = aCases.filter((c) => c.notes?.includes(fam))
      expect(match.length).toBe(5)
    }
  })

  it('held-out split is stable, hash-based, and approximately 30%', () => {
    const cases = generateAllCases()
    const heldout = cases.filter((c) => isHeldOut(c.id))

    // In a uniform hash mod 10 < 3, expectation is ~30% (36 cases), tolerance 20-50
    expect(heldout.length).toBeGreaterThanOrEqual(20)
    expect(heldout.length).toBeLessThanOrEqual(50)

    // Repeat check to verify stability
    expect(isHeldOut('P01')).toBe(isHeldOut('P01'))
    expect(isHeldOut('A42')).toBe(isHeldOut('A42'))
  })

  it('computes Wilson confidence interval and rule of three correctly', () => {
    // k = 0, n = 30 -> rule of three = 3 / 30 = 0.10 (10%)
    const ciZero = wilsonInterval(0, 30)
    expect(ciZero.low).toBe(0)
    expect(ciZero.rule_of_three_upper).toBeCloseTo(0.1, 4)
    expect(ciZero.high).toBeLessThan(0.15)

    // k = 50, n = 100 -> ~50%
    const ciMid = wilsonInterval(50, 100)
    expect(ciMid.center).toBeCloseTo(0.5, 2)
    expect(ciMid.low).toBeGreaterThan(0.39)
    expect(ciMid.high).toBeLessThan(0.61)

    // formatConfidenceInterval
    const formatted = formatConfidenceInterval(0, 19)
    expect(formatted).toContain('0.0%')
    expect(formatted).toContain('[')
  })

  it('scores benchmark and verifies zero false passes on non-pass cases', () => {
    const summary = scoreBenchmark()
    expect(summary.total).toBe(120)
    expect(summary.falsePasses).toBe(0)
    expect(summary.falsePassRate).toBe(0)
    expect(summary.ruleOfThreeBound).toBeLessThanOrEqual(0.1)
  })

  it('external red team runner identifies and blocks attacks', async () => {
    const attacks = await runExternalAttacks()
    expect(attacks.length).toBeGreaterThan(0)
    for (const a of attacks) {
      expect(a.blocked).toBe(true)
      expect(a.decision).not.toBe('PASS')
    }
  })
})

