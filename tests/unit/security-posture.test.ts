import { describe, it, expect } from 'vitest'
import { calculateSecurityPosture } from '@/shared/security'

describe('PLAT-6 Security Posture Scoring (src/shared/security.ts)', () => {
  it('awards 100/100 for perfectly hardened org posture', () => {
    const posture = calculateSecurityPosture({
      mfaPrivilegedTotal: 3,
      mfaPrivilegedEnrolled: 3,
      apiKeysTotal: 2,
      apiKeysOlder90d: 0,
      apiKeysWithoutExpiry: 0,
      apiKeysWithoutAllowlist: 0,
      staleSessions30d: 0,
      pendingInvitesOlder14d: 0,
      unverifiedMembers: 0,
      riskEventsCount: 0,
      stepUpEnforced: true,
    })

    expect(posture.score).toBe(100)
    expect(posture.recommendations).toHaveLength(0)
  })

  it('deducts points and generates high-severity recommendation when MFA is missing', () => {
    const posture = calculateSecurityPosture({
      mfaPrivilegedTotal: 2,
      mfaPrivilegedEnrolled: 0, // 0/2 enrolled
      apiKeysTotal: 1,
      apiKeysOlder90d: 0,
      apiKeysWithoutExpiry: 0,
      apiKeysWithoutAllowlist: 0,
      staleSessions30d: 0,
      pendingInvitesOlder14d: 0,
      unverifiedMembers: 0,
      riskEventsCount: 0,
      stepUpEnforced: true,
    })

    expect(posture.score).toBe(70) // 100 - 30 MFA points
    const mfaRec = posture.recommendations.find((r) => r.id === 'rec_mfa')
    expect(mfaRec).toBeDefined()
    expect(mfaRec?.severity).toBe('high')
  })

  it('deducts points for stale API keys without allowlists', () => {
    const posture = calculateSecurityPosture({
      mfaPrivilegedTotal: 1,
      mfaPrivilegedEnrolled: 1,
      apiKeysTotal: 2,
      apiKeysOlder90d: 1, // 8 pts deduction
      apiKeysWithoutExpiry: 0,
      apiKeysWithoutAllowlist: 1, // 6 pts deduction
      staleSessions30d: 0,
      pendingInvitesOlder14d: 0,
      unverifiedMembers: 0,
      riskEventsCount: 0,
      stepUpEnforced: true,
    })

    expect(posture.score).toBe(86) // 100 - 14
    expect(posture.recommendations.some((r) => r.id === 'rec_key_age')).toBe(true)
    expect(posture.recommendations.some((r) => r.id === 'rec_key_cidr')).toBe(true)
  })

  it('deducts points when step-up is in shadow mode', () => {
    const posture = calculateSecurityPosture({
      mfaPrivilegedTotal: 1,
      mfaPrivilegedEnrolled: 1,
      apiKeysTotal: 0,
      apiKeysOlder90d: 0,
      apiKeysWithoutExpiry: 0,
      apiKeysWithoutAllowlist: 0,
      staleSessions30d: 0,
      pendingInvitesOlder14d: 0,
      unverifiedMembers: 0,
      riskEventsCount: 0,
      stepUpEnforced: false, // 5 pts deduction
    })

    expect(posture.score).toBe(95)
    expect(posture.recommendations.some((r) => r.id === 'rec_step_up')).toBe(true)
  })
})

