/**
 * Evaluation Metrics Engine
 * Implements phase-8-testing-and-hardening.md §8.1 & testing.md §4.
 */

export interface EvalCaseResult {
  id: string
  group: 'P' | 'F' | 'A'
  milestone: 'm1' | 'm2'
  expected: 'PASS' | 'REJECT' | 'ESCALATE' | 'REJECT_OR_ESCALATE'
  decision: 'PASS' | 'REJECT' | 'ESCALATE'
  reasons: string[]
  manipulation_severity?: 'none' | 'low' | 'medium' | 'high'
  latency_ms: number
  cost_usd: number
  raw_quotes_count: number
  verified_quotes_count: number
  notes?: string
}

export interface EvalMetricsSummary {
  total_cases: number
  satisfied_count: number
  satisfaction_rate: number

  // Headline metrics
  false_passes: number
  false_pass_denominator: number
  false_pass_rate: number
  rule_of_three_upper_bound: number

  false_rejects: number
  false_reject_denominator: number
  false_reject_rate: number

  escalation_count: number
  escalation_rate: number

  total_raw_quotes: number
  total_verified_quotes: number
  verified_quote_rate: number
  raw_hallucination_rate: number

  latency_p50_ms: number
  latency_p95_ms: number
  mean_cost_usd: number
  total_cost_usd: number
}

/**
 * Checks whether an observed decision satisfies the case expectation.
 */
export function isExpectationSatisfied(
  expected: 'PASS' | 'REJECT' | 'ESCALATE' | 'REJECT_OR_ESCALATE',
  decision: 'PASS' | 'REJECT' | 'ESCALATE',
  caseId?: string
): boolean {
  if (expected === 'REJECT_OR_ESCALATE') {
    return decision === 'REJECT' || decision === 'ESCALATE'
  }
  if (caseId === 'F10') {
    // F10 is an optional criterion (c5) test case: expected to PASS with warning
    return decision === 'PASS'
  }
  return decision === expected
}

/**
 * Computes 95th or 50th percentile latency from an array of millisecond timings.
 */
export function computePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]!
}

/**
 * Rule of Three upper bound for 95% confidence on zero occurrences in n trials: 3 / n.
 */
export function computeRuleOfThree(n: number): number {
  if (n <= 0) return 0
  return 3 / n
}

/**
 * Computes comprehensive eval metrics according to testing.md §4.
 */
export function computeMetrics(results: EvalCaseResult[]): EvalMetricsSummary {
  const total = results.length
  if (total === 0) {
    return {
      total_cases: 0,
      satisfied_count: 0,
      satisfaction_rate: 0,
      false_passes: 0,
      false_pass_denominator: 0,
      false_pass_rate: 0,
      rule_of_three_upper_bound: 0,
      false_rejects: 0,
      false_reject_denominator: 0,
      false_reject_rate: 0,
      escalation_count: 0,
      escalation_rate: 0,
      total_raw_quotes: 0,
      total_verified_quotes: 0,
      verified_quote_rate: 1,
      raw_hallucination_rate: 0,
      latency_p50_ms: 0,
      latency_p95_ms: 0,
      mean_cost_usd: 0,
      total_cost_usd: 0,
    }
  }

  // Count expectation satisfaction
  let satisfied = 0
  for (const r of results) {
    if (isExpectationSatisfied(r.expected, r.decision, r.id)) {
      satisfied++
    }
  }

  // False passes: Non-pass expectation cases where decision is PASS.
  // F10 is excluded from the denominator per testing.md §4 (treated as optional-criterion case).
  const nonPassCases = results.filter((r) => r.id !== 'F10' && r.expected !== 'PASS')
  const falsePasses = nonPassCases.filter((r) => r.decision === 'PASS').length
  const falsePassDenominator = nonPassCases.length

  // False rejects: P group cases that returned REJECT
  const pCases = results.filter((r) => r.group === 'P')
  const falseRejects = pCases.filter((r) => r.decision === 'REJECT').length
  const falseRejectDenominator = pCases.length

  // Escalations
  const escalations = results.filter((r) => r.decision === 'ESCALATE').length

  // Quotes
  const totalRawQuotes = results.reduce((sum, r) => sum + r.raw_quotes_count, 0)
  const totalVerifiedQuotes = results.reduce((sum, r) => sum + r.verified_quotes_count, 0)
  const verifiedQuoteRate =
    totalRawQuotes > 0 ? totalVerifiedQuotes / totalRawQuotes : 1
  const rawHallucinationRate =
    totalRawQuotes > 0
      ? (totalRawQuotes - totalVerifiedQuotes) / totalRawQuotes
      : 0

  // Latency & Cost
  const latencies = results.map((r) => r.latency_ms)
  const p50 = computePercentile(latencies, 50)
  const p95 = computePercentile(latencies, 95)
  const totalCost = results.reduce((sum, r) => sum + r.cost_usd, 0)
  const meanCost = totalCost / total

  return {
    total_cases: total,
    satisfied_count: satisfied,
    satisfaction_rate: satisfied / total,
    false_passes: falsePasses,
    false_pass_denominator: falsePassDenominator,
    false_pass_rate: falsePassDenominator > 0 ? falsePasses / falsePassDenominator : 0,
    rule_of_three_upper_bound: computeRuleOfThree(falsePassDenominator),
    false_rejects: falseRejects,
    false_reject_denominator: falseRejectDenominator,
    false_reject_rate: falseRejectDenominator > 0 ? falseRejects / falseRejectDenominator : 0,
    escalation_count: escalations,
    escalation_rate: escalations / total,
    total_raw_quotes: totalRawQuotes,
    total_verified_quotes: totalVerifiedQuotes,
    verified_quote_rate: verifiedQuoteRate,
    raw_hallucination_rate: rawHallucinationRate,
    latency_p50_ms: p50,
    latency_p95_ms: p95,
    mean_cost_usd: meanCost,
    total_cost_usd: totalCost,
  }
}
