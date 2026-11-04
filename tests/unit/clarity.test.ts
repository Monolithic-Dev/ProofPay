import { describe, it, expect } from 'vitest'
import { computeClarityScore } from '@/lib/clarity'

describe('Criteria Clarity Score', () => {
  it('gives high score for fully deterministic, balanced contracts', () => {
    const contract = {
      total_minor: 10000,
      milestones: [
        {
          milestone_key: 'm1',
          title: 'Scraped Dataset',
          amount_minor: 10000,
          due_days: 7,
          criteria: [
            { type: 'deterministic', checker: 'row_count', min: 25 },
            { type: 'deterministic', checker: 'json_schema' },
          ],
        },
      ],
    }

    const res = computeClarityScore(contract)
    expect(res.score).toBeGreaterThanOrEqual(90)
    expect(res.rating).toBe('EXCELLENT')
    expect(res.disputeRisk).toBe('LOW')
  })

  it('penalizes vague terms and missing deterministic checks', () => {
    const contract = {
      total_minor: 10000,
      milestones: [
        {
          milestone_key: 'm1',
          title: 'Vague Milestone',
          description: 'Deliver clean code and fast response',
          amount_minor: 10000,
          due_days: 14,
          criteria: [
            { description: 'Must be scalable and reasonable' },
          ],
        },
      ],
    }

    const res = computeClarityScore(contract)
    expect(res.score).toBeLessThan(70)
    expect(res.disputeRisk).toBe('HIGH')
    expect(res.reasons.some((r) => r.includes('vague term'))).toBe(true)
  })

  it('flags milestones exceeding 28 days', () => {
    const contract = {
      total_minor: 5000,
      milestones: [
        {
          milestone_key: 'm1',
          amount_minor: 5000,
          due_days: 35, // Exceeds PayPal hold window!
          criteria: [{ type: 'deterministic', checker: 'row_count' }],
        },
      ],
    }

    const res = computeClarityScore(contract)
    expect(res.metrics.deadlineSafe).toBe(false)
    expect(res.reasons.some((r) => r.includes('exceeds PayPal'))).toBe(true)
  })
})
