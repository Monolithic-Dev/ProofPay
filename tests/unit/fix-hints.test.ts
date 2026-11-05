import { describe, it, expect } from 'vitest'
import { computeFixHint } from '@/lib/fix-hints'

describe('Counterfactual Fix Hints (A5)', () => {
  it('computes exact minimal delta for row count deficit', () => {
    const hint = computeFixHint({
      criterion_key: 'c_rows',
      check: 'row_count',
      observed: 22,
      expected: 25,
      message: 'Found 22 rows, expected 25',
    })

    expect(hint).not.toBeNull()
    expect(hint?.action).toBe('Add 3 rows')
    expect(hint?.minimal_delta).toContain('deficit: 3')
  })

  it('computes trim instruction for word count excess', () => {
    const hint = computeFixHint({
      criterion_key: 'c_words',
      check: 'word_count',
      observed: 524,
      expected: { min: 200, max: 500 },
      message: 'Word count 524 exceeds max 500',
    })

    expect(hint).not.toBeNull()
    expect(hint?.action).toBe('Trim text by 24 words')
  })

  it('suggests specific missing CSV columns', () => {
    const hint = computeFixHint({
      criterion_key: 'c_csv',
      check: 'csv_schema',
      observed: ['id', 'name'],
      expected: ['id', 'name', 'email'],
      message: 'Missing required CSV headers: email.',
    })

    expect(hint).not.toBeNull()
    expect(hint?.action).toContain('Add missing header columns: email')
  })
})
