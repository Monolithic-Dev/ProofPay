import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkStepUpPermission,
  recordStepUpAttempt,
  clearStepUpStore,
  STEP_UP_ACTIONS,
  GRANT_TTL_MS,
} from '@/server/auth/step-up'

describe('PLAT-3 Step-Up Authentication (src/server/auth/step-up.ts)', () => {
  beforeEach(() => {
    clearStepUpStore()
  })

  it('blocks all protected actions without a fresh grant when enforce is true', () => {
    const userId = 'user_abc'
    const sessionId = 'sess_123'

    for (const action of STEP_UP_ACTIONS) {
      const res = checkStepUpPermission(userId, sessionId, action, Date.now(), true)
      expect(res.allowed).toBe(false)
      expect(res.error).toBe('STEP_UP_REQUIRED')
      expect(res.details?.action).toBe(action)
      expect(res.details?.max_age_sec).toBe(600)
    }
  })

  it('allows actions in shadow mode when enforce is false', () => {
    const userId = 'user_abc'
    const sessionId = 'sess_123'

    const res = checkStepUpPermission(userId, sessionId, 'funding.start', Date.now(), false)
    expect(res.allowed).toBe(true)
  })

  it('permits protected action after a valid step-up grant is issued', () => {
    const userId = 'user_abc'
    const sessionId = 'sess_123'
    const now = Date.now()

    const attempt = recordStepUpAttempt(userId, sessionId, 'password', true, now)
    expect(attempt.success).toBe(true)
    expect(attempt.grant).toBeDefined()

    const check = checkStepUpPermission(userId, sessionId, 'funding.start', now, true)
    expect(check.allowed).toBe(true)
  })

  it('grant expires after 600s', () => {
    const userId = 'user_abc'
    const sessionId = 'sess_123'
    const now = Date.now()

    recordStepUpAttempt(userId, sessionId, 'password', true, now)

    // Right before expiry
    expect(
      checkStepUpPermission(userId, sessionId, 'funding.start', now + GRANT_TTL_MS - 1000, true).allowed
    ).toBe(true)

    // After 600s expiry
    expect(
      checkStepUpPermission(userId, sessionId, 'funding.start', now + GRANT_TTL_MS + 1000, true).allowed
    ).toBe(false)
  })

  it('grant is strictly bound to session_id', () => {
    const userId = 'user_abc'
    const sessionA = 'sess_a'
    const sessionB = 'sess_b'
    const now = Date.now()

    recordStepUpAttempt(userId, sessionA, 'totp', true, now)

    // Session A is allowed
    expect(checkStepUpPermission(userId, sessionA, 'apikey.create', now, true).allowed).toBe(true)

    // Session B is blocked
    expect(checkStepUpPermission(userId, sessionB, 'apikey.create', now, true).allowed).toBe(false)
  })

  it('enforces rate limiting after 5 consecutive failed attempts', () => {
    const userId = 'user_attacker'
    const sessionId = 'sess_attack'
    const now = Date.now()

    for (let i = 1; i <= 5; i++) {
      const attempt = recordStepUpAttempt(userId, sessionId, 'password', false, now)
      expect(attempt.success).toBe(false)
      expect(attempt.rateLimited).toBeFalsy()
    }

    // 6th attempt is rate-limited
    const sixth = recordStepUpAttempt(userId, sessionId, 'password', false, now)
    expect(sixth.rateLimited).toBe(true)
  })
})

