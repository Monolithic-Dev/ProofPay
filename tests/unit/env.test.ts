import { describe, it, expect } from 'vitest'
import { envSchema } from '@/server/config/env'

const validBaseEnv = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/proofpay',
  PAYPAL_ENV: 'sandbox' as const,
  PAYPAL_CLIENT_ID: 'test_client_id',
  PAYPAL_CLIENT_SECRET: 'test_client_secret',
  ANTHROPIC_API_KEY: 'test_anthropic_key',
  SESSION_SECRET: 'a_very_secure_and_long_session_secret_at_least_32_chars',
  DEMO_MODE: 'true' as const,
}

describe('Environment validation (envSchema)', () => {
  it('rejects PAYPAL_ENV=live', () => {
    const parsed = envSchema.safeParse({
      ...validBaseEnv,
      PAYPAL_ENV: 'live',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects short SESSION_SECRET', () => {
    const parsed = envSchema.safeParse({
      ...validBaseEnv,
      SESSION_SECRET: 'too_short',
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('SESSION_SECRET'))).toBe(true)
    }
  })

  it('applies defaults correctly', () => {
    const parsed = envSchema.safeParse(validBaseEnv)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.NODE_ENV).toBe('development')
      expect(parsed.data.APP_BASE_URL).toBe('http://localhost:3000')
      expect(parsed.data.LLM_DAILY_BUDGET_USD).toBe(5)
      expect(parsed.data.MAX_CONTRACT_DAYS).toBe(28)
      expect(parsed.data.RUN_ROLE).toBe('web')
      expect(parsed.data.LOG_LEVEL).toBe('info')
    }
  })

  it('caps MAX_CONTRACT_DAYS at 28', () => {
    const parsed = envSchema.safeParse({
      ...validBaseEnv,
      MAX_CONTRACT_DAYS: 29,
    })
    expect(parsed.success).toBe(false)
  })

  it('does not echo secret values in error output', () => {
    const secretValue = 'super_secret_payload_never_leak_me'
    const parsed = envSchema.safeParse({
      ...validBaseEnv,
      SESSION_SECRET: 'short',
      PAYPAL_CLIENT_SECRET: secretValue,
      PAYPAL_ENV: 'live',
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const errorStr = JSON.stringify(parsed.error.issues)
      expect(errorStr).not.toContain(secretValue)
    }
  })
})
