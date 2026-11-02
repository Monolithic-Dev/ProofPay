/**
 * Regex field deterministic check using named ReDoS-safe patterns.
 * Implements phase-4-verification-engine.md §4.2 & ai-pipeline.md §3 Stage 1.
 */
import type { ParsedArtifact } from '../artifact'
import { NAMED_PATTERNS, type NamedPattern } from './patterns'
import type { DetCheckResult } from './json-schema'

export interface CheckRegexFieldSpec {
  field: string
  pattern: NamedPattern
}

export function checkRegexField(
  artifact: ParsedArtifact,
  spec: CheckRegexFieldSpec
): DetCheckResult {
  if (!artifact.rows || !Array.isArray(artifact.rows)) {
    return {
      status: 'fail',
      observed: 'non-json_records',
      expected: 'json_records array',
      message: 'Deliverable is not valid JSON array.',
    }
  }

  const { field, pattern } = spec
  const regex = NAMED_PATTERNS[pattern]
  if (!regex) {
    return {
      status: 'fail',
      observed: pattern,
      expected: Object.keys(NAMED_PATTERNS).join(', '),
      message: `Unknown named pattern "${pattern}".`,
    }
  }

  const failures: Array<{ row: number; val: string }> = []
  let missingCount = 0

  for (let idx = 0; idx < artifact.rows.length; idx++) {
    const row = artifact.rows[idx]!
    const val = row[field]

    if (val === undefined || val === null) {
      missingCount++
      continue
    }

    const strVal = String(val)
    if (!regex.test(strVal)) {
      if (failures.length < 5) {
        failures.push({ row: idx, val: strVal })
      }
    }
  }

  if (missingCount > 0) {
    return {
      status: 'fail',
      observed: `${missingCount} row(s) missing "${field}"`,
      expected: `All rows contain valid "${field}" matching ${pattern}`,
      message: `Field "${field}" is missing in ${missingCount} record(s).`,
    }
  }

  if (failures.length > 0) {
    const messages = failures.map(
      (f) => `Row ${f.row}: '${f.val}' is not a valid ${pattern}.`
    )
    return {
      status: 'fail',
      observed: `${failures.length} invalid ${pattern} value(s)`,
      expected: `All rows match ${pattern} pattern`,
      message: messages.join(' '),
    }
  }

  return {
    status: 'pass',
    observed: `${artifact.rows.length} valid values`,
    expected: `All rows match ${pattern}`,
    message: `All ${artifact.rows.length} records have valid "${field}" values matching ${pattern}.`,
  }
}
