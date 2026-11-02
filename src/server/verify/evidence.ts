/**
 * Evidence substring verification — Stage 2 post-processing.
 * Verifies that every LLM evidence quote is an authentic verbatim substring of the deliverable.
 * "AI reads and explains; code decides" — this is the deterministic code boundary.
 * Implements phase-4-verification-engine.md §4.3 & ai-pipeline.md §3 Stage 2.
 */

const ZERO_WIDTH_BIDI_REGEX = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g

export const MIN_QUOTE_LENGTH = 8
export const MAX_QUOTE_LENGTH = 200

/**
 * Normalize string for matching:
 * 1. Unicode NFKC normalization
 * 2. Remove zero-width characters and bidirectional overrides
 * 3. Collapse multiple whitespace characters (spaces, tabs, newlines) to a single space
 * 4. Trim leading/trailing whitespace
 */
export function normalizeForMatch(s: string): string {
  if (!s) return ''
  return s
    .normalize('NFKC')
    .replace(ZERO_WIDTH_BIDI_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Verify whether an evidence quote is an authentic verbatim substring of the artifact.
 * Requirements:
 * - Quote length after normalization must be between 8 and 200 characters inclusive.
 * - Match is case-sensitive after NFKC, whitespace collapsing, and zero-width stripping.
 */
export function verifyQuote(artifactText: string, quote: string): boolean {
  if (!artifactText || !quote) return false

  const normQuote = normalizeForMatch(quote)
  if (normQuote.length < MIN_QUOTE_LENGTH || normQuote.length > MAX_QUOTE_LENGTH) {
    return false
  }

  const normArtifact = normalizeForMatch(artifactText)
  return normArtifact.includes(normQuote)
}

/**
 * Verify that all quotes in a list are verified verbatim substrings.
 */
export function verifyAll(artifactText: string, quotes: string[]): boolean {
  if (!quotes || quotes.length === 0) return false
  return quotes.every((q) => verifyQuote(artifactText, q))
}

// Backwards-compatible aliases
export const isEvidencePresent = verifyQuote

export function verifyAllEvidence(
  artifact: string,
  results: Array<{ criterion_key: string; evidence: string }>
): Map<string, boolean> {
  const map = new Map<string, boolean>()
  for (const r of results) {
    map.set(r.criterion_key, verifyQuote(artifact, r.evidence))
  }
  return map
}
