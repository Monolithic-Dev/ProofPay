/**
 * Pure Ledger Reducer (N2 Signature Feature)
 *
 * Recomputes full contract and milestone lifecycle state from the append-only
 * SHA-256 ledger event stream alone.
 *
 * Used for:
 * 1. Time-travel contract replay (/contracts/[id]/replay)
 * 2. Database state integrity validation (assert DB state matches ledger)
 * 3. Offline replay in /verify without trusting server database
 */

export interface MilestoneReplayState {
  key: string
  status: string
  amount_minor: number
  submissions_count: number
  revisions_used: number
  last_submission_id?: string
  last_decision?: 'PASS' | 'REJECT' | 'ESCALATE'
  captured_minor: number
  voided_minor: number
  refunded_minor: number
  paypal_capture_id?: string
  auto_release_at?: string
  injection_flagged?: boolean
  security_blocked?: boolean
}

export interface ContractReplayState {
  contract_id: string
  status: string
  title?: string
  contract_hash?: string
  seller_id?: string
  paypal_order_id?: string
  authorization_id?: string
  total_minor: number
  authorized_minor: number
  captured_minor: number
  voided_minor: number
  refunded_minor: number
  remaining_minor: number
  funding_at_risk: boolean
  open_disputes: number
  injection_flags_count: number
  draft_edits_count: number
  reauthorizations_count: number
  milestones: Record<string, MilestoneReplayState>
  events_count: number
  last_event_seq: number
  last_event_type: string
  last_event_at: string
  unhandled_events: string[]
}

export interface LedgerEventInput {
  seq: number
  type: string
  actor_type: string
  actor_id?: string | null
  payload: Record<string, any>
  created_at: string
  hash?: string
  prev_hash?: string
}

export interface ReplayStep {
  seq: number
  event: LedgerEventInput
  state: ContractReplayState
}

/**
 * Pure reducer function to compute state at a specific event array.
 */
