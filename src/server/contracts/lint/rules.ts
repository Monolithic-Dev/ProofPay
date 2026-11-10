/**
 * Deterministic lint rules engine for ProofPay contracts.
 * Implements phase-3-auth-and-contracts.md §3.7 & PRD FR-4…FR-7,
 * and AIP-11 Satisfiability Linter.
 */
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

    // AIP-11: Cross-criteria checks per milestone
    let rowCountCheck: any = null
    let wordCountCheck: any = null
    let jsonSchemaCheck: any = null
    let uniqueFieldCheck: any = null
    let keywordsCheck: any = null
    let hasJunkFree = false

    // Scan individual criteria
    criteriaList.forEach((c: any, cIdx: number) => {
      const cPath = `${mPath}/criteria/${cIdx}`

      if (c?.type === 'deterministic') {
        if (c.check === 'row_count') rowCountCheck = c
        if (c.check === 'word_count') wordCountCheck = c
        if (c.check === 'json_schema') jsonSchemaCheck = c
        if (c.check === 'unique_field') uniqueFieldCheck = c
        if (c.check === 'required_keywords') keywordsCheck = c
        if (c.check === 'junk_free' || c.check === 'junk_detector') hasJunkFree = true
      }

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
        'junk_free',
        'junk_detector',
        'csv_schema',
        'forbidden_terms',
        'link_check',
      ]
      if (c?.type === 'deterministic' && c?.check && !VALID_CHECKS.includes(c.check)) {
        addIssue({
          code: 'LINT_UNKNOWN_CHECK',
          severity: 'error',
          path: `${cPath}/check`,
          message: `Unknown deterministic check '${c.check}'. Supported: ${VALID_CHECKS.join(', ')}`,
        })
      }

      // AIP-11: 1. LINT_UNSATISFIABLE_RANGE
      if (
        c?.type === 'deterministic' &&
        (c.check === 'row_count' || c.check === 'word_count') &&
        c.spec?.min !== undefined &&
        c.spec?.max !== undefined &&
        Number(c.spec.min) > Number(c.spec.max)
      ) {
        addIssue({
          code: 'LINT_UNSATISFIABLE_RANGE',
          severity: 'error',
          path: `${cPath}/spec`,
          message: `Unsatisfiable range: min (${c.spec.min}) cannot be greater than max (${c.spec.max})`,
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

    // AIP-11: 2. LINT_SCHEMA_COUNT_CONFLICT
    if (jsonSchemaCheck && rowCountCheck) {
      const schemaMin = jsonSchemaCheck.spec?.schema?.minItems
      const schemaMax = jsonSchemaCheck.spec?.schema?.maxItems
      const rowMin = rowCountCheck.spec?.min
      const rowMax = rowCountCheck.spec?.max

      if (schemaMin !== undefined && rowMax !== undefined && Number(schemaMin) > Number(rowMax)) {
        addIssue({
          code: 'LINT_SCHEMA_COUNT_CONFLICT',
          severity: 'error',
          path: `${mPath}/criteria`,
          message: `Schema minItems (${schemaMin}) exceeds row_count max (${rowMax})`,
        })
      }
      if (schemaMax !== undefined && rowMin !== undefined && Number(schemaMax) < Number(rowMin)) {
        addIssue({
          code: 'LINT_SCHEMA_COUNT_CONFLICT',
          severity: 'error',
          path: `${mPath}/criteria`,
          message: `Schema maxItems (${schemaMax}) is less than row_count min (${rowMin})`,
        })
      }
    }

    // AIP-11: 3. LINT_UNIQUE_CARDINALITY
    if (uniqueFieldCheck && rowCountCheck && jsonSchemaCheck) {
      const fieldName = uniqueFieldCheck.spec?.field
      const rowMin = Number(rowCountCheck.spec?.min || 0)
      const properties = jsonSchemaCheck.spec?.schema?.items?.properties || jsonSchemaCheck.spec?.schema?.properties
      const propDef = properties?.[fieldName]
      if (propDef && Array.isArray(propDef.enum)) {
        const enumCapacity = propDef.enum.length
        if (rowMin > enumCapacity) {
          addIssue({
            code: 'LINT_UNIQUE_CARDINALITY',
            severity: 'error',
            path: `${mPath}/criteria`,
            message: `Unique field '${fieldName}' has only ${enumCapacity} enum values but row_count requires at least ${rowMin} rows`,
          })
        }
      }
    }

    // AIP-11: 4. LINT_KEYWORDS_EXCEED_WORDS
    if (keywordsCheck && wordCountCheck) {
      const keywords = Array.isArray(keywordsCheck.spec?.keywords) ? keywordsCheck.spec.keywords : []
      const totalKeywordWords = keywords.reduce((sum: number, kw: string) => sum + kw.trim().split(/\s+/).length, 0)
      const maxWords = Number(wordCountCheck.spec?.max)
      if (!isNaN(maxWords) && totalKeywordWords > maxWords) {
        addIssue({
          code: 'LINT_KEYWORDS_EXCEED_WORDS',
          severity: 'error',
          path: `${mPath}/criteria`,
          message: `Required keywords require ${totalKeywordWords} words, exceeding word_count max of ${maxWords}`,
        })
      }
    }

    // AIP-11: 5. LINT_NO_JUNK_CHECK
    const isDatasetOrContent =
      m?.deliverable?.format === 'csv' ||
      m?.deliverable?.format === 'json' ||
      m?.deliverable?.format === 'markdown' ||
      m?.deliverable?.content_type === 'json_records' ||
      m?.deliverable?.content_type === 'text'
    if (isDatasetOrContent && !hasJunkFree) {
      addIssue({
        code: 'LINT_NO_JUNK_CHECK',
        severity: 'info',
        path: `${mPath}/criteria`,
        message: 'Deliverable has no junk_detector check; consider running Loophole Finder to guard against placeholders or repetition',
      })
    }
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
