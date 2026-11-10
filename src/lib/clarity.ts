/**
 * Criteria Clarity Score & Dispute-Risk Estimator.
 * Implements docs/v2/PROOFPAY-WINNING-PLAN.md B5.
 */

export interface ClarityScoreResult {
  score: number // 0 - 100
  rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'RISKY'
  disputeRisk: 'LOW' | 'MEDIUM' | 'HIGH'
  reasons: string[]
  metrics: {
    totalCriteria: number
    deterministicCriteria: number
    deterministicPct: number
    vagueTermsFound: number
    hasDeterministicBackstop: boolean
    deadlineSafe: boolean
  }
}

const VAGUE_TERMS_REGEX = /\b(fast|scalable|clean code|best effort|production ready|high quality|reasonable|as appropriate|user friendly)\b/i

export function computeClarityScore(contract: any): ClarityScoreResult {
  const reasons: string[] = []
  let score = 100

  const milestones = contract?.milestones || []
  if (milestones.length === 0) {
    return {
      score: 50,
      rating: 'FAIR',
      disputeRisk: 'HIGH',
      reasons: ['Contract has no milestones defined yet.'],
      metrics: {
        totalCriteria: 0,
        deterministicCriteria: 0,
        deterministicPct: 0,
        vagueTermsFound: 0,
        hasDeterministicBackstop: false,
        deadlineSafe: true,
      },
    }
  }

  let totalCriteria = 0
  let deterministicCriteria = 0
  let vagueTermsCount = 0
  let allMilestonesHaveBackstop = true
  let deadlineSafe = true

  for (const m of milestones) {
    const criteria = m.criteria || []
    let milestoneDeterministicCount = 0

    const dueDays = m.due_in_days ?? m.due_days
    if (dueDays && dueDays > 28) {
      deadlineSafe = false
      score -= 20
      reasons.push(`Milestone '${m.title || m.milestone_key}' due days (${dueDays}d) exceeds PayPal's 29-day hold window.`)
    }

    if (VAGUE_TERMS_REGEX.test(m.deliverable?.description || m.description || '')) {
      vagueTermsCount++
    }

    for (const c of criteria) {
      totalCriteria++
      if (c.type === 'deterministic' || c.checker || c.json_schema || c.regex || c.row_count || c.word_count) {
        deterministicCriteria++
        milestoneDeterministicCount++
      } else {
        // Rubric / subjective
        if (VAGUE_TERMS_REGEX.test(c.statement || c.description || '')) {
          vagueTermsCount++
        }
      }
    }

    if (milestoneDeterministicCount === 0 && criteria.length > 0) {
      allMilestonesHaveBackstop = false
      score -= 15
      reasons.push(`Milestone '${m.title || m.milestone_key}' relies solely on subjective criteria with no deterministic backstop.`)
    }
  }

  // Factor in deterministic percentage
  const deterministicPct = totalCriteria > 0 ? Math.round((deterministicCriteria / totalCriteria) * 100) : 0
  if (deterministicPct < 50 && totalCriteria > 0) {
    score -= 25
    reasons.push(`Only ${deterministicPct}% of criteria are deterministic. Aim for ≥ 75% for automated settlement.`)
  } else if (deterministicPct < 80 && totalCriteria > 0) {
    score -= 10
    reasons.push(`${deterministicPct}% of criteria are deterministic. Adding schema or regex bounds improves clarity.`)
  }

  // Factor in vague terms
  if (vagueTermsCount > 0) {
    const penalty = Math.min(25, vagueTermsCount * 8)
    score -= penalty
    reasons.push(`Found ${vagueTermsCount} vague term(s) (e.g. 'clean code', 'fast'). Replace with measurable thresholds.`)
  }

  // Amount sanity
  const totalMinor = contract.total_minor || 0
  const milestoneSum = milestones.reduce((sum: number, m: any) => sum + (m.amount_minor || 0), 0)
  if (totalMinor > 0 && milestoneSum !== totalMinor) {
    score -= 20
    reasons.push(`Milestone amounts ($${(milestoneSum / 100).toFixed(2)}) do not match contract total ($${(totalMinor / 100).toFixed(2)}).`)
  }

  const finalScore = Math.max(10, Math.min(100, score))

  let rating: ClarityScoreResult['rating'] = 'EXCELLENT'
  let disputeRisk: ClarityScoreResult['disputeRisk'] = 'LOW'

  if (finalScore < 60) {
    rating = 'RISKY'
    disputeRisk = 'HIGH'
  } else if (finalScore < 80) {
    rating = 'FAIR'
    disputeRisk = 'MEDIUM'
  } else if (finalScore < 90) {
    rating = 'GOOD'
    disputeRisk = 'LOW'
  }

  if (reasons.length === 0) {
    reasons.push('Contract criteria are clear, deterministic, and safe against hold expiration.')
  }

  return {
    score: finalScore,
    rating,
    disputeRisk,
    reasons,
    metrics: {
      totalCriteria,
      deterministicCriteria,
      deterministicPct,
      vagueTermsFound: vagueTermsCount,
      hasDeterministicBackstop: allMilestonesHaveBackstop,
      deadlineSafe,
    },
  }
}

