/**
 * Subjective and vague terminology catalog for contract linting.
 * Implements phase-3-auth-and-contracts.md §3.7.
 */

export const VAGUE_TERMS = [
  'good',
  'high quality',
  'professional',
  'nice',
  'better',
  'engaging',
  'appropriate',
  'soon',
  'asap',
  'etc',
  'and so on',
  'polished',
  'creative',
  'clean',
  'amazing',
  'fast',
  'reliable',
  'best in class',
  'modern',
  'robust',
  'state of the art',
  'user friendly',
  'seamless',
  'top notch',
  'sufficient',
  'thorough',
  'comprehensive',
  'well written',
] as const

export interface VagueTermMatch {
  term: string
  index: number
}

/**
 * Scan text for any subjective, ambiguous, or vague terms using word boundaries.
 */
export function findVagueTerms(text: string): VagueTermMatch[] {
  if (!text) return []

  const matches: VagueTermMatch[] = []
  const lower = text.toLowerCase()

  for (const term of VAGUE_TERMS) {
    // Regex with word boundaries for whole words / phrases
    const regex = new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'gi')
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        term: match[0],
        index: match.index,
      })
    }
  }

  return matches
}
