/**
 * Contract and milestone state machine transitions.
 * Implements data-model.md §6 — enforced here at the service layer.
 */
import { InvalidTransitionError } from '@/server/util/errors'
import type { ContractStatus, MilestoneStatus } from '@/shared/types'

// ---------------------------------------------------------------------------
// Contract transitions
// ---------------------------------------------------------------------------
type ContractTransition = {
  from: ContractStatus | ContractStatus[]
  to: ContractStatus
  actor?: 'buyer' | 'seller' | 'system' | 'either'
}

const CONTRACT_TRANSITIONS: ContractTransition[] = [
  { from: 'DRAFT', to: 'PROPOSED', actor: 'buyer' },
  { from: 'PROPOSED', to: 'DRAFT', actor: 'buyer' },
  { from: 'PROPOSED', to: 'ACCEPTED', actor: 'seller' },
  { from: 'ACCEPTED', to: 'FUNDING', actor: 'buyer' },
  { from: 'FUNDING', to: 'ACCEPTED', actor: 'system' },
  { from: 'FUNDING', to: 'FUNDED', actor: 'system' },
  { from: 'FUNDED', to: 'IN_PROGRESS', actor: 'system' },
  { from: 'IN_PROGRESS', to: 'COMPLETED', actor: 'system' },
  { from: 'IN_PROGRESS', to: 'FAILED', actor: 'system' },
  { from: ['FUNDED', 'IN_PROGRESS'], to: 'CANCELLED', actor: 'buyer' },
  { from: ['FUNDED', 'IN_PROGRESS'], to: 'EXPIRED', actor: 'system' },
  { from: ['DRAFT', 'PROPOSED', 'ACCEPTED'], to: 'CANCELLED', actor: 'either' },
]

export function assertContractTransition(from: ContractStatus, to: ContractStatus): void {
  const valid = CONTRACT_TRANSITIONS.some((t) => {
    const froms = Array.isArray(t.from) ? t.from : [t.from]
    return froms.includes(from) && t.to === to
  })
  if (!valid) throw new InvalidTransitionError(from, to, 'contract')
}

export function canTransitionContract(from: ContractStatus, to: ContractStatus): boolean {
  try {
    assertContractTransition(from, to)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Milestone transitions
// ---------------------------------------------------------------------------
type MilestoneTransition = {
  from: MilestoneStatus | MilestoneStatus[]
  to: MilestoneStatus
}

const MILESTONE_TRANSITIONS: MilestoneTransition[] = [
  { from: 'PENDING', to: 'SUBMITTED' },
  { from: 'REJECTED', to: 'SUBMITTED' }, // resubmission
  { from: 'SUBMITTED', to: 'VERIFYING' },
  { from: 'VERIFYING', to: 'PASSED' },
  { from: 'VERIFYING', to: 'REJECTED' },
  { from: 'VERIFYING', to: 'ESCALATED' },
  { from: 'REJECTED', to: 'FAILED_FINAL' }, // revisions exhausted
  { from: 'ESCALATED', to: 'PASSED' }, // buyer approves or auto-release
  { from: 'ESCALATED', to: 'REJECTED' }, // buyer rejects
  { from: 'PASSED', to: 'RELEASING' }, // release job claims
  { from: 'RELEASING', to: 'RELEASED' },
  { from: 'RELEASING', to: 'RELEASE_FAILED' },
  { from: 'RELEASE_FAILED', to: 'RELEASING' }, // retry
  { from: 'FAILED_FINAL', to: 'VOIDED' }, // remaining voided
]

export function assertMilestoneTransition(from: MilestoneStatus, to: MilestoneStatus): void {
  const valid = MILESTONE_TRANSITIONS.some((t) => {
    const froms = Array.isArray(t.from) ? t.from : [t.from]
    return froms.includes(from) && t.to === to
  })
  if (!valid) throw new InvalidTransitionError(from, to, 'milestone')
}

export function canTransitionMilestone(from: MilestoneStatus, to: MilestoneStatus): boolean {
  try {
    assertMilestoneTransition(from, to)
    return true
  } catch {
    return false
  }
}
