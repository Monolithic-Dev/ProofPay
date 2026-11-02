/**
 * Unit tests for evidence quote normalization and substring verification.
 * Implements phase-4-verification-engine.md §4.3.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeForMatch,
  verifyQuote,
  verifyAll,
  MIN_QUOTE_LENGTH,
  MAX_QUOTE_LENGTH,
} from '@/server/verify/evidence'

describe('Evidence Verification (Task 4.3)', () => {
  const artifact = `
    The dataset includes 25 unique items collected across 5 categories.
    Each item contains an authentic email address and verified SKU code.
    Delivery is provided in clean JSON format ready for production deployment.
  `

  it('matches across whitespace differences (tabs, newlines, multiple spaces)', () => {
    const quoteWithNewlines = '25  unique\n\titems collected   across 5 categories.'
    expect(verifyQuote(artifact, quoteWithNewlines)).toBe(true)
  })

  it('matches despite zero-width characters in artifact or quote', () => {
    const quoteWithZeroWidth = 'Each\u200B item\u200C contains an authentic\uFEFF email'
    expect(verifyQuote(artifact, quoteWithZeroWidth)).toBe(true)
  })

  it('rejects paraphrases that do not match verbatim', () => {
    const paraphrase = 'The dataset has 25 different items in five categories.'
    expect(verifyQuote(artifact, paraphrase)).toBe(false)
  })

  it('rejects quote shorter than 8 chars after normalization', () => {
    const shortQuote = '25 item' // 7 chars
    expect(shortQuote.length).toBeLessThan(MIN_QUOTE_LENGTH)
    expect(verifyQuote(artifact, shortQuote)).toBe(false)
  })

  it('rejects quote exceeding 200 chars', () => {
    const longQuote = 'A'.repeat(MAX_QUOTE_LENGTH + 1)
    expect(verifyQuote(artifact, longQuote)).toBe(false)
  })

  it('performs case-sensitive matching', () => {
    const exactCase = 'Each item contains an authentic email'
    const wrongCase = 'each item contains an authentic email'

    expect(verifyQuote(artifact, exactCase)).toBe(true)
    expect(verifyQuote(artifact, wrongCase)).toBe(false)
  })

  it('verifyAll requires all quotes in list to verify', () => {
    const validQuote1 = 'The dataset includes 25 unique items'
    const validQuote2 = 'Delivery is provided in clean JSON format'
    const fakeQuote = 'This is a fabricated statement not in artifact'

    expect(verifyAll(artifact, [validQuote1, validQuote2])).toBe(true)
    expect(verifyAll(artifact, [validQuote1, fakeQuote])).toBe(false)
  })
})
