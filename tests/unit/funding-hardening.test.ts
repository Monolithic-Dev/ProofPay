import { describe, it, expect, beforeEach } from 'vitest'
import {
  createFundingState,
  validateAndConsumeFundingState,
  clearFundingStates,
  makeFundingRequestId,
  FUNDING_STATE_TTL_MS,
} from '@/server/funding/funding-state'
import { envSchema } from '@/server/config/env'

describe('PLAT-10 Funding Flow Hardening (src/server/funding/funding-state.ts)', () => {
  beforeEach(() => {
    clearFundingStates()
  })

  it('generates attempt-scoped idempotency keys', () => {
    expect(makeFundingRequestId('ct_100', 1)).toBe('pp:ct_100:fund:1')
    expect(makeFundingRequestId('ct_100', 2)).toBe('pp:ct_100:fund:2')
    expect(makeFundingRequestId('ct_100', 0)).toBe('pp:ct_100:fund:1')
  })

  it('successfully creates and validates session-bound state', () => {
    const now = Date.now()
    const { nonce } = createFundingState({
      contractId: 'ct_123',
      userId: 'user_1',
      sessionId: 'sess_abc',
      orderId: 'ORD_999',
      now,
    })

    const res = validateAndConsumeFundingState({
      nonce,
      userId: 'user_1',
      sessionId: 'sess_abc',
      orderId: 'ORD_999',
      now,
    })

    expect(res.valid).toBe(true)
  })

  it('rejects foreign session or user attempting to consume state', () => {
    const { nonce } = createFundingState({
      contractId: 'ct_123',
      userId: 'user_1',
      sessionId: 'sess_abc',
      orderId: 'ORD_999',
    })

    // Wrong session
    const wrongSess = validateAndConsumeFundingState({
      nonce,
      userId: 'user_1',
      sessionId: 'sess_attacker',
      orderId: 'ORD_999',
    })
    expect(wrongSess.valid).toBe(false)
    if (!wrongSess.valid) {
      expect(wrongSess.reason).toBe('SESSION_MISMATCH')
    }

    // Wrong user
    const wrongUser = validateAndConsumeFundingState({
      nonce,
      userId: 'user_attacker',
      sessionId: 'sess_abc',
      orderId: 'ORD_999',
    })
    expect(wrongUser.valid).toBe(false)
    if (!wrongUser.valid) {
      expect(wrongUser.reason).toBe('USER_MISMATCH')
    }
  })

  it('rejects reused / replay state tokens', () => {
    const { nonce } = createFundingState({
      contractId: 'ct_123',
      userId: 'user_1',
      sessionId: 'sess_abc',
      orderId: 'ORD_999',
    })

    // First use succeeds
    const first = validateAndConsumeFundingState({
      nonce,
      userId: 'user_1',
      sessionId: 'sess_abc',
      orderId: 'ORD_999',
    })
    expect(first.valid).toBe(true)

    // Second use is rejected as already used
    const second = validateAndConsumeFundingState({
      nonce,
      userId: 'user_1',
      sessionId: 'sess_abc',
      orderId: 'ORD_999',
    })
    expect(second.valid).toBe(false)
    if (!second.valid) {
      expect(second.reason).toBe('ALREADY_USED')
    }
  })

  it('rejects expired state nonces (after 30 min)', () => {
    const now = Date.now()
    const { nonce } = createFundingState({
      contractId: 'ct_123',
      userId: 'user_1',
      sessionId: 'sess_abc',
      orderId: 'ORD_999',
      now,
    })

    const expired = validateAndConsumeFundingState({
      nonce,
      userId: 'user_1',
      sessionId: 'sess_abc',
      orderId: 'ORD_999',
      now: now + FUNDING_STATE_TTL_MS + 5000,
    })
    expect(expired.valid).toBe(false)
    if (!expired.valid) {
      expect(expired.reason).toBe('EXPIRED')
    }
  })

  it('enforces demo time-scale guard in envSchema', () => {
    const baseEnv = {
      NODE_ENV: 'production',
      APP_BASE_URL: 'http://localhost:3000',
      DATABASE_URL: 'postgres://localhost/db',
      PAYPAL_ENV: 'sandbox',
      PAYPAL_CLIENT_ID: 'client_id',
      PAYPAL_CLIENT_SECRET: 'client_secret',
      ANTHROPIC_API_KEY: 'test_key',
      SESSION_SECRET: 'a_very_long_secret_key_exceeding_32_characters',
      DEMO_MODE: 'false',
      DEMO_TIME_SCALE: 2880,
    }

    const res = envSchema.safeParse(baseEnv)
    expect(res.success).toBe(false)
  })
})

