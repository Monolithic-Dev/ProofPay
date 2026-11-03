import { describe, it, expect } from 'vitest'
import { encryptSecret, decryptSecret } from '@/demo/agents/credentials'

describe('Demo Agent Credentials (§7.1)', () => {
  const masterKey = 'test_secret_key_must_be_at_least_32_characters_long_for_test'
  const rawApiKey = 'pp_k_live_test_secret_key_1234567890'

  it('encrypts secret and ensures stored KV value is not plaintext', () => {
    const encrypted = encryptSecret(rawApiKey, masterKey)
    expect(encrypted.iv).toBeDefined()
    expect(encrypted.tag).toBeDefined()
    expect(encrypted.data).toBeDefined()

    // Plaintext should not be in any field
    expect(encrypted.data).not.toContain(rawApiKey)
    expect(encrypted.iv).not.toContain(rawApiKey)
    expect(encrypted.tag).not.toContain(rawApiKey)
  })

  it('decrypts encrypted payload back to original API key', () => {
    const encrypted = encryptSecret(rawApiKey, masterKey)
    const decrypted = decryptSecret(encrypted, masterKey)
    expect(decrypted).toBe(rawApiKey)
  })

  it('fails decryption if wrong master key is used', () => {
    const encrypted = encryptSecret(rawApiKey, masterKey)
    const wrongKey = 'different_secret_key_that_is_also_32_chars_long!!'
    expect(() => decryptSecret(encrypted, wrongKey)).toThrow()
  })
})
