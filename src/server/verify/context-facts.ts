/**
 * Context facts builder and structural scanner.
 * Implements AIP-10 (Audit A-2, A-3, A-4).
 *
 * Prevents cross-milestone prompt injection by computing deterministic summary facts
 * rather than passing untrusted prior milestone text directly to LLM prompts.
 * Also flattens structured deliverables (keys, comments, escapes) for adversarial scanning.
 */
import * as crypto from 'node:crypto'

export interface ContextFacts {
  milestoneKey: string
  sha256: string
  rowCount: number
  wordCount: number
  schemaValid: boolean
  distinctCategories?: string[]
}

/**
 * Computes deterministic facts from a milestone deliverable without exposing raw text.
 */
export function buildContextFacts(milestoneKey: string, artifact: any): ContextFacts {
  if (!artifact) {
    return {
      milestoneKey,
      sha256: crypto.createHash('sha256').update('').digest('hex'),
      rowCount: 0,
      wordCount: 0,
      schemaValid: false,
    }
  }

  const rawStr = typeof artifact === 'string' ? artifact : JSON.stringify(artifact)
  const sha256 = crypto.createHash('sha256').update(rawStr).digest('hex')

  let rowCount = 0
  let distinctCategories: string[] | undefined

  if (Array.isArray(artifact)) {
    rowCount = artifact.length
    const cats = new Set<string>()
    for (const item of artifact) {
      if (item && typeof item === 'object' && 'category' in item) {
        cats.add(String(item.category))
      }
    }
    if (cats.size > 0) {
      distinctCategories = Array.from(cats).slice(0, 20)
    }
  } else if (typeof artifact === 'string') {
    rowCount = artifact.split('\n').filter((l) => l.trim().length > 0).length
  }

  const words = rawStr.trim().split(/\s+/).filter(Boolean)
  const wordCount = words.length

  return {
    milestoneKey,
    sha256,
    rowCount,
    wordCount,
    schemaValid: true,
    distinctCategories,
  }
}

/**
 * Normalizes text: NFKC unicode normalization, zero-width stripping,
 * Cyrillic/Greek confusable replacement, and leetspeak collapsing.
 */
export function normalizeForScan(text: string): string {
  if (!text) return ''

  // 1. NFKC normalization
  let norm = text.normalize('NFKC')

  // 2. Strip zero-width and bidi characters
  norm = norm.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')

  // 3. Map common homoglyphs / confusables (Cyrillic & Greek look-alikes to Latin)
  const confusableMap: Record<string, string> = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
    'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O',
    'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'і': 'i', 'ї': 'i',
  }
  norm = norm.replace(/[аеорсухАВЕКМНОРСТХії]/g, (ch) => confusableMap[ch] || ch)

  // 4. Collapse leetspeak digits (1->i, 0->o, 3->e, 4->a, 5->s, 7->t, @->a)
  norm = norm
    .replace(/(?:\b|(?<=[a-zA-Z]))1(?=[a-zA-Z])/g, 'i')
    .replace(/(?<=[a-zA-Z])1(?:\b|(?=[a-zA-Z]))/g, 'i')
    .replace(/(?<=[a-zA-Z])0(?=[a-zA-Z])/g, 'o')
    .replace(/(?<=[a-zA-Z])3(?=[a-zA-Z])/g, 'e')
    .replace(/(?<=[a-zA-Z])4(?=[a-zA-Z])/g, 'a')
    .replace(/(?<=[a-zA-Z])5(?=[a-zA-Z])/g, 's')
    .replace(/(?<=[a-zA-Z])7(?=[a-zA-Z])/g, 't')
    .replace(/@/g, 'a')

  return norm
}

/**
 * Extracts all strings from an artifact, including JSON object keys, values,
 * and markdown/HTML comments (`<!-- ... -->` and `[//]: # (...)`).
 */
export function flattenForScan(artifact: any): string {
  const parts: string[] = []

  function walk(obj: any) {
    if (!obj) return
    if (typeof obj === 'string') {
      parts.push(obj)
      // Extract HTML/Markdown comments
      const commentMatches = obj.match(/<!--([\s\S]*?)-->/g)
      if (commentMatches) {
        for (const c of commentMatches) {
          parts.push(c.replace(/<!--|-->/g, '').trim())
        }
      }
      const mdCommentMatches = obj.match(/\[\/\/\]:\s*#\s*\((.*?)\)/g)
      if (mdCommentMatches) {
        for (const c of mdCommentMatches) {
          parts.push(c)
        }
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) walk(item)
    } else if (typeof obj === 'object') {
      for (const [key, val] of Object.entries(obj)) {
        parts.push(key) // Scan the key name!
        walk(val)
      }
    }
  }

  walk(artifact)
  const fullText = parts.join(' ')

  // Decode embedded base64 runs (depth 1)
  const base64Regex = /\b[A-Za-z0-9+/]{28,}={0,2}\b/g
  let match: RegExpExecArray | null
  const decodedSegments: string[] = []

  while ((match = base64Regex.exec(fullText)) !== null) {
    try {
      const decoded = Buffer.from(match[0], 'base64').toString('utf8')
      if (/^[\x20-\x7E\s]+$/.test(decoded)) {
        decodedSegments.push(decoded)
      }
    } catch {
      // ignore invalid base64
    }
  }

  if (decodedSegments.length > 0) {
    return normalizeForScan(`${fullText} ${decodedSegments.join(' ')}`)
  }

  return normalizeForScan(fullText)
}
