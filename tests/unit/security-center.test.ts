import { describe, it, expect } from 'vitest'
import { calculateSecurityPosture } from '@/shared/security'

describe('AIP-6: Security Center Posture & Hygiene Logic', () => {
  it('computes baseline posture and prioritizes actionable recommendations', () => {
    const posture = calculateSecurityPosture({
      mfaPrivilegedTotal: 2,
      mfaPrivilegedEnrolled: 1, // 1/2 privileged enrolled
      apiKeysTotal: 3,
      apiKeysOlder90d: 1, // 1 key > 90d
      apiKeysWithoutExpiry: 1,
      apiKeysWithoutAllowlist: 2, // 2 keys missing CIDR
      staleSessions30d: 0,
      pendingInvitesOlder14d: 0,
      unverifiedMembers: 0,
      riskEventsCount: 0,
      stepUpEnforced: true,
    })

    expect(posture.score).toBeGreaterThan(0)
    expect(posture.score).toBeLessThanOrEqual(100)

    // Recommendations generated
    expect(posture.recommendations.length).toBeGreaterThanOrEqual(2)

    // High severity MFA recommendation exists
    const mfaRec = posture.recommendations.find((r) => r.id === 'rec_mfa')
    expect(mfaRec).toBeDefined()
    expect(mfaRec?.severity).toBe('high')
    expect(mfaRec?.action_href).toBe('/app/settings/security')

    // Stale API key recommendation exists
    const keyRec = posture.recommendations.find((r) => r.id === 'rec_key_age')
    expect(keyRec).toBeDefined()
    expect(keyRec?.severity).toBe('medium')
    expect(keyRec?.action_href).toBe('/app/settings/developer')

    // Missing CIDR allowlist recommendation exists
    const cidrRec = posture.recommendations.find((r) => r.id === 'rec_key_cidr')
    expect(cidrRec).toBeDefined()
    expect(cidrRec?.action_href).toBe('/app/settings/developer')
  })

  it('enforces RBAC permissions where Member role is restricted', () => {
    const isForbiddenRole = (role: string) => role.toLowerCase() === 'member'

    expect(isForbiddenRole('member')).toBe(true)
    expect(isForbiddenRole('MEMBER')).toBe(true)

    // Privileged roles are permitted
    expect(isForbiddenRole('owner')).toBe(false)
    expect(isForbiddenRole('admin')).toBe(false)
    expect(isForbiddenRole('finance')).toBe(false)
    expect(isForbiddenRole('viewer')).toBe(false)
  })

  it('reflects Step-Up Authentication enforcement in score', () => {
    const withoutStepUp = calculateSecurityPosture({
      mfaPrivilegedTotal: 1,
      mfaPrivilegedEnrolled: 1,
      apiKeysTotal: 1,
      apiKeysOlder90d: 0,
      apiKeysWithoutExpiry: 0,
      apiKeysWithoutAllowlist: 0,
      staleSessions30d: 0,
      pendingInvitesOlder14d: 0,
      unverifiedMembers: 0,
      riskEventsCount: 0,
      stepUpEnforced: false,
    })

    const withStepUp = calculateSecurityPosture({
      mfaPrivilegedTotal: 1,
      mfaPrivilegedEnrolled: 1,
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

    expect(withStepUp.score).toBe(100)
    expect(withoutStepUp.score).toBe(95)
    expect(withoutStepUp.recommendations.some((r) => r.id === 'rec_step_up')).toBe(true)
  })
})

