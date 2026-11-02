import { describe, it, expect } from 'vitest'
import { canonicalize, contractHash, sha256Hex } from '@/server/contracts/canonical'

describe('Canonical JSON & Hashing', () => {
  it('is independent of object key order', () => {
    const objA = { b: 2, a: 1, c: { y: 20, x: 10 } }
    const objB = { a: 1, c: { x: 10, y: 20 }, b: 2 }

    expect(canonicalize(objA)).toBe(canonicalize(objB))
    expect(contractHash(objA)).toBe(contractHash(objB))
  })

  it('handles nested arrays and objects while preserving array order', () => {
    const data = {
      items: [
        { id: 2, name: 'B' },
        { id: 1, name: 'A' },
      ],
      tags: ['alpha', 'beta'],
    }
    const expected = '{"items":[{"id":2,"name":"B"},{"id":1,"name":"A"}],"tags":["alpha","beta"]}'
    expect(canonicalize(data)).toBe(expected)
  })

  it('preserves unicode characters', () => {
    const unicodeObj = { message: 'Hello 🌍 世界 — ProofPay' }
    const canonical = canonicalize(unicodeObj)
    expect(canonical).toContain('Hello 🌍 世界 — ProofPay')
  })

  it('rejects undefined values', () => {
    expect(() => canonicalize(undefined)).toThrow(TypeError)
    expect(() => canonicalize({ a: 1, b: undefined })).toThrow(TypeError)
  })

  it('rejects NaN and Infinity', () => {
    expect(() => canonicalize(NaN)).toThrow(TypeError)
    expect(() => canonicalize(Infinity)).toThrow(TypeError)
    expect(() => canonicalize({ num: -Infinity })).toThrow(TypeError)
  })

  it('treats 1 and 1.0 identically', () => {
    expect(canonicalize({ value: 1 })).toBe(canonicalize({ value: 1.0 }))
    expect(contractHash({ value: 1 })).toBe(contractHash({ value: 1.0 }))
  })

  it('produces deterministic SHA-256 hash', () => {
    const sample = { title: 'Test Agreement', total_minor: 10000 }
    const canonical = canonicalize(sample)
    const expectedHash = sha256Hex(canonical)

    expect(contractHash(sample)).toBe(expectedHash)
    expect(expectedHash).toHaveLength(64)
  })
})
