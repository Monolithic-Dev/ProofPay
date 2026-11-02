/**
 * Policy engine — determines the definitive verification decision from multi-stage evidence.
 *
 * ARCHITECTURE INVARIANT: Pure function only.
 * No I/O, no DB calls, no network requests, no LLM calls.
 * Implements phase-4-verification-engine.md §4.6 & ai-pipeline.md §3 Stage 4.
 */

export type ReasonCode =
  | 'DET_FAIL'
  | 'MANIPULATION_DETECTED'
  | 'RUBRIC_FAIL'
  | 'LOW_CONFIDENCE'
  | 'VERIFIER_UNAVAILABLE'
  | 'POSSIBLE_MANIPULATION'
  | 'HUMAN_SIGNOFF_REQUIRED'
  | 'OPTIONAL_WARNING'
  | 'INJECTION_HIGH'
  | 'INJECTION_LOW'
  | 'EVIDENCE_UNVERIFIED'
  | 'DEGRADED'
  | 'ALL_PASSED'

export interface Reason {
  code: ReasonCode
  criterion_key?: string
  message: string
}

export interface Stage1CheckResult {
  criterion_key: string
  status?: 'pass' | 'fail'
  message?: string
  check_name?: string
  required?: boolean
  passed?: boolean
  reason?: string
}

export interface Stage2RubricResult {
  criterion_key: string
  verdict?: 'pass' | 'fail' | 'cannot_verify'
  score: number
  confidence?: number
  evidence_verified?: boolean
  reasoning?: string
  required?: boolean
  pass_threshold?: number
  evidence?: string
  reason?: string
}

export interface Stage3AdversarialResult {
  severity?: 'none' | 'low' | 'high'
  spans?: Array<{ quote: string; reason?: string } | string>
  manipulation_severity?: 'none' | 'low' | 'high'
}

export interface PolicyCriterion {
  key: string
  type: 'deterministic' | 'rubric' | 'human' | string
  required: boolean
  pass_threshold?: number
}

export interface PolicyInput {
  stage1: Stage1CheckResult[]
  stage2: Stage2RubricResult[] | null
  stage3: Stage3AdversarialResult
  criteria?: PolicyCriterion[]
  degraded: boolean
  confidenceMin?: number
  confidence?: number
  verifierConfidenceMin?: number
}

export interface PolicyOutput {
  decision: 'PASS' | 'REJECT' | 'ESCALATE'
  reasons: Reason[]
  confidence?: number
  manipulation_severity?: 'none' | 'low' | 'high'
}

// Backward-compatible type aliases
export type DecisionInput = PolicyInput
export type StageOneResult = Stage1CheckResult
export type StageTwoResult = Stage2RubricResult
export type StageThreeResult = Stage3AdversarialResult
export type DecisionOutput = PolicyOutput

/**
 * Evaluates rules 1–8 strictly in order to produce a deterministic verdict.
 */
