/**
 * Unit tests for artifact parsing, limits, and sanitization.
 * Implements phase-4-verification-engine.md §4.1.
 */
import { describe, it, expect } from 'vitest'
import {
  parseArtifact,
  jsonDepth,
  MAX_ARTIFACT_BYTES,
  MAX_JSON_RECORDS,
  MAX_JSON_DEPTH,
} from '@/server/verify/artifact'
import { AppError, ValidationError } from '@/server/util/errors'

describe('Artifact Parsing & Limits (Task 4.1)', () => {
  it('accepts array of objects for json_records', () => {
    const records = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ]
    const parsed = parseArtifact('json_records', records)

    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows![0]!['id']).toBe(1)
    expect(parsed.sizeBytes).toBeGreaterThan(0)
    expect(parsed.sha256).toHaveLength(64)
  })

  it('accepts JSON string of array for json_records', () => {
    const raw = JSON.stringify([{ sku: 'ABC-1234', price: 10 }])
    const parsed = parseArtifact('json_records', raw)

    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows![0]!['sku']).toBe('ABC-1234')
  })

  it('rejects object at top level for json_records', () => {
    const invalidTopLevel = { items: [{ sku: 'ABC-1234' }] }

    expect(() => parseArtifact('json_records', invalidTopLevel)).toThrow(AppError)
    expect(() => parseArtifact('json_records', JSON.stringify(invalidTopLevel))).toThrow(AppError)
  })

  it('rejects JSON depth exceeding 20', () => {
    // Build nested object with depth 21
    let nested: any = { leaf: 'value' }
    for (let i = 0; i < 21; i++) {
      nested = { child: nested }
    }

    const payload = [nested]
    expect(jsonDepth(payload)).toBeGreaterThan(20)
    expect(() => parseArtifact('json_records', payload)).toThrow(ValidationError)
  })

  it('rejects more than 5000 rows in json_records', () => {
    const rows = Array.from({ length: MAX_JSON_RECORDS + 1 }, (_, i) => ({ id: i }))

    expect(() => parseArtifact('json_records', rows)).toThrow(ValidationError)
  })

  it('rejects artifact size exceeding 1 MiB', () => {
    const hugeString = 'A'.repeat(MAX_ARTIFACT_BYTES + 1)

    expect(() => parseArtifact('text', hugeString)).toThrow(AppError)
  })

  it('strips null bytes but keeps zero-width characters', () => {
    const inputWithNullAndZeroWidth = 'Safe text\0\0\u200B\u200Cwith hidden chars\0'
    const parsed = parseArtifact('text', inputWithNullAndZeroWidth)

    // Null bytes removed
    expect(parsed.text).not.toContain('\0')
    // Zero-width characters preserved
    expect(parsed.text).toContain('\u200B')
    expect(parsed.text).toContain('\u200C')
  })

  it('generates a stable sha256 hex digest', () => {
    const content = 'Deterministic artifact content test 123'
    const parsed1 = parseArtifact('text', content)
    const parsed2 = parseArtifact('text', content)

    expect(parsed1.sha256).toBe(parsed2.sha256)
  })
})
