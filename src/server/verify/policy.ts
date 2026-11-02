/**
 * POLICY ENGINE — the only place that determines payment decisions.
 *
 * This is a PURE function: no I/O, no DB, no PayPal, no AI.
 * Input: structured evidence from all 4 verification stages.
 * Output: PASS | REJECT | ESCALATE + reasons.
 *
 * Architecture rule: this file may only import from @/shared/* and local type files.
 * (Enforced by ESLint no-restricted-imports in eslint.config.mjs)
 */

export type DecisionInput = {
  // Stage 1: deterministic check results
  stage1: StageOneResult[]
  // Stage 2: rubric results from LLM (evidence already substring-verified)
  stage2: StageTwoResult[]
  // Stage 3: adversarial / injection detection
  stage3: StageThreeResult
  // Verification metadata
  confidence: number // 0–1, from Stage 2 LLM
  verifierConfidenceMin: number // from contract policy
  degraded: boolean // LLM was unavailable
}

export type StageOneResult = {
  criterion_key: string
  check_name: string
  required: boolean
  passed: boolean
  reason?: string
}

export type StageTwoResult = {
  criterion_key: string
  required: boolean
  pass_threshold: number
  score: number // 0–1
  evidence: string // quoted substring from artifact
  evidence_verified: boolean // substring check passed
  reason?: string
}

export type StageThreeResult = {
  manipulation_severity: 'none' | 'low' | 'high'
  spans?: string[]
}

export type DecisionOutput = {
  decision: 'PASS' | 'REJECT' | 'ESCALATE'
  reasons: Reason[]
  confidence?: number
  manipulation_severity: 'none' | 'low' | 'high'
}

export type Reason = {
  code: ReasonCode
  criterion_key?: string
  message: string
}

export type ReasonCode =
  | 'DET_FAIL'          // deterministic required criterion failed
  | 'RUBRIC_FAIL'       // rubric criterion below threshold
  | 'EVIDENCE_UNVERIFIED' // LLM evidence quote not found in artifact
  | 'INJECTION_HIGH'    // high-severity manipulation detected
  | 'INJECTION_LOW'     // low-severity manipulation detected (info only)
  | 'LOW_CONFIDENCE'    // LLM confidence below policy minimum
  | 'DEGRADED'          // LLM unavailable; escalating for human
  | 'ALL_PASSED'        // everything passed

// ---------------------------------------------------------------------------
// The core decision function
// ---------------------------------------------------------------------------

/**
 * decide() is deterministic: same inputs → same output, always.
 * AI reads and explains; this code decides.
 */
export function decide(input: DecisionInput): DecisionOutput {
  const reasons: Reason[] = []
  const { stage1, stage2, stage3, confidence, verifierConfidenceMin, degraded } = input

  // -------------------------------------------------------------------------
  // Rule 0: if the LLM was unavailable (degraded mode), escalate to human
  // -------------------------------------------------------------------------
  if (degraded) {
    return {
      decision: 'ESCALATE',
      reasons: [{ code: 'DEGRADED', message: 'LLM unavailable; escalating for human review.' }],
      manipulation_severity: stage3.manipulation_severity,
    }
  }

  // -------------------------------------------------------------------------
  // Rule 1: injection / manipulation
  // High severity → always reject, regardless of other checks
  // -------------------------------------------------------------------------
  if (stage3.manipulation_severity === 'high') {
    reasons.push({
      code: 'INJECTION_HIGH',
      message:
        'High-severity prompt injection or manipulation detected. Submission rejected to protect payment integrity.',
    })
    return {
      decision: 'REJECT',
      reasons,
      confidence,
      manipulation_severity: 'high',
    }
  }

  // Low severity → add info reason but continue evaluating
  if (stage3.manipulation_severity === 'low') {
    reasons.push({
      code: 'INJECTION_LOW',
      message: 'Low-severity suspicious content detected. Proceeding with verification.',
    })
  }

  // -------------------------------------------------------------------------
  // Rule 2: deterministic required criteria
  // A single failed required deterministic check → REJECT
  // -------------------------------------------------------------------------
  for (const r of stage1) {
    if (r.required && !r.passed) {
      reasons.push({
        code: 'DET_FAIL',
        criterion_key: r.criterion_key,
        message: r.reason ?? `Required check '${r.check_name}' failed for ${r.criterion_key}.`,
      })
    }
  }

  // -------------------------------------------------------------------------
  // Rule 3: rubric criteria
  // Score below threshold on a required criterion → REJECT
  // Evidence not found in artifact → counts as a fail
  // -------------------------------------------------------------------------
  for (const r of stage2) {
    if (!r.evidence_verified) {
      if (r.required) {
        reasons.push({
          code: 'EVIDENCE_UNVERIFIED',
          criterion_key: r.criterion_key,
          message: `Evidence quote for ${r.criterion_key} could not be verified in the submission artifact.`,
        })
      }
      continue
    }

    if (r.required && r.score < r.pass_threshold) {
      reasons.push({
        code: 'RUBRIC_FAIL',
        criterion_key: r.criterion_key,
        message: `${r.criterion_key}: score ${r.score.toFixed(2)} below required threshold ${r.pass_threshold.toFixed(2)}.${
          r.reason ? ' ' + r.reason : ''
        }`,
      })
    }
  }

  // -------------------------------------------------------------------------
  // Rule 4: confidence gate
  // LLM confidence too low → escalate (human review)
  // Only applies if rubric criteria exist
  // -------------------------------------------------------------------------
  const hasRubric = stage2.length > 0
  if (hasRubric && confidence < verifierConfidenceMin) {
    reasons.push({
      code: 'LOW_CONFIDENCE',
      message: `Verifier confidence ${confidence.toFixed(2)} is below policy minimum ${verifierConfidenceMin.toFixed(2)}. Escalating for human review.`,
    })
    return {
      decision: 'ESCALATE',
      reasons,
      confidence,
      manipulation_severity: stage3.manipulation_severity,
    }
  }

  // -------------------------------------------------------------------------
  // Final decision
  // -------------------------------------------------------------------------
  const hasFails = reasons.some(
    (r) => r.code === 'DET_FAIL' || r.code === 'RUBRIC_FAIL' || r.code === 'EVIDENCE_UNVERIFIED'
  )

  if (hasFails) {
    return {
      decision: 'REJECT',
      reasons,
      confidence,
      manipulation_severity: stage3.manipulation_severity,
    }
  }

  // All checks passed
  if (reasons.length === 0) {
    reasons.push({ code: 'ALL_PASSED', message: 'All required criteria passed.' })
  }

  return {
    decision: 'PASS',
    reasons,
    confidence,
    manipulation_severity: stage3.manipulation_severity,
  }
}
