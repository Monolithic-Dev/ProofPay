import { describe, it, expect } from 'vitest'
import {
  CONTRACT_TRANSITIONS,
  MILESTONE_TRANSITIONS,
  canTransitionContract,
  canTransitionMilestone,
  assertContractTransition,
  assertMilestoneTransition,
  isMoneyMovingTransition,
} from '@/server/contracts/transitions'
import type { ContractStatus, MilestoneStatus } from '@/shared/types'
import { InvalidTransitionError } from '@/server/util/errors'

const ALL_CONTRACT_STATUSES: ContractStatus[] = [
  'DRAFT',
  'PROPOSED',
  'ACCEPTED',
  'FUNDING',
  'FUNDED',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
]

const ALL_MILESTONE_STATUSES: MilestoneStatus[] = [
  'PENDING',
  'SUBMITTED',
  'VERIFYING',
  'PASSED',
  'REJECTED',
  'ESCALATED',
  'RELEASING',
  'RELEASED',
  'RELEASE_FAILED',
  'FAILED_FINAL',
  'VOIDED',
]

describe('State machine transitions', () => {
  describe('Contract transitions', () => {
    it('allows all defined contract transitions', () => {
      for (const [from, validTos] of Object.entries(CONTRACT_TRANSITIONS)) {
        for (const to of validTos) {
          expect(canTransitionContract(from as ContractStatus, to)).toBe(true)
          expect(() => assertContractTransition(from as ContractStatus, to)).not.toThrow()
        }
      }
    })

    it('rejects every disallowed edge in the contract cross product', () => {
      for (const from of ALL_CONTRACT_STATUSES) {
        const allowed = CONTRACT_TRANSITIONS[from] ?? []
        for (const to of ALL_CONTRACT_STATUSES) {
          if (!allowed.includes(to)) {
            expect(canTransitionContract(from, to)).toBe(false)
            expect(() => assertContractTransition(from, to)).toThrow(InvalidTransitionError)
          }
        }
      }
    })

    it('terminal contract states have zero outgoing edges', () => {
      const terminals: ContractStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED']
      for (const term of terminals) {
        expect(CONTRACT_TRANSITIONS[term]).toHaveLength(0)
      }
    })
  })

  describe('Milestone transitions', () => {
    it('allows all defined milestone transitions', () => {
      for (const [from, validTos] of Object.entries(MILESTONE_TRANSITIONS)) {
        for (const to of validTos) {
          expect(canTransitionMilestone(from as MilestoneStatus, to)).toBe(true)
          expect(() => assertMilestoneTransition(from as MilestoneStatus, to)).not.toThrow()
        }
      }
    })

    it('rejects every disallowed edge in the milestone cross product', () => {
      for (const from of ALL_MILESTONE_STATUSES) {
        const allowed = MILESTONE_TRANSITIONS[from] ?? []
        for (const to of ALL_MILESTONE_STATUSES) {
          if (!allowed.includes(to)) {
            expect(canTransitionMilestone(from, to)).toBe(false)
            expect(() => assertMilestoneTransition(from, to)).toThrow(InvalidTransitionError)
          }
        }
      }
    })

    it('only PASSED and RELEASE_FAILED can enter RELEASING', () => {
      for (const from of ALL_MILESTONE_STATUSES) {
        const allowed = canTransitionMilestone(from, 'RELEASING')
        if (from === 'PASSED' || from === 'RELEASE_FAILED') {
          expect(allowed).toBe(true)
          expect(isMoneyMovingTransition(from, 'RELEASING')).toBe(true)
        } else {
          expect(allowed).toBe(false)
          expect(isMoneyMovingTransition(from, 'RELEASING')).toBe(false)
        }
      }
    })

    it('terminal milestone states have zero outgoing edges', () => {
      const terminals: MilestoneStatus[] = ['RELEASED', 'VOIDED']
      for (const term of terminals) {
        expect(MILESTONE_TRANSITIONS[term]).toHaveLength(0)
      }
    })
  })
})
