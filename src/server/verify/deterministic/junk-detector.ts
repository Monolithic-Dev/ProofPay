import type { ParsedArtifact } from '../artifact'

export interface CheckJunkDetectorSpec {
  max_placeholder_ratio?: number // Default: 0.25 (at most 25% placeholder fields)
  max_duplicate_ratio?: number // Default: 0.75 (at most 75% duplicate values)
  min_entropy?: number // Default: 2.2 bits per char
  custom_placeholders?: string[]
}

const DEFAULT_PLACEHOLDERS = new Set([
  'n/a',
  'na',
  'tbd',
  'todo',
  'null',
  'undefined',
  'test',
  'dummy',
  'asdf',
  'sample',
  'lorem',
  'ipsum',
  'placeholder',
  'xxx',
  'none',
  'blank',
  'foo',
  'bar',
  'baz',
  'temp',
])

/**
 * Calculates Shannon entropy (in bits per character) of a string.
 */
export function calculateShannonEntropy(text: string): number {
  if (!text || text.length === 0) return 0
  const freqMap: Record<string, number> = {}
  for (const ch of text) {
    freqMap[ch] = (freqMap[ch] || 0) + 1
  }

  let entropy = 0
  const len = text.length
  for (const count of Object.values(freqMap)) {
    const p = count / len
    entropy -= p * Math.log2(p)
  }
  return entropy
}

/**
 * Collects all leaf string values from any JSON structure or text.
 */
function extractStringValues(val: unknown, acc: string[] = []): string[] {
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (trimmed.length > 0) acc.push(trimmed)
  } else if (Array.isArray(val)) {
    for (const item of val) extractStringValues(item, acc)
  } else if (val && typeof val === 'object') {
    for (const v of Object.values(val as Record<string, unknown>)) {
      extractStringValues(v, acc)
    }
  }
  return acc
}

export function checkJunkDetector(
  artifact: ParsedArtifact,
  spec: CheckJunkDetectorSpec = {}
): { status: 'pass' | 'fail'; observed: unknown; expected: unknown; message: string } {
  const maxPlaceholderRatio = spec.max_placeholder_ratio ?? 0.25
  const maxDuplicateRatio = spec.max_duplicate_ratio ?? 0.75
  const minEntropy = spec.min_entropy ?? 2.2

  const placeholderSet = new Set(DEFAULT_PLACEHOLDERS)
  if (spec.custom_placeholders) {
    for (const p of spec.custom_placeholders) {
      placeholderSet.add(p.toLowerCase().trim())
    }
  }

  // Extract strings from records or split text
  let stringValues: string[] = []
  if (artifact.rows && artifact.rows.length > 0) {
    stringValues = extractStringValues(artifact.rows)
  } else if (artifact.text) {
    stringValues = artifact.text
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
  }

  if (stringValues.length === 0) {
    return {
      status: 'fail',
      observed: '0 values',
      expected: 'non-empty deliverable',
      message: 'Deliverable contains zero inspectable text or record values.',
    }
  }

  // 1. Placeholder ratio
  let placeholderCount = 0
  const foundPlaceholders: string[] = []

  for (const s of stringValues) {
    const normalized = s.toLowerCase()
    if (placeholderSet.has(normalized) || /^tbd|^todo|^n\/a$/i.test(normalized)) {
      placeholderCount++
      if (foundPlaceholders.length < 5) foundPlaceholders.push(s)
    }
  }

  const placeholderRatio = placeholderCount / stringValues.length
  if (placeholderRatio > maxPlaceholderRatio) {
    return {
      status: 'fail',
      observed: `${(placeholderRatio * 100).toFixed(1)}% placeholder values (${foundPlaceholders.slice(0, 3).join(', ')}...)`,
      expected: `<= ${(maxPlaceholderRatio * 100).toFixed(0)}%`,
      message: `Excessive placeholder or dummy values detected: ${(placeholderRatio * 100).toFixed(1)}% of values are placeholders (limit is ${(maxPlaceholderRatio * 100).toFixed(0)}%).`,
    }
  }

  // 2. Duplicate ratio (only if sample is meaningful >= 8 items)
  if (stringValues.length >= 8) {
    const uniqueCount = new Set(stringValues.map((s) => s.toLowerCase())).size
    const duplicateRatio = 1 - uniqueCount / stringValues.length
    if (duplicateRatio > maxDuplicateRatio) {
      return {
        status: 'fail',
        observed: `${(duplicateRatio * 100).toFixed(1)}% duplicate values`,
        expected: `<= ${(maxDuplicateRatio * 100).toFixed(0)}%`,
        message: `High repetition detected: ${(duplicateRatio * 100).toFixed(1)}% of values are copy-pasted duplicates (limit is ${(maxDuplicateRatio * 100).toFixed(0)}%).`,
      }
    }
  }

  // 3. Shannon character entropy (on meaningful text >= 30 chars)
  const fullText = artifact.text || stringValues.join(' ')
  if (fullText.length >= 30) {
    const entropy = calculateShannonEntropy(fullText)
    if (entropy < minEntropy) {
      return {
        status: 'fail',
        observed: `${entropy.toFixed(2)} bits/char`,
        expected: `>= ${minEntropy.toFixed(2)} bits/char`,
        message: `Low informational entropy (${entropy.toFixed(2)} bits/char). Text exhibits unnatural character repetition.`,
      }
    }
  }

  return {
    status: 'pass',
    observed: `${stringValues.length} values inspected (placeholder ratio: ${(placeholderRatio * 100).toFixed(1)}%)`,
    expected: 'substantive non-junk content',
    message: 'Semantic junk scan passed: no excessive placeholders, duplication, or low-entropy patterns.',
  }
}
