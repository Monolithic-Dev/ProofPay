/**
 * Row count deterministic check.
 * Implements phase-4-verification-engine.md §4.2 & ai-pipeline.md §3 Stage 1.
 */
import type { ParsedArtifact } from '../artifact'
import type { DetCheckResult } from './json-schema'

export interface CheckRowCountSpec {
  min?: number
  max?: number
}

export function checkRowCount(
  artifact: ParsedArtifact,
  spec: CheckRowCountSpec
): DetCheckResult {
  if (!artifact.rows || !Array.isArray(artifact.rows)) {
    return {
      status: 'fail',
      observed: 'non-json_records',
      expected: 'json_records array',
      message: 'Deliverable is not valid JSON array.',
    }
  }

  const count = artifact.rows.length
  const min = spec.min
  const max = spec.max

  if (min !== undefined && count < min) {
    return {
      status: 'fail',
      observed: count,
      expected: `≥ ${min}`,
      message: `Expected ≥ ${min} records, found ${count}.`,
    }
  }

  if (max !== undefined && count > max) {
    return {
      status: 'fail',
      observed: count,
      expected: `≤ ${max}`,
      message: `Expected ≤ ${max} records, found ${count}.`,
    }
  }

  const expectedStr =
    min !== undefined && max !== undefined
      ? `${min}–${max}`
      : min !== undefined
      ? `≥ ${min}`
      : `≤ ${max}`

  return {
    status: 'pass',
    observed: count,
    expected: expectedStr,
    message: `Record count ${count} satisfies requirement (${expectedStr}).`,
  }
}