export function decide(input: PolicyInput): PolicyOutput {
  const { stage1, stage2, stage3, degraded } = input
  const criteria = input.criteria ?? []
  const confidenceMin = input.confidenceMin ?? input.verifierConfidenceMin ?? 0.6
  const severity = stage3.severity ?? stage3.manipulation_severity ?? 'none'

  const reasons: Reason[] = []

  const critMap = new Map<string, PolicyCriterion>()
  for (const c of criteria) {
    critMap.set(c.key, c)
  }

  // ---------------------------------------------------------------------------
  // Rule 1: Any REQUIRED deterministic criterion fails → REJECT
  // ---------------------------------------------------------------------------
  const detFailures = stage1.filter((r) => {
    const isRequired = r.required ?? critMap.get(r.criterion_key)?.required ?? true
    const isFailed = r.passed !== undefined ? !r.passed : r.status === 'fail'
    return isRequired && isFailed
  })

  if (detFailures.length > 0) {
    for (const f of detFailures) {
      reasons.push({
        code: 'DET_FAIL',
        criterion_key: f.criterion_key,
        message: f.message || f.reason || `Deterministic check failed for ${f.criterion_key}.`,
      })
    }
    return {
      decision: 'REJECT',
      reasons,
      confidence: input.confidence,
      manipulation_severity: severity,
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 2: stage3.severity === 'high' → REJECT with MANIPULATION_DETECTED
  // ---------------------------------------------------------------------------
  if (severity === 'high') {
    reasons.push({
      code: 'MANIPULATION_DETECTED',
      message: 'High-severity prompt injection or evaluation manipulation detected in submission.',
    })
    return {
      decision: 'REJECT',
      reasons,
      confidence: input.confidence,
      manipulation_severity: 'high',
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 3: Any REQUIRED rubric criterion fails → REJECT
  // (verdict === 'fail' after threshold and evidence verification checks)
  // ---------------------------------------------------------------------------
  if (stage2) {
    const rubricFailures = stage2.filter((r) => {
      const isRequired = r.required ?? critMap.get(r.criterion_key)?.required ?? true
      const threshold = r.pass_threshold ?? critMap.get(r.criterion_key)?.pass_threshold ?? 0.7
      const evidenceFailed = r.evidence_verified === false
      const scoreFailed = r.score < threshold
      const verdictFailed = r.verdict === 'fail'
      return isRequired && (verdictFailed || evidenceFailed || scoreFailed)
    })

    if (rubricFailures.length > 0) {
      for (const f of rubricFailures) {
        reasons.push({
          code: 'RUBRIC_FAIL',
          criterion_key: f.criterion_key,
          message: f.reasoning ?? f.reason ?? `Required rubric criterion '${f.criterion_key}' failed evaluation.`,
        })
      }
      return {
        decision: 'REJECT',
        reasons,
        confidence: input.confidence,
        manipulation_severity: severity,
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 4: If degraded OR any REQUIRED rubric is 'cannot_verify' OR confidence < min → ESCALATE
  // ---------------------------------------------------------------------------
  const hasRequiredRubric = criteria.length > 0
    ? criteria.some((c) => c.type === 'rubric' && c.required)
    : (stage2 && stage2.length > 0)

  if (degraded && hasRequiredRubric) {
    reasons.push({
      code: 'VERIFIER_UNAVAILABLE',
      message: 'AI verifier was unavailable or daily LLM budget exhausted. Escalating for human review.',
    })
    return {
      decision: 'ESCALATE',
      reasons,
      confidence: input.confidence,
      manipulation_severity: severity,
    }
  }

  if (stage2) {
    for (const r of stage2) {
      const isRequired = r.required ?? critMap.get(r.criterion_key)?.required ?? true
      if (isRequired) {
        if (r.verdict === 'cannot_verify') {
          reasons.push({
            code: 'LOW_CONFIDENCE',
            criterion_key: r.criterion_key,
            message: `Criterion '${r.criterion_key}' could not be verified from submitted artifact evidence.`,
          })
          return {
            decision: 'ESCALATE',
            reasons,
            confidence: r.confidence,
            manipulation_severity: severity,
          }
        }

        const conf = r.confidence ?? 1.0
        if (conf < confidenceMin) {
          reasons.push({
            code: 'LOW_CONFIDENCE',
            criterion_key: r.criterion_key,
            message: `Evaluation confidence (${conf.toFixed(2)}) is below required threshold (${confidenceMin.toFixed(2)}).`,
          })
          return {
            decision: 'ESCALATE',
            reasons,
            confidence: conf,
            manipulation_severity: severity,
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 5: stage3.severity === 'low' → ESCALATE with POSSIBLE_MANIPULATION
  // ---------------------------------------------------------------------------
  if (severity === 'low') {
    reasons.push({
      code: 'POSSIBLE_MANIPULATION',
      message: 'Suspicious instruction pattern or adversarial markers detected. Escalating for human review.',
    })
    return {
      decision: 'ESCALATE',
      reasons,
      confidence: input.confidence,
      manipulation_severity: 'low',
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 6: Any REQUIRED human criterion → ESCALATE with HUMAN_SIGNOFF_REQUIRED
  // ---------------------------------------------------------------------------
  const humanCriteria = criteria.filter((c) => c.type === 'human' && c.required)
  if (humanCriteria.length > 0) {
    for (const h of humanCriteria) {
      reasons.push({
        code: 'HUMAN_SIGNOFF_REQUIRED',
        criterion_key: h.key,
        message: `Criterion '${h.key}' requires explicit human sign-off per contract terms.`,
      })
    }
    return {
      decision: 'ESCALATE',
      reasons,
      confidence: input.confidence,
      manipulation_severity: severity,
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 7: Optional (non-required) criterion failures do NOT block (OPTIONAL_WARNING)
  // ---------------------------------------------------------------------------
  for (const s1 of stage1) {
    const isRequired = s1.required ?? critMap.get(s1.criterion_key)?.required ?? false
    const isFailed = s1.passed !== undefined ? !s1.passed : s1.status === 'fail'
    if (!isRequired && isFailed) {
      reasons.push({
        code: 'OPTIONAL_WARNING',
        criterion_key: s1.criterion_key,
        message: `Optional check '${s1.criterion_key}' did not pass: ${s1.message || s1.reason || ''}`,
      })
    }
  }

  if (stage2) {
    for (const s2 of stage2) {
      const isRequired = s2.required ?? critMap.get(s2.criterion_key)?.required ?? false
      if (!isRequired && s2.verdict !== 'pass') {
        reasons.push({
          code: 'OPTIONAL_WARNING',
          criterion_key: s2.criterion_key,
          message: `Optional rubric '${s2.criterion_key}' did not pass (${s2.verdict}).`,
        })
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 8: Otherwise → PASS
  // ---------------------------------------------------------------------------
  return {
    decision: 'PASS',
    reasons,
    confidence:
      stage2 && stage2.length > 0
        ? Math.min(...stage2.map((s) => s.confidence ?? 1.0))
        : input.confidence,
    manipulation_severity: severity,
  }
}
