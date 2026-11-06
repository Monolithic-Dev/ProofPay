/**
 * Unit Tests: RFC 3161 Trusted Timestamping Engine
 */
import { describe, it, expect } from 'vitest'
import {
  buildTimeStampRequest,
  createMockTimestampToken,
  requestTimestampToken,
  verifyTimestampToken,
} from '@/lib/crypto/rfc3161'
import { createHash } from 'crypto'

describe('RFC 3161 Timestamping', () => {
  const dummyData = 'ProofPay milestone settlement attestation payload'
  const validSha256 = createHash('sha256').update(dummyData).digest('hex')

  describe('buildTimeStampRequest', () => {
    it('creates a valid ASN.1 DER buffer for a SHA-256 hash', () => {
      const der = buildTimeStampRequest(validSha256)
      expect(der).toBeInstanceOf(Buffer)
      expect(der[0]).toBe(0x30) // ASN.1 SEQUENCE
      expect(der.length).toBeGreaterThan(32)
    })

    it('rejects an invalid hash length', () => {
      expect(() => buildTimeStampRequest('deadbeef')).toThrow(
        'RFC 3161 timestamping requires a 32-byte SHA-256 hash'
      )
    })

    it('includes nonce when provided', () => {
      const der1 = buildTimeStampRequest(validSha256)
      const der2 = buildTimeStampRequest(validSha256, BigInt(123456789))
      expect(der2.length).toBeGreaterThan(der1.length)
    })
  })

  describe('createMockTimestampToken & requestTimestampToken', () => {
    it('creates an offline verifiable timestamp token', () => {
      const token = createMockTimestampToken(validSha256, 'https://freetsa.org/tsr')
      expect(token.hash).toBe(validSha256)
      expect(token.verified).toBe(true)
      expect(token.token_der_b64).toBeTruthy()
      expect(new Date(token.timestamp_iso).getTime()).not.toBeNaN()
    })

    it('requestTimestampToken falls back gracefully to mock token in test mode', async () => {
      const token = await requestTimestampToken({ hash: validSha256 })
      expect(token.hash).toBe(validSha256)
      expect(token.verified).toBe(true)
    })
  })

  describe('verifyTimestampToken', () => {
    it('verifies a valid token against the matching hash', () => {
      const token = createMockTimestampToken(validSha256)
      expect(verifyTimestampToken(token, validSha256)).toBe(true)
    })

    it('rejects verification if hash does not match', () => {
      const token = createMockTimestampToken(validSha256)
      const otherHash = createHash('sha256').update('different').digest('hex')
      expect(verifyTimestampToken(token, otherHash)).toBe(false)
    })

    it('rejects corrupted base64 or empty tokens', () => {
      expect(verifyTimestampToken(null as any, validSha256)).toBe(false)
      expect(verifyTimestampToken({ hash: validSha256, token_der_b64: 'abc' } as any, validSha256)).toBe(false)
    })
  })
})
