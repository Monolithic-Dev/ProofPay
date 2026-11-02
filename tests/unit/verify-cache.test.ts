/**
 * Unit tests for verification caching and input hash determinism.
 * Implements phase-4-verification-engine.md §4.7.
 */
import { describe, it, expect } from 'vitest'
import { computeInputHash } from '@/server/verify/cache'

describe('Verification Cache (Task 4.7)', () => {
  const baseParams = {
    artifactSha256: 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
    criteria: [
      { key: 'c1', type: 'rubric', statement: 'Clean prose' },
      { key: 'c2', type: 'deterministic', check: 'row_count' },
    ],
    promptVersion: 'rubric.v1',
    model: 'claude-sonnet-5-5',
  }

  it('produces identical input_hash for identical inputs', () => {
    const hash1 = computeInputHash(baseParams)
    const hash2 = computeInputHash({ ...baseParams })

    expect(hash1).toHaveLength(64)
    expect(hash1).toBe(hash2)
  })

  it('changing prompt_version changes the input_hash', () => {
    const hash1 = computeInputHash(baseParams)
    const hash2 = computeInputHash({ ...baseParams, promptVersion: 'rubric.v2' })

    expect(hash2).not.toBe(hash1)
  })

  it('changing model changes the input_hash', () => {
    const hash1 = computeInputHash(baseParams)
    const hash2 = computeInputHash({ ...baseParams, model: 'claude-haiku-5-5' })

    expect(hash2).not.toBe(hash1)
  })

  it('changing artifactSha256 changes the input_hash', () => {
    const hash1 = computeInputHash(baseParams)
    const hash2 = computeInputHash({
      ...baseParams,
      artifactSha256: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    })

    expect(hash2).not.toBe(hash1)
  })

  it('changing criteria statements changes the input_hash', () => {
    const hash1 = computeInputHash(baseParams)
    const hash2 = computeInputHash({
      ...baseParams,
      criteria: [
        { key: 'c1', type: 'rubric', statement: 'Completely different statement' },
      ],
    })

    expect(hash2).not.toBe(hash1)
  })
})
