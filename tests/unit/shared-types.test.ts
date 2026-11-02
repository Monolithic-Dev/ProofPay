import { describe, it, expect } from 'vitest'
import {
  ContractView,
  VerificationView,
  MilestoneStatus,
} from '@/shared/types'

describe('Shared API types & schemas', () => {
  it('parses ContractView sample successfully', () => {
    const sample = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      buyer_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      title: 'E-commerce product dataset compilation',
      status: 'FUNDED',
      contract_json: { title: 'Test' },
      contract_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      lint_json: { issues: [] },
      version: 1,
      currency: 'USD',
      total_minor: 10000,
      authorization_id: 'AUTH_12345',
      funding_at_risk: false,
      created_at: '2026-11-02T10:00:00.000Z',
      updated_at: '2026-11-02T10:05:00.000Z',
    }

    const parsed = ContractView.safeParse(sample)
    expect(parsed.success).toBe(true)
  })

  it('parses VerificationView REJECT sample', () => {
    const sample = {
      id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      submission_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
      status: 'COMPLETE',
      decision: 'REJECT',
      reasons: [
        {
          code: 'SCHEMA_INVALID',
          criterion_key: 'c1',
          message: 'Item 4 missing required field: sku',
        },
      ],
      degraded: false,
      cache_hit: false,
      created_at: '2026-11-02T12:00:00.000Z',
    }

    const parsed = VerificationView.safeParse(sample)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.decision).toBe('REJECT')
      expect(parsed.data.reasons[0]?.code).toBe('SCHEMA_INVALID')
    }
  })

  it('rejects unknown milestone status', () => {
    const parsed = MilestoneStatus.safeParse('UNKNOWN_STATUS')
    expect(parsed.success).toBe(false)
  })
})
