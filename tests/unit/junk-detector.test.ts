import { describe, it, expect } from 'vitest'
import {
  checkJunkDetector,
  calculateShannonEntropy,
} from '@/server/verify/deterministic/junk-detector'
import { runDeterministicCheck } from '@/server/verify/deterministic/registry'
import { parseArtifact } from '@/server/verify/artifact'

describe('Finding A-6: Semantic Junk Detector & Shannon Entropy', () => {
  it('calculates Shannon entropy accurately', () => {
    // Zero entropy for empty or single char repeated
    expect(calculateShannonEntropy('')).toBe(0)
    expect(calculateShannonEntropy('aaaaaaa')).toBe(0)

    // Two alternating characters in equal proportion: - 2 * (0.5 * log2(0.5)) = 1 bit
    expect(calculateShannonEntropy('abababab')).toBeCloseTo(1.0, 2)

    // English text typically has entropy between 3.5 and 4.5 bits/char
    const englishSample = 'The quick brown fox jumps over the lazy dog in the warm sunshine'
    const entropy = calculateShannonEntropy(englishSample)
    expect(entropy).toBeGreaterThan(3.5)
  })

  it('rejects deliverables filled with placeholder tokens (TBD, N/A, dummy)', () => {
    const rawRecords = [
      { id: '1', name: 'TBD', email: 'user1@test.com', status: 'N/A' },
      { id: '2', name: 'TODO', email: 'test', status: 'pending' },
      { id: '3', name: 'Alice', email: 'alice@example.com', status: 'done' },
      { id: '4', name: 'placeholder', email: 'sample', status: 'na' },
    ]
    const artifact = parseArtifact('json_records', rawRecords)

    const result = runDeterministicCheck(
      {
        criterion_key: 'c_junk',
        check: 'junk_detector',
        spec: { max_placeholder_ratio: 0.2 },
      },
      artifact
    )

    expect(result.passed).toBe(false)
    expect(result.status).toBe('fail')
    expect(result.message).toContain('Excessive placeholder or dummy values detected')
  })

  it('rejects deliverables with excessive copy-pasted duplicate values', () => {
    const duplicateRows = [
      { item: 'lorem ipsum dolor sit amet' },
      { item: 'lorem ipsum dolor sit amet' },
      { item: 'lorem ipsum dolor sit amet' },
      { item: 'lorem ipsum dolor sit amet' },
      { item: 'lorem ipsum dolor sit amet' },
      { item: 'lorem ipsum dolor sit amet' },
      { item: 'lorem ipsum dolor sit amet' },
      { item: 'unique real content' },
    ]
    const artifact = parseArtifact('json_records', duplicateRows)

    const result = runDeterministicCheck(
      {
        criterion_key: 'c_dups',
        check: 'junk_detector',
        spec: { max_duplicate_ratio: 0.7 },
      },
      artifact
    )

    expect(result.passed).toBe(false)
    expect(result.message).toContain('High repetition detected')
  })

  it('rejects text with low Shannon character entropy', () => {
    // 60 characters of repetitive low-variety gibberish
    const lowEntropyText = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const artifact = parseArtifact('text', lowEntropyText)

    const result = checkJunkDetector(artifact, { min_entropy: 2.2 })
    expect(result.status).toBe('fail')
    expect(result.message).toContain('Low informational entropy')
  })

  it('passes authentic, substantive deliverables', () => {
    const cleanRecords = [
      { user_id: 'usr_001', name: 'Sarah Chen', email: 'schen@company.org', city: 'Seattle' },
      { user_id: 'usr_002', name: 'Marcus Vance', email: 'mvance@acme.io', city: 'Austin' },
      { user_id: 'usr_003', name: 'Elena Rostova', email: 'erostova@global.net', city: 'Chicago' },
      { user_id: 'usr_004', name: 'David Kim', email: 'dkim@fintech.dev', city: 'New York' },
    ]
    const artifact = parseArtifact('json_records', cleanRecords)

    const result = runDeterministicCheck(
      {
        criterion_key: 'c_clean',
        check: 'junk_detector',
      },
      artifact
    )

    expect(result.passed).toBe(true)
    expect(result.status).toBe('pass')
    expect(result.message).toContain('Semantic junk scan passed')
  })
})
