/**
 * Unique field deterministic check.
 * Implements phase-4-verification-engine.md §4.2 & ai-pipeline.md §3 Stage 1.
 */
import type { ParsedArtifact } from '../artifact'
import type { DetCheckResult } from './json-schema'

export interface CheckUniqueFieldSpec {
  field: string
}

export function checkUniqueField(
  artifact: ParsedArtifact,
  spec: CheckUniqueFieldSpec
): DetCheckResult {
  if (!artifact.rows || !Array.isArray(artifact.rows)) {
    return {
      status: 'fail',
      observed: 'non-json_records',
      expected: 'json_records array',
      message: 'Deliverable is not valid JSON array.',
    }
  }

  const { field } = spec
  const seen = new Map<string, number>()
  const duplicates: Array<{ value: string; rows: [number, number] }> = []
  let missingCount = 0

  for (let idx = 0; idx < artifact.rows.length; idx++) {
    const row = artifact.rows[idx]!
    const val = row[field]

    if (val === undefined || val === null) {
      missingCount++
      continue
    }

    const key = String(val)
    if (seen.has(key)) {
      if (duplicates.length < 5) {
        duplicates.push({
          value: key,
          rows: [seen.get(key)!, idx],
        })
      }
    } else {
      seen.set(key, idx)
    }
  }

  if (missingCount > 0) {
    return {
      status: 'fail',
      observed: `${missingCount} row(s) missing "${field}"`,
      expected: `All rows contain unique "${field}"`,
      message: `Field "${field}" is missing in ${missingCount} record(s).`,
    }
  }

  if (duplicates.length > 0) {
    const messages = duplicates.map(
      (d) => `Duplicate ${field} '${d.value}' in rows ${d.rows[0]} and ${d.rows[1]}.`
    )
    return {
      status: 'fail',
      observed: `${duplicates.length} duplicate(s) detected`,
      expected: `All values of "${field}" are strictly unique`,
      message: messages.join(' '),
    }
  }

  return {
    status: 'pass',
    observed: `${artifact.rows.length} unique values`,
    expected: `Unique "${field}" across all rows`,
    message: `All ${artifact.rows.length} records have unique "${field}" values.`,
  }
}