export function reduceLedger(
  events: LedgerEventInput[],
  initialContractId = ''
): ContractReplayState {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)

  const state: ContractReplayState = {
    contract_id: initialContractId,
    status: 'DRAFT',
    total_minor: 0,
    authorized_minor: 0,
    captured_minor: 0,
    voided_minor: 0,
    refunded_minor: 0,
    remaining_minor: 0,
    funding_at_risk: false,
    open_disputes: 0,
    injection_flags_count: 0,
    draft_edits_count: 0,
    reauthorizations_count: 0,
    milestones: {},
    events_count: sorted.length,
    last_event_seq: 0,
    last_event_type: 'NONE',
    last_event_at: '',
    unhandled_events: [],
  }

  for (const ev of sorted) {
    state.last_event_seq = ev.seq
    state.last_event_type = ev.type
    state.last_event_at = ev.created_at
    const p = (ev.payload || {}) as Record<string, any>

    switch (ev.type) {
      case 'CONTRACT_CREATED':
      case 'CONTRACT_DRAFTED':
        state.status = 'DRAFT'
        state.title = p.title || state.title
        state.total_minor = p.total_minor ?? state.total_minor
        state.remaining_minor = state.total_minor
        break

      case 'CONTRACT_LINTED':
        // Audit telemetry only
        break

      case 'contract_draft_edited':
      case 'CONTRACT_DRAFT_EDITED':
        state.draft_edits_count += 1
        if (state.status !== 'DRAFT') {
          state.status = 'DRAFT'
        }
        break

      case 'contract_proposed':
      case 'CONTRACT_PROPOSED':
        state.status = 'PROPOSED'
        if (p.contract_hash) state.contract_hash = p.contract_hash
        if (p.seller_id) state.seller_id = p.seller_id
        break

      case 'contract_accepted':
      case 'CONTRACT_ACCEPTED':
        state.status = 'ACCEPTED'
        if (p.seller_id) state.seller_id = p.seller_id
        break

      case 'contract_declined':
      case 'CONTRACT_DECLINED':
        state.status = 'CANCELLED'
        break

      case 'FUNDING_STARTED':
      case 'PAYPAL_ORDER_CREATED':
        state.status = 'FUNDING'
        if (p.paypal_order_id) state.paypal_order_id = p.paypal_order_id
        if (typeof p.total_minor === 'number' && state.total_minor === 0) {
          state.total_minor = p.total_minor
        }
        break

      case 'FUNDING_CANCELLED':
        state.status = 'ACCEPTED'
        state.paypal_order_id = undefined
        break

      case 'AUTHORIZATION_CREATED':
      case 'PAYPAL_AUTHORIZATION_CREATED':
      case 'FUNDING_AUTHORIZED':
      case 'CONTRACT_FUNDED':
        state.status = 'FUNDED'
        state.authorization_id =
          p.authorization_id ||
          p.paypal_authorization_id ||
          p.auth_id ||
          state.authorization_id
        if (p.paypal_order_id) {
          state.paypal_order_id = p.paypal_order_id
        }
        if (typeof p.total_minor === 'number' && state.total_minor === 0) {
          state.total_minor = p.total_minor
        }
        state.authorized_minor =
          p.authorized_amount_minor ?? p.amount_minor ?? state.total_minor
        if (state.total_minor === 0 && state.authorized_minor > 0) {
          state.total_minor = state.authorized_minor
        }
        state.remaining_minor = Math.max(
          0,
          state.authorized_minor - state.captured_minor - state.voided_minor
        )
        break

      case 'REAUTHORIZED':
        state.authorization_id = p.new_authorization_id || state.authorization_id
        state.reauthorizations_count += 1
        break

      case 'CONTRACT_STATUS_CHANGED':
        if (typeof p.to === 'string' && p.to.length > 0) {
          state.status = p.to
        }
        break

      case 'SUBMISSION_RECEIVED':
      case 'MILESTONE_SUBMITTED': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        initMilestone(state, mKey, p.amount_minor ?? 0)
        const m = state.milestones[mKey]!
        m.status = 'SUBMITTED'
        m.submissions_count += 1
        m.last_submission_id = p.submission_id
        if (state.status === 'FUNDED') {
          state.status = 'IN_PROGRESS'
        }
        break
      }

      case 'VERIFICATION_STARTED': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        initMilestone(state, mKey)
        state.milestones[mKey]!.status = 'VERIFYING'
        break
      }

      case 'INJECTION_FLAGGED': {
        state.injection_flags_count += 1
        const mKey = p.milestone_key || p.milestone_id
        if (mKey) {
          initMilestone(state, mKey)
          state.milestones[mKey]!.injection_flagged = true
        }
        break
      }

      case 'MILESTONE_PASSED': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        initMilestone(state, mKey)
        const m = state.milestones[mKey]!
        m.status = 'PASSED'
        m.last_decision = 'PASS'
        break
      }

      case 'MILESTONE_REJECTED': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        initMilestone(state, mKey)
        const m = state.milestones[mKey]!
        m.status = 'REJECTED'
        m.last_decision = 'REJECT'
        m.revisions_used =
          typeof p.revisions_used === 'number'
            ? p.revisions_used
            : m.revisions_used + 1
        break
      }

      case 'MILESTONE_FAILED_FINAL': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        initMilestone(state, mKey)
        const m = state.milestones[mKey]!
        m.status = 'FAILED_FINAL'
        m.last_decision = 'REJECT'
        m.revisions_used =
          typeof p.revisions_used === 'number'
            ? p.revisions_used
            : m.revisions_used + 1
        break
      }

      case 'SUBMISSION_ESCALATED': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        initMilestone(state, mKey)
        const m = state.milestones[mKey]!
        m.status = 'ESCALATED'
        m.last_decision = 'ESCALATE'
        if (p.auto_release_at) {
          m.auto_release_at = String(p.auto_release_at)
        }
        break
      }

      case 'VERIFICATION_DECIDED':
      case 'VERIFICATION_COMPLETED':
      case 'MILESTONE_DECIDED':
      case 'DELIVERABLE_VERIFIED': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        initMilestone(state, mKey, p.amount_minor ?? 0)
        const m = state.milestones[mKey]!
        const dec = p.decision as 'PASS' | 'REJECT' | 'ESCALATE'
        m.last_decision = dec
        if (dec === 'PASS') {
          m.status = 'PASSED'
        } else if (dec === 'REJECT') {
          m.revisions_used =
            typeof p.revisions_used === 'number'
              ? p.revisions_used
              : m.revisions_used + 1
          m.status = p.final_failure ? 'FAILED_FINAL' : 'REJECTED'
        } else {
          m.status = 'ESCALATED'
          if (p.auto_release_at) {
            m.auto_release_at = String(p.auto_release_at)
          }
        }
        break
      }

      case 'BUYER_DECISION': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        initMilestone(state, mKey)
        const m = state.milestones[mKey]!
        if (p.decision === 'APPROVE') {
          m.status = 'PASSED'
          m.last_decision = 'PASS'
        } else if (p.decision === 'REJECT') {
          m.last_decision = 'REJECT'
          m.revisions_used =
            typeof p.revisions_used === 'number'
              ? p.revisions_used
              : m.revisions_used + 1
          m.status = p.final_failure ? 'FAILED_FINAL' : 'REJECTED'
        }
        break
      }

      case 'AUTO_RELEASE_TRIGGERED':
      case 'AUTO_RELEASE_APPLIED': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        initMilestone(state, mKey)
        const m = state.milestones[mKey]!
        m.status = 'PASSED'
        m.last_decision = 'PASS'
        break
      }

      case 'AUTO_RELEASE_BLOCKED_SECURITY_RISK': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        initMilestone(state, mKey)
        state.milestones[mKey]!.security_blocked = true
        break
      }

      case 'CAPTURE_REQUESTED':
      case 'RELEASE_INITIATED': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        initMilestone(state, mKey, p.amount_minor ?? 0)
        const m = state.milestones[mKey]!
        if (p.amount_minor && !m.amount_minor) {
          m.amount_minor = p.amount_minor
        }
        m.status = 'RELEASING'
        break
      }

      case 'CAPTURE_COMPLETED':
      case 'PAYPAL_CAPTURE_COMPLETED':
      case 'PAYPAL_CAPTURED':
      case 'PAYMENT_CAPTURED':
      case 'MILESTONE_RELEASED': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        const amount = p.amount_minor ?? p.captured_minor ?? 0
        initMilestone(state, mKey, amount)
        const m = state.milestones[mKey]!
        if (amount > 0 && m.amount_minor === 0) {
          m.amount_minor = amount
        }
        m.status = 'RELEASED'
        m.captured_minor += amount
        m.paypal_capture_id =
          p.capture_id || p.paypal_capture_id || m.paypal_capture_id

        state.captured_minor += amount
        state.remaining_minor = Math.max(
          0,
          state.authorized_minor - state.captured_minor - state.voided_minor
        )

        // Transition to COMPLETED only if all tracked milestones are settled AND authorized hold is exhausted
        const allMilestones = Object.values(state.milestones)
        const allSettled =
          allMilestones.length > 0 &&
          allMilestones.every(
            (ms) => ms.status === 'RELEASED' || ms.status === 'VOIDED'
          )
        const holdExhausted =
          state.authorized_minor === 0 ||
          state.captured_minor + state.voided_minor >= state.authorized_minor
        if (allSettled && holdExhausted) {
          state.status = 'COMPLETED'
        } else if (state.status === 'FUNDED') {
          state.status = 'IN_PROGRESS'
        }
        break
      }

      case 'CAPTURE_FAILED': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        initMilestone(state, mKey)
        state.milestones[mKey]!.status = 'RELEASE_FAILED'
        break
      }

      case 'REFUND_ISSUED': {
        const amount = p.amount_minor ?? 0
        state.refunded_minor += amount
        const mKey = p.milestone_key || p.milestone_id
        if (mKey) {
          initMilestone(state, mKey, amount)
          state.milestones[mKey]!.refunded_minor += amount
        }
        break
      }

      case 'AUTHORIZATION_VOIDED':
      case 'PAYPAL_VOIDED':
      case 'PAYMENT_VOIDED':
      case 'MILESTONE_VOIDED': {
        if (p.milestone_key || p.milestone_id) {
          const mKey = p.milestone_key || p.milestone_id
          const amount = p.amount_minor ?? p.voided_minor ?? 0
          initMilestone(state, mKey, amount)
          const m = state.milestones[mKey]!
          m.status = 'VOIDED'
          m.voided_minor += amount
          state.voided_minor += amount
        } else {
          // Whole-authorization void from voidRemaining()
          for (const m of Object.values(state.milestones)) {
            if (m.status !== 'RELEASED' && m.status !== 'VOIDED') {
              m.status = 'VOIDED'
              if (m.amount_minor > m.captured_minor) {
                m.voided_minor = m.amount_minor - m.captured_minor
              }
            }
          }
          const voidedRemaining =
            typeof p.remaining_minor === 'number'
              ? p.remaining_minor
              : Math.max(0, state.authorized_minor - state.captured_minor)
          state.voided_minor = Math.max(state.voided_minor, voidedRemaining)
        }
        state.remaining_minor = Math.max(
          0,
          state.authorized_minor - state.captured_minor - state.voided_minor
        )
        break
      }

      case 'DISPUTE_OPENED':
        state.open_disputes += 1
        state.funding_at_risk = true
        break

      case 'DISPUTE_RESOLVED': {
        const remainingOpen =
          typeof p.remaining_open === 'number'
            ? p.remaining_open
            : Math.max(0, state.open_disputes - 1)
        state.open_disputes = remainingOpen
        if (remainingOpen === 0) {
          state.funding_at_risk = false
        }
        break
      }

      case 'CONTRACT_COMPLETED':
        state.status = 'COMPLETED'
        break

      case 'CONTRACT_CANCELLED':
        state.status = 'CANCELLED'
        break

      case 'CONTRACT_FAILED':
        state.status = 'FAILED'
        break

      case 'CONTRACT_EXPIRED':
        state.status = 'EXPIRED'
        break

      case 'WEBHOOK_RECEIVED':
      case 'DISPUTE_EVIDENCE_SUBMITTED':
        // Audit telemetry events
        break

      default:
        state.unhandled_events.push(ev.type)
        break
    }
  }

  return state
}

