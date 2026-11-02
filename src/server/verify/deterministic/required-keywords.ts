/**
 * Required keywords deterministic check.
 * Implements phase-4-verification-engine.md §4.2 & ai-pipeline.md §3 Stage 1.
 */
import type { ParsedArtifact } from '../artifact'
import type { DetCheckResult } from './json-schema'

export interface CheckRequiredKeywordsSpec {
  keywords: string[]
  mode: 'all' | 'any'
  case_sensitive?: boolean
}

export function checkRequiredKeywords(
  artifact: ParsedArtifact,
  spec: CheckRequiredKeywordsSpec
): DetCheckResult {
  const { keywords, mode = 'all', case_sensitive = false } = spec

  if (!keywords || keywords.length === 0) {
    return {
      status: 'pass',
      observed: '0 keywords specified',
      expected: 'No keywords required',
      message: 'No required keywords were configured.',
    }
  }

  const textToSearch = case_sensitive ? artifact.text : artifact.text.toLowerCase()
  const missing: string[] = []
  const found: string[] = []

  for (const kw of keywords) {
    const target = case_sensitive ? kw : kw.toLowerCase()
    if (textToSearch.includes(target)) {
      found.push(kw)
    } else {
      missing.push(kw)
    }
  }

  if (mode === 'all') {
    if (missing.length > 0) {
      return {
        status: 'fail',
        observed: `Found ${found.length} of ${keywords.length} keywords`,
        expected: `All keywords present: ${keywords.join(', ')}`,
        message: `Missing keywords: ${missing.join(', ')}.`,
      }
    }

    return {
      status: 'pass',
      observed: `All ${keywords.length} keywords present`,
      expected: `All keywords present: ${keywords.join(', ')}`,
      message: `All required keywords (${keywords.join(', ')}) were found in the deliverable.`,
    }
  }

  // mode === 'any'
  if (found.length === 0) {
    return {
      status: 'fail',
      observed: '0 keywords found',
      expected: `At least one keyword present from: ${keywords.join(', ')}`,
      message: `None of the required keywords (${keywords.join(', ')}) were found.`,
    }
  }

  return {
    status: 'pass',
    observed: `Found keywords: ${found.join(', ')}`,
    expected: `At least one keyword present from: ${keywords.join(', ')}`,
    message: `Found required keyword(s): ${found.join(', ')}.`,
  }
}
