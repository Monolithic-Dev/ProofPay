/**
 * Contract and milestone state machine transitions.
 * Implements data-model.md §6 — strictly validated state graphs.
 */
import { InvalidTransitionError } from '@/server/util/errors'
import type { ContractStatus, MilestoneStatus } from '@/shared/types'

// ---------------------------------------------------------------------------
// 6.1 Contract transition graph
// ---------------------------------------------------------------------------
export const CONTRACT_TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
  DRAFT: ['PROPOSED', 'CANCELLED'],
  PROPOSED: ['DRAFT', 'ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['FUNDING', 'CANCELLED'],
  FUNDING: ['ACCEPTED', 'FUNDED'],
  FUNDED: ['IN_PROGRESS', 'CANCELLED', 'EXPIRED'],
  IN_PROGRESS: ['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
}

export function canTransitionContract(from: ContractStatus, to: ContractStatus): boolean {
  return CONTRACT_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertContractTransition(from: ContractStatus, to: ContractStatus): void {
  if (!canTransitionContract(from, to)) {
    throw new InvalidTransitionError(from, to, 'contract')
  }
}

// ---------------------------------------------------------------------------
// 6.2 Milestone transition graph
// ---------------------------------------------------------------------------
export const MILESTONE_TRANSITIONS: Record<MilestoneStatus, readonly MilestoneStatus[]> = {
  PENDING: ['SUBMITTED'],
  SUBMITTED: ['VERIFYING'],
  VERIFYING: ['PASSED', 'REJECTED', 'ESCALATED'],
  PASSED: ['RELEASING'],
  REJECTED: ['SUBMITTED', 'FAILED_FINAL'],
  ESCALATED: ['PASSED', 'REJECTED'],
  RELEASING: ['RELEASED', 'RELEASE_FAILED'],
  RELEASE_FAILED: ['RELEASING'],
  RELEASED: [],
  FAILED_FINAL: ['VOIDED'],
  VOIDED: [],
}

export const CAPTURE_ENTRY_STATUS: MilestoneStatus = 'PASSED'

/**
 * Checks whether a milestone transition moves money on PayPal.
 * Only transitions into RELEASING trigger money movement (partial capture).
 */
export function isMoneyMovingTransition(from: MilestoneStatus, to: MilestoneStatus): boolean {
  return (from === 'PASSED' || from === 'RELEASE_FAILED') && to === 'RELEASING'
}

export function canTransitionMilestone(from: MilestoneStatus, to: MilestoneStatus): boolean {
  return MILESTONE_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertMilestoneTransition(from: MilestoneStatus, to: MilestoneStatus): void {
  if (!canTransitionMilestone(from, to)) {
    throw new InvalidTransitionError(from, to, 'milestone')
  }
}