/**
 * Recompute deterministic contract & milestone state up to a specific sequence number (inclusive).
 */
export function replayUpToSeq(
  events: LedgerEventInput[],
  maxSeq: number,
  initialContractId = ''
): ContractReplayState {
  const prefix = events.filter((ev) => ev.seq <= maxSeq)
  return reduceLedger(prefix, initialContractId)
}

/**
 * Build the complete frame-by-frame time-travel timeline for an event stream.
 */
export function reconstructTimeline(
  events: LedgerEventInput[],
  initialContractId = ''
): ReplayStep[] {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  return sorted.map((ev, idx) => ({
    seq: ev.seq,
    event: ev,
    state: reduceLedger(sorted.slice(0, idx + 1), initialContractId),
  }))
}

function initMilestone(
  state: ContractReplayState,
  key: string,
  defaultAmount = 0
) {
  if (!state.milestones[key]) {
    state.milestones[key] = {
      key,
      status: 'PENDING',
      amount_minor: defaultAmount,
      submissions_count: 0,
      revisions_used: 0,
      captured_minor: 0,
      voided_minor: 0,
      refunded_minor: 0,
    }
  } else if (defaultAmount > 0 && state.milestones[key]!.amount_minor === 0) {
    state.milestones[key]!.amount_minor = defaultAmount
  }
}
