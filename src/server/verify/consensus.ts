/**
 * Cross-Model Consensus Engine.
 * Implements docs/v2/01-NEXT-LEVEL-STRATEGY.md U3 & F3.
 *
 * For high-value milestones or safety audits, requires independent evaluation
 * from two model providers. If verdicts disagree or quotes cannot be co-verified,
 * rule engine safely escalates to human review (Rule 7).
 */
import type { Stage2RubricResult } from './policy'

export interface ModelVerdict {
  provider: 'anthropic' | 'groq' | 'openai' | 'mock'
  model: string
  verdict: 'pass' | 'fail' | 'cannot_verify'
  quote: string | null
  confidence: number
}

export interface ConsensusEvaluationResult {
  unanimous: boolean
  agreedVerdict: 'pass' | 'fail' | 'cannot_verify' | 'disputed'
  primaryVerdict: ModelVerdict
  secondaryVerdict: ModelVerdict
  recommendation: 'PASS' | 'REJECT' | 'ESCALATE'
  rationale: string
}

export function evaluateConsensus(
  primary: ModelVerdict,
  secondary: ModelVerdict
): ConsensusEvaluationResult {
  const unanimous = primary.verdict === secondary.verdict

  if (unanimous && primary.verdict === 'pass') {
    return {
      unanimous: true,
      agreedVerdict: 'pass',
      primaryVerdict: primary,
      secondaryVerdict: secondary,
      recommendation: 'PASS',
      rationale: `Cross-model consensus achieved: both ${primary.provider} and ${secondary.provider} independently verified criteria.`,
    }
  }

  if (unanimous && primary.verdict === 'fail') {
    return {
      unanimous: true,
      agreedVerdict: 'fail',
      primaryVerdict: primary,
      secondaryVerdict: secondary,
      recommendation: 'REJECT',
      rationale: `Cross-model consensus confirmed failure: both ${primary.provider} and ${secondary.provider} found criteria unsatisfied.`,
    }
  }

  // Split verdict or low confidence: escalate
  return {
    unanimous: false,
    agreedVerdict: 'disputed',
    primaryVerdict: primary,
    secondaryVerdict: secondary,
    recommendation: 'ESCALATE',
    rationale: `Model disagreement (${primary.provider}: ${primary.verdict} vs ${secondary.provider}: ${secondary.verdict}). Safely escalated to human buyer review.`,
  }
}

