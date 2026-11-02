/**
 * Word count deterministic check for text artifacts with markdown stripping.
 * Implements phase-4-verification-engine.md §4.2 & ai-pipeline.md §3 Stage 1.
 */
import type { ParsedArtifact } from '../artifact'
import type { DetCheckResult } from './json-schema'

export interface CheckWordCountSpec {
  min?: number
  max?: number
}

/**
 * Count words in a string after stripping common markdown syntax characters.
 */
export function countWords(text: string): number {
  if (!text) return 0

  // Strip markdown syntax characters: # * _ ` > - [ ] ( )
  const stripped = text.replace(/[#*_`>\-\[\]()~]/g, ' ')

  // Split on whitespace and filter empty tokens
  const words = stripped.trim().split(/\s+/).filter((w) => w.length > 0)
  return words.length
}

export function checkWordCount(
  artifact: ParsedArtifact,
  spec: CheckWordCountSpec
): DetCheckResult {
  const count = countWords(artifact.text)
  const min = spec.min
  const max = spec.max

  if (min !== undefined && count < min) {
    return {
      status: 'fail',
      observed: count,
      expected: max !== undefined ? `${min}–${max}` : `≥ ${min}`,
      message:
        max !== undefined
          ? `Found ${count} words; required ${min}–${max}.`
          : `Found ${count} words; required ≥ ${min}.`,
    }
  }

  if (max !== undefined && count > max) {
    return {
      status: 'fail',
      observed: count,
      expected: min !== undefined ? `${min}–${max}` : `≤ ${max}`,
      message:
        min !== undefined
          ? `Found ${count} words; required ${min}–${max}.`
          : `Found ${count} words; required ≤ ${max}.`,
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
    message: `Word count ${count} satisfies requirement (${expectedStr}).`,
  }
}
