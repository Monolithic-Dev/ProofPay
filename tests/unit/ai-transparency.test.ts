import { describe, it, expect } from 'vitest'
import { computeReliance } from '@/components/common/AIRelianceMeter'

describe('AIP-3 AI Transparency & Reliance Scoring', () => {
  it('computes reliance bands accurately', () => {
    // Low band (< 20%)
    const low = computeReliance(1, 10)
    expect(low.level).toBe('Low')
    expect(low.percentage).toBe(10)

    // Medium band (20% - 50%)
    const med = computeReliance(1, 5)
    expect(med.level).toBe('Medium')
    expect(med.percentage).toBe(20)

    const med2 = computeReliance(2, 4)
    expect(med2.level).toBe('Medium')
    expect(med2.percentage).toBe(50)

    // High band (> 50%)
    const high = computeReliance(3, 4)
    expect(high.level).toBe('High')
    expect(high.percentage).toBe(75)
    expect(high.description).toContain('Higher reliance means more cases may need human review')
  })

  it('handles edge cases with zero criteria gracefully', () => {
    const zero = computeReliance(0, 0)
    expect(zero.level).toBe('Low')
    expect(zero.percentage).toBe(0)
  })
})

