/**
 * Wilson Score Confidence Interval & Rule of Three.
 * Implements AIP-14 statistical rigor requirement.
 */

export interface ConfidenceInterval {
  center: number
  low: number
  high: number
  rule_of_three_upper?: number
}

/**
 * Computes Wilson score interval for a binomial proportion at 95% confidence (z = 1.96).
 *
 * @param k Number of positive events (e.g. false passes or successes)
 * @param n Total sample size
 * @param z Standard normal deviate (default 1.95996 for 95% two-sided CI)
 */
export function wilsonInterval(
  k: number,
  n: number,
  z: number = 1.95996398454
): ConfidenceInterval {
  if (n <= 0) {
    return { center: 0, low: 0, high: 0, rule_of_three_upper: 0 }
  }

  const p = Math.max(0, Math.min(1, k / n))
  const z2 = z * z
  const denom = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denom
  const radicand = (p * (1 - p)) / n + z2 / (4 * n * n)
  const margin = (z * Math.sqrt(Math.max(0, radicand))) / denom

  const low = Math.max(0, center - margin)
  const high = Math.min(1, center + margin)

  const ruleOfThree = k === 0 ? Math.min(1, 3 / n) : undefined

  return {
    center,
    low,
    high,
    rule_of_three_upper: ruleOfThree,
  }
}

/**
 * Formats a proportion and its Wilson 95% confidence interval as percentage string.
 * e.g., "0.0% [0.0%, 15.8%]" or "100.0% [96.2%, 100.0%]"
 */
export function formatConfidenceInterval(
  k: number,
  n: number,
  digits: number = 1
): string {
  if (n === 0) return '0.0%'
  const p = (k / n) * 100
  const ci = wilsonInterval(k, n)
  const low = (ci.low * 100).toFixed(digits)
  const high = (ci.high * 100).toFixed(digits)
  return `${p.toFixed(digits)}% [${low}%, ${high}%]`
}

