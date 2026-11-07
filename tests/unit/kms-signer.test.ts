/**
 * Unit Tests: Cloud KMS / HSM Key Custody Engine
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  LocalMemoryKeyProvider,
  CloudKmsKeyProvider,
  kmsSign,
  kmsVerify,
  setKeyProvider,
  getKeyProvider,
} from '@/lib/crypto/kms-signer'

describe('Cloud KMS & HSM Key Custody Engine', () => {
  const dummyPayload = Buffer.from('ProofPay milestone settlement attestation certificate')

  beforeEach(() => {
    // Reset to default local provider
    setKeyProvider(new LocalMemoryKeyProvider())
  })

  describe('LocalMemoryKeyProvider', () => {
    it('signs payload and generates verifiable Ed25519 signature', async () => {
      const provider = new LocalMemoryKeyProvider('test-key', 'v1')
      const result = await provider.sign(dummyPayload)

      expect(result.provider).toBe('local')
      expect(result.keyId).toBe('test-key')
      expect(result.keyVersion).toBe('v1')
      expect(result.signatureBase64).toBeTruthy()
      expect(result.publicKeyPem).toContain('BEGIN PUBLIC KEY')

      const isValid = kmsVerify(dummyPayload, result.signatureBase64, result.publicKeyPem)
      expect(isValid).toBe(true)
    })

    it('rejects tampered payload', async () => {
      const provider = new LocalMemoryKeyProvider()
      const result = await provider.sign(dummyPayload)

      const tampered = Buffer.from('Tampered payload data')
      const isValid = kmsVerify(tampered, result.signatureBase64, result.publicKeyPem)
      expect(isValid).toBe(false)
    })

    it('supports seamless key rotation and increments key version', async () => {
      const provider = new LocalMemoryKeyProvider('rot-key', 'v1')
      const initialKey = await provider.getPublicKey()

      const newVersion = provider.rotateKey()
      expect(newVersion).toBe('v2')

      const rotatedKey = await provider.getPublicKey()
      expect(rotatedKey).not.toBe(initialKey)

      const result = await provider.sign(dummyPayload)
      expect(result.keyVersion).toBe('v2')
      expect(kmsVerify(dummyPayload, result.signatureBase64, rotatedKey)).toBe(true)
    })
  })

  describe('CloudKmsKeyProvider', () => {
    it('initializes with cloud key ARN and delegates safely', async () => {
      const kmsProvider = new CloudKmsKeyProvider(
        'arn:aws:kms:us-east-1:123456789012:key/test-key-id',
        'aws-kms'
      )
      expect(kmsProvider.name).toBe('aws-kms')

      const res = await kmsProvider.sign(dummyPayload)
      expect(res.provider).toBe('aws-kms')
      expect(res.keyId).toBe('arn:aws:kms:us-east-1:123456789012:key/test-key-id')

      const isValid = kmsVerify(dummyPayload, res.signatureBase64, res.publicKeyPem)
      expect(isValid).toBe(true)
    })
  })

  describe('kmsSign & Provider Delegation', () => {
    it('uses active provider set via setKeyProvider', async () => {
      const customProvider = new LocalMemoryKeyProvider('custom-auth-key', 'v5')
      setKeyProvider(customProvider)
      expect(getKeyProvider()).toBe(customProvider)

      const result = await kmsSign(dummyPayload)
      expect(result.keyId).toBe('custom-auth-key')
      expect(result.keyVersion).toBe('v5')
      expect(kmsVerify(dummyPayload, result.signatureBase64, result.publicKeyPem)).toBe(true)
    })
  })
})

