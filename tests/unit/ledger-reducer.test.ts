import { describe, it, expect } from 'vitest'
import { reduceLedger } from '@/shared/ledger-reducer'

describe('Pure Ledger Reducer (N2)', () => {
  it('correctly reduces a contract through full lifecycle: draft -> fund -> submit -> decide -> capture', () => {
    const events = [
      {
        seq: 1,
        type: 'CONTRACT_CREATED',
        actor_type: 'buyer',
        payload: { title: 'Test Dataset Contract', total_minor: 1000 },
        created_at: '2026-11-09T00:00:00Z',
      },
      {
        seq: 2,
        type: 'CONTRACT_FUNDED',
        actor_type: 'buyer',
        payload: { authorization_id: 'AUTH-12345', authorized_amount_minor: 1000 },
        created_at: '2026-11-09T00:01:00Z',
      },
      {
        seq: 3,
        type: 'MILESTONE_SUBMITTED',
        actor_type: 'seller',
        payload: { milestone_key: 'm1', amount_minor: 1000, submission_id: 'sub-1' },
        created_at: '2026-11-09T00:02:00Z',
      },
      {
        seq: 4,
        type: 'MILESTONE_DECIDED',
        actor_type: 'system',
        payload: { milestone_key: 'm1', decision: 'PASS' },
        created_at: '2026-11-09T00:03:00Z',
      },
      {
        seq: 5,
        type: 'MILESTONE_RELEASED',
        actor_type: 'paypal',
        payload: { milestone_key: 'm1', amount_minor: 1000, capture_id: 'CAP-777' },
        created_at: '2026-11-09T00:04:00Z',
      },
    ]

    const state = reduceLedger(events, 'c-100')

    expect(state.status).toBe('COMPLETED')
    expect(state.total_minor).toBe(1000)
    expect(state.authorized_minor).toBe(1000)
    expect(state.captured_minor).toBe(1000)
    expect(state.remaining_minor).toBe(0)
    expect(state.authorization_id).toBe('AUTH-12345')

    const m1 = state.milestones['m1']
    expect(m1).toBeDefined()
    expect(m1?.status).toBe('RELEASED')
    expect(m1?.last_decision).toBe('PASS')
    expect(m1?.paypal_capture_id).toBe('CAP-777')
    expect(m1?.captured_minor).toBe(1000)
  })

  it('correctly handles rejection without leaking captured funds', () => {
    const events = [
      {
        seq: 1,
        type: 'CONTRACT_CREATED',
        actor_type: 'buyer',
        payload: { total_minor: 2500 },
        created_at: '2026-11-09T00:00:00Z',
      },
      {
        seq: 2,
        type: 'CONTRACT_FUNDED',
        actor_type: 'buyer',
        payload: { authorization_id: 'AUTH-999', authorized_amount_minor: 2500 },
        created_at: '2026-11-09T00:01:00Z',
      },
      {
        seq: 3,
        type: 'MILESTONE_SUBMITTED',
        actor_type: 'seller',
        payload: { milestone_key: 'm1', amount_minor: 2500 },
        created_at: '2026-11-09T00:02:00Z',
      },
      {
        seq: 4,
        type: 'MILESTONE_DECIDED',
        actor_type: 'system',
        payload: { milestone_key: 'm1', decision: 'REJECT' },
        created_at: '2026-11-09T00:03:00Z',
      },
    ]

    const state = reduceLedger(events, 'c-200')

    expect(state.status).toBe('IN_PROGRESS')
    expect(state.captured_minor).toBe(0)
    expect(state.remaining_minor).toBe(2500)
    expect(state.milestones['m1']?.status).toBe('REJECTED')
  })
})

