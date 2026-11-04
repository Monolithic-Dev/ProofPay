import { describe, it, expect } from 'vitest'
import { fundsSummary } from '@/lib/money'

describe('Money Invariant (fundsSummary)', () => {
  it('correctly calculates remaining hold with partial captures', () => {
    const summary = fundsSummary({
      authorizedMinor: 10000, // $100.00
      captures: [2500, 3500], // $25.00 + $35.00 = $60.00
      voidedMinor: 0,
    })

    expect(summary.capturedMinor).toBe(6000)
    expect(summary.remainingMinor).toBe(4000) // $40.00
    expect(summary.authorizedMinor).toBe(summary.capturedMinor + summary.voidedMinor + summary.remainingMinor)
  })

  it('correctly balances with voided amounts', () => {
    const summary = fundsSummary({
      authorizedMinor: 10000,
      captures: [5000],
      voidedMinor: 5000,
    })

    expect(summary.remainingMinor).toBe(0)
    expect(summary.authorizedMinor).toBe(summary.capturedMinor + summary.voidedMinor + summary.remainingMinor)
  })

  it('throws INVARIANT_VIOLATION if captures + void exceeds authorized', () => {
    expect(() =>
      fundsSummary({
        authorizedMinor: 5000,
        captures: [4000, 2000], // 6000 > 5000
        voidedMinor: 0,
      })
    ).toThrowError(/INVARIANT_VIOLATION/)
  })

  it('handles empty captures and zero voided', () => {
    const summary = fundsSummary({
      authorizedMinor: 7500,
      captures: [],
      voidedMinor: 0,
    })

    expect(summary.capturedMinor).toBe(0)
    expect(summary.remainingMinor).toBe(7500)
  })
})

