/**
 * Deterministic lint rules engine for ProofPay contracts.
 * Implements phase-3-auth-and-contracts.md §3.7 & PRD FR-4…FR-7.
 */
import { sha256Hex } from '@/server/contracts/canonical'
import { findVagueTerms } from './vague-terms'
import type { LintIssue } from '@/shared/types'

export interface LintOptions {
  budgetCapMinor?: number
}

export function runDeterministicLint(contract: any, options?: LintOptions): LintIssue[] {
  const issues: LintIssue[] = []

  function addIssue(params: {
    code: string
    severity: 'error' | 'warn' | 'info'
    path: string
    message: string
    fix?: string
  }) {
    const id = sha256Hex(`${params.code}:${params.path}`).slice(0, 10)
    issues.push({
      code: params.code,
      severity: params.severity,
      path: params.path,
      message: params.message,
      fix: params.fix,
    })
  }

  if (!contract || typeof contract !== 'object') {
    addIssue({
      code: 'LINT_INVALID_STRUCTURE',
      severity: 'error',
      path: '/',
      message: 'Contract must be a valid JSON object',
    })
    return issues
  }

  // 1. LINT_SUM_MISMATCH & LINT_BUDGET_EXCEEDS_CAP
  const milestones = Array.isArray(contract.milestones) ? contract.milestones : []
  const milestoneSum = milestones.reduce((sum: number, m: any) => sum + (Number(m?.amount_minor) || 0), 0)

  if (contract.total_minor !== milestoneSum) {
    addIssue({
      code: 'LINT_SUM_MISMATCH',
      severity: 'error',
      path: '/total_minor',
      message: `total_minor (${contract.total_minor}) does not equal sum of milestones (${milestoneSum})`,
      fix: JSON.stringify([{ op: 'replace', path: '/total_minor', value: milestoneSum }]),
    })
  }

  if (options?.budgetCapMinor && contract.total_minor > options.budgetCapMinor) {
    addIssue({
      code: 'LINT_BUDGET_EXCEEDS_CAP',
      severity: 'error',
      path: '/total_minor',
      message: `total_minor (${contract.total_minor}) exceeds the requested budget cap (${options.budgetCapMinor})`,
    })
  }

  // 2. Scan milestones
  milestones.forEach((m: any, mIdx: number) => {
    const mPath = `/milestones/${mIdx}`

    // LINT_DURATION
    if (m?.due_in_days > 28) {
      addIssue({
        code: 'LINT_DURATION',
        severity: 'error',
        path: `${mPath}/due_in_days`,
        message: `Milestone due_in_days (${m.due_in_days}) exceeds maximum allowed 28 days`,
        fix: JSON.stringify([{ op: 'replace', path: `${mPath}/due_in_days`, value: 28 }]),
      })
    }

    // Deliverable check
    if (!m?.deliverable?.description) {
      addIssue({
        code: 'LINT_MISSING_DELIVERABLE_SPEC',
        severity: 'error',
        path: `${mPath}/deliverable/description`,
        message: 'Milestone deliverable description is required',
      })
    }

    const criteriaList = Array.isArray(m?.criteria) ? m.criteria : []

    // LINT_NO_REQUIRED_CRITERION
    const hasRequired = criteriaList.some((c: any) => c?.required === true)
    if (!hasRequired) {
      addIssue({
        code: 'LINT_NO_REQUIRED_CRITERION',
        severity: 'error',
        path: `${mPath}/criteria`,
        message: `Milestone '${m?.key || mIdx}' has no required criteria; at least one required criterion is needed`,
      })
    }

    // Scan individual criteria
    criteriaList.forEach((c: any, cIdx: number) => {
      const cPath = `${mPath}/criteria/${cIdx}`

      // LINT_RUBRIC_NO_THRESHOLD
      if (c?.type === 'rubric' && (c?.pass_threshold === undefined || c?.pass_threshold === null)) {
        addIssue({
          code: 'LINT_RUBRIC_NO_THRESHOLD',
          severity: 'warn',
          path: `${cPath}/pass_threshold`,
          message: 'Rubric criterion is missing pass_threshold (defaults to 0.70)',
          fix: JSON.stringify([{ op: 'add', path: `${cPath}/pass_threshold`, value: 0.7 }]),
        })
      }

      // LINT_RUBRIC_TOO_LONG
      if (c?.type === 'rubric' && c?.statement && c.statement.length > 300) {
        addIssue({
          code: 'LINT_RUBRIC_TOO_LONG',
          severity: 'error',
          path: `${cPath}/statement`,
          message: `Rubric statement exceeds 300 characters (${c.statement.length})`,
        })
      }

      // LINT_HUMAN_BLOCKS_AUTORELEASE
      if (c?.type === 'human') {
        addIssue({
          code: 'LINT_HUMAN_BLOCKS_AUTORELEASE',
          severity: 'info',
          path: `${cPath}`,
          message: 'Human review criterion requires manual buyer review and disables auto-release for this milestone',
        })
      }

      // LINT_UNKNOWN_CHECK
      const VALID_CHECKS = [
        'json_schema',
        'row_count',
        'unique_field',
        'regex_field',
        'word_count',
        'required_keywords',
      ]
      if (c?.type === 'deterministic' && c?.check && !VALID_CHECKS.includes(c.check)) {
        addIssue({
          code: 'LINT_UNKNOWN_CHECK',
          severity: 'error',
          path: `${cPath}/check`,
          message: `Unknown deterministic check '${c.check}'. Supported: ${VALID_CHECKS.join(', ')}`,
        })
      }

      // LINT_VAGUE_TERM in criteria descriptions / statements
      const textToScan = c?.statement || c?.description || ''
      const vagueMatches = findVagueTerms(textToScan)
      for (const match of vagueMatches) {
        addIssue({
          code: 'LINT_VAGUE_TERM',
          severity: 'error',
          path: `${cPath}/${c?.statement ? 'statement' : 'description'}`,
          message: `Subjective term '${match.term}' found in acceptance criteria. Replace with measurable, quantified requirements.`,
        })
      }
    })
  })

  // Scan contract summary for vague terms (warn only, not error)
  if (contract?.summary) {
    const summaryVague = findVagueTerms(contract.summary)
    for (const match of summaryVague) {
      addIssue({
        code: 'LINT_VAGUE_TERM',
        severity: 'warn',
        path: '/summary',
        message: `Subjective term '${match.term}' in contract summary. Consider clarifying.`,
      })
    }
  }

  return issues
}
