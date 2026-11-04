/**
 * Bounded Agent Negotiation & Mandates Policy Engine.
 * Implements docs/v2/01-NEXT-LEVEL-STRATEGY.md U4 & F5.
 *
 * Enforces strict financial, temporal, and quality guardrails so autonomous agents
 * can negotiate terms without exceeding human-set authority or weakening criteria.
 */

export interface BuyerMandate {
  max_total_minor: number
  max_milestones: number
  max_due_days: number
  required_criteria_keys: string[]
}

export interface SellerMandate {
  min_total_minor: number
  min_due_days: number
  max_revisions_allowed: number
}

export interface ContractOfferProposal {
  proposer_role: 'buyer' | 'seller'
  total_minor: number
  due_days: number
  milestones_count: number
  criteria_keys: string[]
  rationale?: string
}

export interface PolicyCheckResult {
  allowed: boolean
  violations: string[]
}

export function validateBuyerOfferAgainstMandate(
  offer: ContractOfferProposal,
  mandate: BuyerMandate
): PolicyCheckResult {
  const violations: string[] = []

  if (offer.total_minor > mandate.max_total_minor) {
    violations.push(
      `Proposed amount \$${(offer.total_minor / 100).toFixed(2)} exceeds buyer mandate maximum of \$${(
        mandate.max_total_minor / 100
      ).toFixed(2)}.`
    )
  }

  if (offer.due_days > mandate.max_due_days) {
    violations.push(
      `Proposed delivery timeframe (${offer.due_days} days) exceeds buyer mandate maximum of ${mandate.max_due_days} days.`
    )
  }

  if (offer.milestones_count > mandate.max_milestones) {
    violations.push(
      `Milestone count (${offer.milestones_count}) exceeds buyer limit of ${mandate.max_milestones}.`
    )
  }

  // Ensure required criteria are never removed by negotiation
  for (const reqKey of mandate.required_criteria_keys) {
    if (!offer.criteria_keys.includes(reqKey)) {
      violations.push(`Mandated quality criterion "${reqKey}" cannot be removed by an agent offer.`)
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
  }
}

export function validateSellerOfferAgainstMandate(
  offer: ContractOfferProposal,
  mandate: SellerMandate
): PolicyCheckResult {
  const violations: string[] = []

  if (offer.total_minor < mandate.min_total_minor) {
    violations.push(
      `Proposed amount \$${(offer.total_minor / 100).toFixed(2)} is below seller mandate minimum of \$${(
        mandate.min_total_minor / 100
      ).toFixed(2)}.`
    )
  }

  if (offer.due_days < mandate.min_due_days) {
    violations.push(
      `Proposed delivery timeframe (${offer.due_days} days) is shorter than seller required minimum of ${mandate.min_due_days} days.`
    )
  }

  return {
    allowed: violations.length === 0,
    violations,
  }
}
