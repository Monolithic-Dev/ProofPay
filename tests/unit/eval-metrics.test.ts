/**
 * Unit tests for Eval Metrics calculation.
 * Implements phase-8-testing-and-hardening.md §8.1.
 */
import { describe, it, expect } from 'vitest'
import {
  computeMetrics,
  isExpectationSatisfied,
  computeRuleOfThree,
  computePercentile,
  type EvalCaseResult,
} from '../eval/metrics'

describe('Eval Metrics Engine (§8.1)', () => {
  it('false pass counts PASS on a non-PASS expectation', () => {
    const cases: EvalCaseResult[] = [
      {
        id: 'F01',
        group: 'F',
        milestone: 'm1',
        expected: 'REJECT',
        decision: 'PASS', // False pass!
        reasons: [],
        latency_ms: 100,
        cost_usd: 0.01,
        raw_quotes_count: 2,
        verified_quotes_count: 2,
      },
      {
        id: 'F02',
        group: 'F',
        milestone: 'm1',
        expected: 'REJECT',
        decision: 'REJECT', // True negative
        reasons: ['Row count mismatch'],
        latency_ms: 120,
        cost_usd: 0.01,
        raw_quotes_count: 0,
        verified_quotes_count: 0,
      },
    ]

    const metrics = computeMetrics(cases)
    expect(metrics.false_passes).toBe(1)
    expect(metrics.false_pass_denominator).toBe(2)
    expect(metrics.false_pass_rate).toBe(0.5)
  })

  it('REJECT_OR_ESCALATE accepts either', () => {
    expect(isExpectationSatisfied('REJECT_OR_ESCALATE', 'REJECT')).toBe(true)
    expect(isExpectationSatisfied('REJECT_OR_ESCALATE', 'ESCALATE')).toBe(true)
    expect(isExpectationSatisfied('REJECT_OR_ESCALATE', 'PASS')).toBe(false)
  })

  it('F10 excluded from false-pass denominator', () => {
    const cases: EvalCaseResult[] = [
      {
        id: 'F01',
        group: 'F',
        milestone: 'm1',
        expected: 'REJECT',
        decision: 'REJECT',
        reasons: ['F01 fail'],
        latency_ms: 100,
        cost_usd: 0.01,
        raw_quotes_count: 0,
        verified_quotes_count: 0,
      },
      {
        id: 'F10',
        group: 'F',
        milestone: 'm1',
        expected: 'PASS', // documented optional criterion case
        decision: 'PASS',
        reasons: [],
        latency_ms: 150,
        cost_usd: 0.01,
        raw_quotes_count: 1,
        verified_quotes_count: 1,
      },
    ]

    const metrics = computeMetrics(cases)
    // F10 is excluded from false-pass denominator
    expect(metrics.false_pass_denominator).toBe(1)
    expect(metrics.false_passes).toBe(0)
    expect(metrics.satisfied_count).toBe(2)
  })

  it('rule of three computed as 3/n', () => {
    expect(computeRuleOfThree(19)).toBeCloseTo(3 / 19, 4)
    expect(computeRuleOfThree(30)).toBe(0.1)
    expect(computeRuleOfThree(0)).toBe(0)
  })

  it('p95 latency computed accurately', () => {
    // 20 elements from 100 to 2000 ms
    const latencies = Array.from({ length: 20 }, (_, i) => (i + 1) * 100)
    const cases: EvalCaseResult[] = latencies.map((lat, idx) => ({
      id: `P${idx + 1}`,
      group: 'P',
      milestone: 'm1',
      expected: 'PASS',
      decision: 'PASS',
      reasons: [],
      latency_ms: lat,
      cost_usd: 0.01,
      raw_quotes_count: 0,
      verified_quotes_count: 0,
    }))

    const metrics = computeMetrics(cases)
    expect(metrics.latency_p50_ms).toBe(1000)
    expect(metrics.latency_p95_ms).toBe(1900)
    expect(computePercentile([10, 20, 30, 40, 50], 50)).toBe(30)
  })
})
