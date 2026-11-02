/**
 * Evidence substring verification — Stage 2 post-processing.
 * Verifies that every LLM evidence quote is an actual substring of the artifact.
 * "AI reads and explains; code decides" — this is the code side.
 */

/**
 * Normalize whitespace for comparison:
 * - Collapse multiple spaces/tabs/newlines to single space
 * - Trim leading/trailing whitespace
 */
function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Check whether `quote` appears as a substring in `artifact`.
 * Normalizes whitespace in both strings before comparison.
 * Returns true if found, false otherwise.
 */
export function isEvidencePresent(artifact: string, quote: string): boolean {
  if (!quote || !artifact) return false

  const normalizedArtifact = normalize(artifact)
  const normalizedQuote = normalize(quote)

  if (normalizedQuote.length === 0) return false

  return normalizedArtifact.includes(normalizedQuote)
}

/**
 * Verify all evidence quotes from Stage 2 rubric results.
 * Returns a map of criterion_key → whether evidence was verified.
 */
export function verifyAllEvidence(
  artifact: string,
  results: Array<{ criterion_key: string; evidence: string }>
): Map<string, boolean> {
  const map = new Map<string, boolean>()
  for (const r of results) {
    map.set(r.criterion_key, isEvidencePresent(artifact, r.evidence))
  }
  return map
}
