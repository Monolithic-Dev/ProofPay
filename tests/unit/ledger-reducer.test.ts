import { describe, it, expect } from 'vitest'
import { reduceLedger, replayUpToSeq, reconstructTimeline } from '@/shared/ledger-reducer'
import { compareDbToLedgerState } from '@/server/ledger/state-check'

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

  it('handles full production lifecycle events, partial captures, escalations, buyer decisions, voids, refunds, and disputes', () => {
    const events = [
      {
        seq: 1,
        type: 'CONTRACT_CREATED',
        actor_type: 'buyer',
        payload: { title: 'Multi-Milestone Pipeline', total_minor: 10000 },
        created_at: '2026-11-09T01:00:00Z',
      },
      {
        seq: 2,
        type: 'contract_proposed',
        actor_type: 'buyer',
        payload: { contract_hash: 'hash-abc', seller_id: 'seller-1' },
        created_at: '2026-11-09T01:01:00Z',
      },
      {
        seq: 3,
        type: 'contract_accepted',
        actor_type: 'seller',
        payload: { seller_id: 'seller-1' },
        created_at: '2026-11-09T01:02:00Z',
      },
      {
        seq: 4,
        type: 'FUNDING_STARTED',
        actor_type: 'buyer',
        payload: { paypal_order_id: 'ORD-1', total_minor: 10000 },
        created_at: '2026-11-09T01:03:00Z',
      },
      {
        seq: 5,
        type: 'AUTHORIZATION_CREATED',
        actor_type: 'paypal',
        payload: { authorization_id: 'AUTH-PROD-1' },
        created_at: '2026-11-09T01:04:00Z',
      },
      {
        seq: 6,
        type: 'CONTRACT_STATUS_CHANGED',
        actor_type: 'system',
        payload: { from: 'FUNDED', to: 'IN_PROGRESS' },
        created_at: '2026-11-09T01:05:00Z',
      },
      {
        seq: 7,
        type: 'SUBMISSION_RECEIVED',
        actor_type: 'seller',
        payload: { milestone_key: 'm1', submission_id: 'sub-1' },
        created_at: '2026-11-09T01:05:01Z',
      },
      {
        seq: 8,
        type: 'MILESTONE_PASSED',
        actor_type: 'system',
        payload: { milestone_key: 'm1' },
        created_at: '2026-11-09T01:06:00Z',
      },
      {
        seq: 9,
        type: 'CAPTURE_REQUESTED',
        actor_type: 'system',
        payload: { milestone_key: 'm1', amount_minor: 4000 },
        created_at: '2026-11-09T01:07:00Z',
      },
      {
        seq: 10,
        type: 'CAPTURE_COMPLETED',
        actor_type: 'paypal',
        payload: { milestone_key: 'm1', capture_id: 'CAP-M1', amount_minor: 4000 },
        created_at: '2026-11-09T01:08:00Z',
      },
      {
        seq: 11,
        type: 'SUBMISSION_RECEIVED',
        actor_type: 'seller',
        payload: { milestone_key: 'm2', submission_id: 'sub-2' },
        created_at: '2026-11-09T01:09:00Z',
      },
      {
        seq: 12,
        type: 'SUBMISSION_ESCALATED',
        actor_type: 'system',
        payload: { milestone_key: 'm2', auto_release_at: '2026-11-12T01:10:00Z' },
        created_at: '2026-11-09T01:10:00Z',
      },
      {
        seq: 13,
        type: 'BUYER_DECISION',
        actor_type: 'buyer',
        payload: { milestone_key: 'm2', decision: 'REJECT', final_failure: true, revisions_used: 3 },
        created_at: '2026-11-09T01:11:00Z',
      },
      {
        seq: 14,
        type: 'AUTHORIZATION_VOIDED',
        actor_type: 'system',
        payload: { authorization_id: 'AUTH-PROD-1', remaining_minor: 6000, reason: 'final_failure' },
        created_at: '2026-11-09T01:12:00Z',
      },
      {
        seq: 15,
        type: 'CONTRACT_FAILED',
        actor_type: 'system',
        payload: { reason: 'final_failure' },
        created_at: '2026-11-09T01:12:01Z',
      },
    ]

    // Mid-timeline check right after partial capture seq #10
    const midState = replayUpToSeq(events, 10, 'c-300')
    expect(midState.status).toBe('IN_PROGRESS')
    expect(midState.captured_minor).toBe(4000)
    expect(midState.remaining_minor).toBe(6000)
    expect(midState.milestones['m1']?.status).toBe('RELEASED')

    // Full replay check
    const timeline = reconstructTimeline(events, 'c-300')
    expect(timeline).toHaveLength(15)

    const finalState = timeline[timeline.length - 1]!.state
    expect(finalState.status).toBe('FAILED')
    expect(finalState.captured_minor).toBe(4000)
    expect(finalState.voided_minor).toBe(6000)
    expect(finalState.remaining_minor).toBe(0)
    expect(finalState.milestones['m1']?.status).toBe('RELEASED')
    expect(finalState.milestones['m2']?.status).toBe('VOIDED')
    expect(finalState.unhandled_events).toEqual([])

    // Verify 1:1 DB parity passes cleanly when DB matches ledger
    const zeroMismatches = compareDbToLedgerState(
      {
        id: 'c-300',
        status: 'FAILED',
        total_minor: 10000,
        authorization_id: 'AUTH-PROD-1',
        milestones: [
          { milestone_key: 'm1', status: 'RELEASED', amount_minor: 4000, capture_id: 'CAP-M1' },
          { milestone_key: 'm2', status: 'VOIDED', amount_minor: 6000, capture_id: null },
        ],
      },
      finalState
    )
    expect(zeroMismatches).toEqual([])

    // Verify parity check detects silent DB tampering / drift
    const detectedMismatches = compareDbToLedgerState(
      {
        id: 'c-300',
        status: 'COMPLETED',
        total_minor: 10000,
        authorization_id: 'AUTH-PROD-1',
        milestones: [
          { milestone_key: 'm1', status: 'RELEASED', amount_minor: 9999, capture_id: 'CAP-M1' },
          { milestone_key: 'm2', status: 'RELEASED', amount_minor: 6000, capture_id: 'FAKE' },
        ],
      },
      finalState
    )
    expect(detectedMismatches.length).toBeGreaterThanOrEqual(3)
    expect(detectedMismatches.some((m) => m.scope === 'contract' && m.field === 'status')).toBe(true)
    expect(detectedMismatches.some((m) => m.scope === 'milestone:m2' && m.field === 'status')).toBe(true)
  })
})
