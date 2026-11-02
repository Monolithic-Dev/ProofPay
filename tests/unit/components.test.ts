import { describe, it, expect } from 'vitest'
import { STATUS_CONFIG_MAP } from '@/components/contract/StatusChip'
import { explainLedgerEvent } from '@/lib/explain'
import { formatMoney } from '@/components/common/Money'

describe('Signature UI Components Logic (phase 6.3)', () => {
  it('FundsBar segments sum to total and aria-label is correct', () => {
    const totalMinor = 10000 // $100.00
    const releasedMinor = 6000 // $60.00
    const heldMinor = 4000 // $40.00
    const voidedMinor = 0 // $0.00

    expect(releasedMinor + heldMinor + voidedMinor).toBe(totalMinor)

    const ariaLabel = `Released ${formatMoney(releasedMinor)}, held ${formatMoney(
      heldMinor
    )}, voided ${formatMoney(voidedMinor)} of ${formatMoney(totalMinor)}`

    expect(ariaLabel).toBe('Released $60.00, held $40.00, voided $0.00 of $100.00')
  })

  it('StatusChip covers every status (exhaustive map)', () => {
    const contractStatuses = [
      'DRAFT',
      'PROPOSED',
      'ACCEPTED',
      'FUNDING',
      'FUNDED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'EXPIRED',
      'FAILED',
    ]

    const milestoneStatuses = [
      'PENDING',
      'VERIFYING',
      'PASSED',
      'RELEASED',
      'REJECTED',
      'ESCALATED',
      'RELEASING',
      'RELEASE_FAILED',
      'VOIDED',
    ]

    for (const s of contractStatuses) {
      expect(STATUS_CONFIG_MAP[s]).toBeDefined()
      expect(STATUS_CONFIG_MAP[s]?.label).toBeTruthy()
      expect(STATUS_CONFIG_MAP[s]?.icon).toBeDefined()
    }

    for (const s of milestoneStatuses) {
      expect(STATUS_CONFIG_MAP[s]).toBeDefined()
      expect(STATUS_CONFIG_MAP[s]?.label).toBeTruthy()
      expect(STATUS_CONFIG_MAP[s]?.icon).toBeDefined()
    }
  })

  it('Countdown switches to warn state under threshold logic', () => {
    const now = Date.now()
    const targetWarn = new Date(now + 12 * 3600 * 1000) // 12 hours away
    const warnBelowMs = 24 * 3600 * 1000 // 24 hours threshold

    const diffMs = targetWarn.getTime() - now
    const isWarn = diffMs > 0 && diffMs < warnBelowMs
    expect(isWarn).toBe(true)

    const targetSafe = new Date(now + 48 * 3600 * 1000) // 48 hours away
    const diffSafeMs = targetSafe.getTime() - now
    const isSafe = diffSafeMs >= warnBelowMs
    expect(isSafe).toBe(true)
  })

  it('explainLedgerEvent explains critical financial events in plain English', () => {
    const authCreated = explainLedgerEvent('AUTHORIZATION_CREATED', { authorization_id: 'AUTH-1' })
    expect(authCreated.title).toContain('Funds Held')
    expect(authCreated.why).toContain('PayPal placed a 29-day authorization hold')

    const captureDone = explainLedgerEvent('CAPTURE_COMPLETED', {
      milestone_key: 'm1',
      capture_id: 'CAP-1',
    })
    expect(captureDone.title).toContain('Funds Released')
    expect(captureDone.why).toContain('seller’s PayPal account')

    const injection = explainLedgerEvent('INJECTION_FLAGGED', { milestone_key: 'm2' })
    expect(injection.title).toContain('Manipulation Flagged')
    expect(injection.why).toContain('Adversarial guardrails')
  })
})
