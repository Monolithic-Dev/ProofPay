/**
 * Pure Ledger Reducer (N2 Signature Feature)
 * 
 * Recomputes full contract and milestone lifecycle state from the append-only
 * SHA-256 ledger event stream alone.
 * 
 * Used for:
 * 1. Time-travel contract replay (/app/contracts/[id]/replay)
 * 2. Database state integrity validation (assert DB state matches ledger)
 * 3. Offline replay in /verify without trusting server database
 */

export interface MilestoneReplayState {
  key: string
  status: string
  amount_minor: number
  submissions_count: number
  last_submission_id?: string
  last_decision?: 'PASS' | 'REJECT' | 'ESCALATE'
  captured_minor: number
  voided_minor: number
  paypal_capture_id?: string
}

export interface ContractReplayState {
  contract_id: string
  status: string
  title?: string
  total_minor: number
  authorized_minor: number
  captured_minor: number
  voided_minor: number
  remaining_minor: number
  authorization_id?: string
  milestones: Record<string, MilestoneReplayState>
  events_count: number
  last_event_seq: number
  last_event_type: string
  last_event_at: string
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

/**
 * Pure reducer function to compute current state from an array of ledger events.
 */
export function reduceLedger(events: LedgerEventInput[], initialContractId = ''): ContractReplayState {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)

  const state: ContractReplayState = {
    contract_id: initialContractId,
    status: 'DRAFT',
    total_minor: 0,
    authorized_minor: 0,
    captured_minor: 0,
    voided_minor: 0,
    remaining_minor: 0,
    milestones: {},
    events_count: sorted.length,
    last_event_seq: 0,
    last_event_type: 'NONE',
    last_event_at: '',
  }

  for (const ev of sorted) {
    state.last_event_seq = ev.seq
    state.last_event_type = ev.type
    state.last_event_at = ev.created_at
    const p = ev.payload || {}

    switch (ev.type) {
      case 'CONTRACT_CREATED':
      case 'CONTRACT_DRAFTED':
        state.status = 'DRAFT'
        state.title = p.title || state.title
        state.total_minor = p.total_minor ?? state.total_minor
        state.remaining_minor = state.total_minor
        break

      case 'CONTRACT_PROPOSED':
        state.status = 'PROPOSED'
        break

      case 'CONTRACT_ACCEPTED':
        state.status = 'ACCEPTED'
        break

      case 'FUNDING_STARTED':
      case 'PAYPAL_ORDER_CREATED':
        state.status = 'FUNDING'
        break

      case 'FUNDING_AUTHORIZED':
      case 'CONTRACT_FUNDED':
        state.status = 'FUNDED'
        state.authorization_id = p.authorization_id || p.auth_id || state.authorization_id
        state.authorized_minor = p.authorized_amount_minor ?? state.total_minor
        state.remaining_minor = state.authorized_minor - state.captured_minor - state.voided_minor
        break

      case 'SUBMISSION_RECEIVED':
      case 'MILESTONE_SUBMITTED': {
        const mKey = p.milestone_key || p.milestone_id || 'm1'
        initMilestone(state, mKey, p.amount_minor)
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
        const mKey = p.milestone_key || 'm1'
        initMilestone(state, mKey)
        state.milestones[mKey]!.status = 'VERIFYING'
        break
      }

      case 'VERIFICATION_DECIDED':
      case 'MILESTONE_DECIDED': {
        const mKey = p.milestone_key || 'm1'
        initMilestone(state, mKey)
        const m = state.milestones[mKey]!
        const dec = p.decision as 'PASS' | 'REJECT' | 'ESCALATE'
        m.last_decision = dec
        if (dec === 'PASS') {
          m.status = 'PASSED'
        } else if (dec === 'REJECT') {
          m.status = 'REJECTED'
        } else {
          m.status = 'ESCALATED'
        }
        break
      }

      case 'RELEASE_INITIATED': {
        const mKey = p.milestone_key || 'm1'
        initMilestone(state, mKey)
        state.milestones[mKey]!.status = 'RELEASING'
        break
      }

      case 'PAYPAL_CAPTURED':
      case 'PAYMENT_CAPTURED':
      case 'MILESTONE_RELEASED': {
        const mKey = p.milestone_key || 'm1'
        const amount = p.amount_minor || p.captured_minor || 0
        initMilestone(state, mKey, amount)
        const m = state.milestones[mKey]!
        m.status = 'RELEASED'
        m.captured_minor += amount
        m.paypal_capture_id = p.capture_id || p.paypal_capture_id

        state.captured_minor += amount
        state.remaining_minor = Math.max(0, state.authorized_minor - state.captured_minor - state.voided_minor)

        // Check if all milestones released
        const allMilestones = Object.values(state.milestones)
        if (allMilestones.length > 0 && allMilestones.every((ms) => ms.status === 'RELEASED')) {
          state.status = 'COMPLETED'
        }
        break
      }

      case 'PAYPAL_VOIDED':
      case 'PAYMENT_VOIDED':
      case 'MILESTONE_VOIDED': {
        const mKey = p.milestone_key || 'm1'
        const amount = p.amount_minor || p.voided_minor || 0
        initMilestone(state, mKey, amount)
        const m = state.milestones[mKey]!
        m.status = 'VOIDED'
        m.voided_minor += amount

        state.voided_minor += amount
        state.remaining_minor = Math.max(0, state.authorized_minor - state.captured_minor - state.voided_minor)
        break
      }

      case 'CONTRACT_CANCELLED':
        state.status = 'CANCELLED'
        break

      case 'CONTRACT_FAILED':
        state.status = 'FAILED'
        break

      default:
        // Record unknown or telemetry-only events without mutating core financials
        break
    }
  }

  return state
}

function initMilestone(state: ContractReplayState, key: string, defaultAmount = 0) {
  if (!state.milestones[key]) {
    state.milestones[key] = {
      key,
      status: 'PENDING',
      amount_minor: defaultAmount,
      submissions_count: 0,
      captured_minor: 0,
      voided_minor: 0,
    }
  }
}

