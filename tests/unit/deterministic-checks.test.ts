/**
 * Comprehensive unit tests for deterministic verification checks.
 * Implements phase-4-verification-engine.md §4.2 & testing.md §2.2.
 */
import { describe, it, expect } from 'vitest'
import { parseArtifact } from '@/server/verify/artifact'
import {
  checkRowCount,
  checkUniqueField,
  checkRegexField,
  checkWordCount,
  checkRequiredKeywords,
  checkJsonSchema,
  runDeterministicCheck,
} from '@/server/verify/deterministic/registry'

describe('Deterministic Checkers (Task 4.2)', () => {
  describe('row_count check', () => {
    it('row_count boundaries: 24 (fail), 25 (pass), 26 (pass) vs min 25', () => {
      const art24 = parseArtifact('json_records', Array.from({ length: 24 }, (_, i) => ({ id: i })))
      const art25 = parseArtifact('json_records', Array.from({ length: 25 }, (_, i) => ({ id: i })))
      const art26 = parseArtifact('json_records', Array.from({ length: 26 }, (_, i) => ({ id: i })))

      expect(checkRowCount(art24, { min: 25 }).status).toBe('fail')
      expect(checkRowCount(art25, { min: 25 }).status).toBe('pass')
      expect(checkRowCount(art26, { min: 25 }).status).toBe('pass')
    })

    it('row_count handles empty array', () => {
      const emptyArt = parseArtifact('json_records', [])
      const res = checkRowCount(emptyArt, { min: 1 })
      expect(res.status).toBe('fail')
      expect(res.message).toContain('Expected ≥ 1 records, found 0')
    })

    it('row_count fails gracefully on non-array content', () => {
      const textArt = parseArtifact('text', 'hello world')
      const res = checkRowCount(textArt, { min: 5 })
      expect(res.status).toBe('fail')
      expect(res.message).toBe('Deliverable is not valid JSON array.')
    })
  })

  describe('unique_field check', () => {
    it('detects duplicates and reports row indices', () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({ sku: `SKU-${i}` }))
      // Duplicate at row 3 and row 17
      rows[17] = { sku: rows[3]!.sku }

      const art = parseArtifact('json_records', rows)
      const res = checkUniqueField(art, { field: 'sku' })

      expect(res.status).toBe('fail')
      expect(res.message).toContain("Duplicate sku 'SKU-3' in rows 3 and 17")
    })

    it('fails when field is missing in records', () => {
      const rows = [{ sku: 'SKU-1' }, { other: 'no sku here' }]
      const art = parseArtifact('json_records', rows)
      const res = checkUniqueField(art, { field: 'sku' })

      expect(res.status).toBe('fail')
      expect(res.message).toContain('Field "sku" is missing in 1 record(s)')
    })
  })

  describe('regex_field check', () => {
    it('rejects invalid emails like bob@@x and a@b', () => {
      const rows = [
        { email: 'bob@@x' },
        { email: 'a@b' },
      ]
      const art = parseArtifact('json_records', rows)
      const res = checkRegexField(art, { field: 'email', pattern: 'email' })

      expect(res.status).toBe('fail')
      expect(res.message).toContain("Row 0: 'bob@@x' is not a valid email.")
      expect(res.message).toContain("Row 1: 'a@b' is not a valid email.")
    })

    it('accepts valid email with plus-addressing', () => {
      const rows = [{ email: 'engineer+test@proofpay.com' }]
      const art = parseArtifact('json_records', rows)
      const res = checkRegexField(art, { field: 'email', pattern: 'email' })

      expect(res.status).toBe('pass')
    })

    it('validates SKU format ^[A-Z]{3}-\\d{4}$', () => {
      const validRows = [{ sku: 'ABC-1234' }]
      const invalidRows = [{ sku: 'abc-1234' }]

      expect(checkRegexField(parseArtifact('json_records', validRows), { field: 'sku', pattern: 'sku' }).status).toBe('pass')
      expect(checkRegexField(parseArtifact('json_records', invalidRows), { field: 'sku', pattern: 'sku' }).status).toBe('fail')
    })
  })

  describe('word_count check', () => {
    it('evaluates boundaries: 149 (fail), 150 (pass), 200 (pass), 201 (fail) vs 150–200', () => {
      const genWords = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

      const art149 = parseArtifact('text', genWords(149))
      const art150 = parseArtifact('text', genWords(150))
      const art200 = parseArtifact('text', genWords(200))
      const art201 = parseArtifact('text', genWords(201))

      expect(checkWordCount(art149, { min: 150, max: 200 }).status).toBe('fail')
      expect(checkWordCount(art150, { min: 150, max: 200 }).status).toBe('pass')
      expect(checkWordCount(art200, { min: 150, max: 200 }).status).toBe('pass')
      expect(checkWordCount(art201, { min: 150, max: 200 }).status).toBe('fail')
    })

    it('ignores markdown syntax when counting words', () => {
      const mdText = '# Heading\n\n- **Item one** in `code`\n> [Link](https://test.com)'
      // Words: Heading, Item, one, in, code, Link, https://test.com = 7 words
      const art = parseArtifact('text', mdText)
      const res = checkWordCount(art, { min: 5, max: 10 })

      expect(res.status).toBe('pass')
    })
  })

  describe('required_keywords check', () => {
    it('verifies all mode and reports missing keywords', () => {
      const art = parseArtifact('text', 'We offer Nutrition and Wellness solutions.')
      const res = checkRequiredKeywords(art, {
        keywords: ['Nutrition', 'Fitness'],
        mode: 'all',
      })

      expect(res.status).toBe('fail')
      expect(res.message).toContain('Missing keywords: Fitness.')
    })

    it('verifies any mode', () => {
      const art = parseArtifact('text', 'We offer Nutrition solutions.')
      const resPass = checkRequiredKeywords(art, {
        keywords: ['Nutrition', 'Fitness'],
        mode: 'any',
      })
      expect(resPass.status).toBe('pass')

      const resFail = checkRequiredKeywords(art, {
        keywords: ['Finance', 'Automotive'],
        mode: 'any',
      })
      expect(resFail.status).toBe('fail')
    })

    it('honors case_sensitive flag', () => {
      const art = parseArtifact('text', 'Lowercase keyword: fitness')
      expect(checkRequiredKeywords(art, { keywords: ['Fitness'], mode: 'all', case_sensitive: true }).status).toBe('fail')
      expect(checkRequiredKeywords(art, { keywords: ['Fitness'], mode: 'all', case_sensitive: false }).status).toBe('pass')
    })
  })

  describe('json_schema product_v1 check', () => {
    const validProduct = {
      sku: 'ELE-1042',
      name: 'Wireless Bluetooth Headset',
      category: 'Electronics',
      price_usd: 59.99,
      contact_email: 'support@audiotech.com',
      description: 'High fidelity audio with active noise cancellation and 30-hour battery life.',
    }

    it('passes for a valid product dataset', () => {
      const art = parseArtifact('json_records', [validProduct])
      const res = checkJsonSchema(art, { schema_ref: 'product_v1' })
      expect(res.status).toBe('pass')
    })

    it('rejects additional properties not defined in schema', () => {
      const invalidProduct = { ...validProduct, extra_field: 'illegal' }
      const art = parseArtifact('json_records', [invalidProduct])
      const res = checkJsonSchema(art, { schema_ref: 'product_v1' })

      expect(res.status).toBe('fail')
      expect(res.message).toContain('must NOT have additional properties')
    })

    it('truncates errors at 5 when multiple records violate schema', () => {
      const badProducts = Array.from({ length: 10 }, (_, i) => ({
        sku: 'invalid_sku',
        name: 'x',
        category: 'InvalidCategory',
        price_usd: -5,
        contact_email: 'bad_email',
        description: 'short',
      }))

      const art = parseArtifact('json_records', badProducts)
      const res = checkJsonSchema(art, { schema_ref: 'product_v1' })

      expect(res.status).toBe('fail')
      expect(res.message).toContain('(and')
    })
  })

  describe('runDeterministicCheck registry dispatcher', () => {
    it('dispatches known check and returns unified DetResult shape', () => {
      const art = parseArtifact('json_records', [{ id: 1 }, { id: 2 }])
      const res = runDeterministicCheck(
        {
          key: 'c1',
          type: 'deterministic',
          check: 'row_count',
          spec: { min: 2 },
        },
        art
      )

      expect(res.criterion_key).toBe('c1')
      expect(res.status).toBe('pass')
    })

    it('returns fail for unknown check', () => {
      const art = parseArtifact('text', 'sample')
      const res = runDeterministicCheck(
        {
          key: 'c_unknown',
          type: 'deterministic',
          check: 'quantum_entanglement',
          spec: {},
        },
        art
      )

      expect(res.status).toBe('fail')
      expect(res.message).toContain('Unknown check: "quantum_entanglement"')
    })
  })
})
