import { describe, it, expect } from 'vitest'
import {
  validateBuyerOfferAgainstMandate,
  validateSellerOfferAgainstMandate,
  type BuyerMandate,
  type SellerMandate,
  type ContractOfferProposal,
} from '@/lib/negotiation/policy'

describe('Bounded Agent Negotiation Mandates (F5)', () => {
  const buyerMandate: BuyerMandate = {
    max_total_minor: 15000, // $150.00
    max_milestones: 3,
    max_due_days: 14,
    required_criteria_keys: ['c_schema_valid', 'c_min_rows'],
  }

  const sellerMandate: SellerMandate = {
    min_total_minor: 10000, // $100.00
    min_due_days: 5,
    max_revisions_allowed: 2,
  }

  it('approves offers within human-mandated policy limits', () => {
    const validOffer: ContractOfferProposal = {
      proposer_role: 'seller',
      total_minor: 12500, // $125.00
      due_days: 7,
      milestones_count: 2,
      criteria_keys: ['c_schema_valid', 'c_min_rows', 'c_word_count'],
      rationale: 'Adjusted price for expedited research turnaround.',
    }

    const buyerCheck = validateBuyerOfferAgainstMandate(validOffer, buyerMandate)
    const sellerCheck = validateSellerOfferAgainstMandate(validOffer, sellerMandate)

    expect(buyerCheck.allowed).toBe(true)
    expect(sellerCheck.allowed).toBe(true)
  })

  it('rejects agent offers that exceed maximum budget', () => {
    const expensiveOffer: ContractOfferProposal = {
      proposer_role: 'seller',
      total_minor: 20000, // $200.00 (exceeds $150)
      due_days: 7,
      milestones_count: 2,
      criteria_keys: ['c_schema_valid', 'c_min_rows'],
    }

    const check = validateBuyerOfferAgainstMandate(expensiveOffer, buyerMandate)
    expect(check.allowed).toBe(false)
    expect(check.violations[0]).toContain('exceeds buyer mandate maximum')
  })

  it('strictly blocks an agent from removing mandated required criteria', () => {
    const strippedOffer: ContractOfferProposal = {
      proposer_role: 'seller',
      total_minor: 12000,
      due_days: 7,
      milestones_count: 2,
      criteria_keys: ['c_schema_valid'], // Removed 'c_min_rows'!
    }

    const check = validateBuyerOfferAgainstMandate(strippedOffer, buyerMandate)
    expect(check.allowed).toBe(false)
    expect(check.violations[0]).toContain('Mandated quality criterion "c_min_rows" cannot be removed')
  })
})
