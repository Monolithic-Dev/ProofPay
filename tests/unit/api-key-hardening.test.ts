import { describe, it, expect, beforeEach } from 'vitest'
import {
  ApiKeyManager,
  hashKeyV1,
  hashKeyV2,
  isIpInCidr,
  extractSubnetPrefix,
} from '@/server/auth/api-key-hardening'

describe('PLAT-4 API Key Hardening & Rotation (src/server/auth/api-key-hardening.ts)', () => {
  let manager: ApiKeyManager

  beforeEach(() => {
    manager = new ApiKeyManager()
  })

  it('authenticates with HMAC-SHA256 v2 keys', () => {
    const secret = 'pp_sec_test_secret_12345'
    manager.addKey({
      id: 'key_1',
      serviceAccountId: 'sa_1',
      keyPrefix: 'pp_sec_tes',
      keyHmac: hashKeyV2(secret),
      hashVersion: 2,
      expiresAt: null,
      createdAt: Date.now(),
    })

    const res = manager.authenticate(secret, 'key_1', '192.168.1.10')
    expect(res.ok).toBe(true)

    const invalid = manager.authenticate('wrong_secret', 'key_1', '192.168.1.10')
    expect(invalid.ok).toBe(false)
    expect(invalid.error).toBe('INVALID_SECRET')
  })

  it('authenticates with legacy v1 SHA-256 and transparently upgrades to v2', () => {
    const secret = 'pp_sec_legacy_v1'
    manager.addKey({
      id: 'key_v1',
      serviceAccountId: 'sa_1',
      keyPrefix: 'pp_sec_leg',
      keyHmac: hashKeyV1(secret),
      hashVersion: 1, // legacy v1
      expiresAt: null,
      createdAt: Date.now(),
    })

    const res = manager.authenticate(secret, 'key_v1', '10.0.0.5')
    expect(res.ok).toBe(true)

    // Key should now be upgraded to version 2
    const key = manager.getKey('key_v1')
    expect(key?.hashVersion).toBe(2)
    expect(key?.keyHmac).toBe(hashKeyV2(secret))
  })

  it('enforces IPv4 and IPv6 CIDR allowlists', () => {
    expect(isIpInCidr('192.168.1.50', '192.168.1.0/24')).toBe(true)
    expect(isIpInCidr('192.168.2.50', '192.168.1.0/24')).toBe(false)
    expect(isIpInCidr('10.50.1.1', '10.0.0.0/8')).toBe(true)
    expect(isIpInCidr('172.16.0.1', '10.0.0.0/8')).toBe(false)
  })

  it('rejects keys used from unauthorized IP addresses', () => {
    const secret = 'pp_sec_ip_restricted'
    manager.addKey({
      id: 'key_ip',
      serviceAccountId: 'sa_1',
      keyPrefix: 'pp_sec_ip_',
      keyHmac: hashKeyV2(secret),
      hashVersion: 2,
      allowedCidrs: ['192.168.1.0/24'],
      expiresAt: null,
      createdAt: Date.now(),
    })

    const allowed = manager.authenticate(secret, 'key_ip', '192.168.1.42')
    expect(allowed.ok).toBe(true)

    const denied = manager.authenticate(secret, 'key_ip', '203.0.113.5')
    expect(denied.ok).toBe(false)
    expect(denied.error).toBe('IP_NOT_ALLOWED')
  })

  it('rejects expired keys', () => {
    const secret = 'pp_sec_expired'
    const now = Date.now()
    manager.addKey({
      id: 'key_exp',
      serviceAccountId: 'sa_1',
      keyPrefix: 'pp_sec_exp',
      keyHmac: hashKeyV2(secret),
      hashVersion: 2,
      expiresAt: now - 1000, // expired 1s ago
      createdAt: now - 100_000,
    })

    const res = manager.authenticate(secret, 'key_exp', '1.2.3.4', now)
    expect(res.ok).toBe(false)
    expect(res.error).toBe('EXPIRED_API_KEY')
  })

  it('supports key rotation with grace period and active key limits', () => {
    const secret1 = 'pp_sec_key_1'
    const now = Date.now()

    manager.addKey({
      id: 'key_orig',
      serviceAccountId: 'sa_corp',
      keyPrefix: 'pp_sec_key',
      keyHmac: hashKeyV2(secret1),
      hashVersion: 2,
      expiresAt: null,
      createdAt: now,
    })

    // Rotate: generates key 2, sets 24h grace on key 1
    const { newSecret, newRecord } = manager.rotateKey('sa_corp', 'key_orig', 24, now)
    expect(newSecret).toBeDefined()
    expect(newRecord.rotatedFrom).toBe('key_orig')

    // Key 1 still works during grace period
    const oldKeyDuringGrace = manager.authenticate(secret1, 'key_orig', '1.1.1.1', now + 3600_000)
    expect(oldKeyDuringGrace.ok).toBe(true)

    // Key 2 works immediately
    const newKeyAuth = manager.authenticate(newSecret, newRecord.id, '1.1.1.1', now + 3600_000)
    expect(newKeyAuth.ok).toBe(true)

    // Old key fails after grace period (25 hours later)
    const oldKeyAfterGrace = manager.authenticate(
      secret1,
      'key_orig',
      '1.1.1.1',
      now + 25 * 3600_000
    )
    expect(oldKeyAfterGrace.ok).toBe(false)
    expect(oldKeyAfterGrace.error).toBe('ROTATION_GRACE_EXPIRED')

    // Rotating again while both are active throws max keys exceeded
    expect(() => manager.rotateKey('sa_corp', newRecord.id, 24, now + 1000)).toThrow(
      /Maximum of 2 active keys/
    )
  })

  it('detects and flags new subnet usage', () => {
    const secret = 'pp_sec_new_ip_test'
    manager.addKey({
      id: 'key_audit',
      serviceAccountId: 'sa_audit',
      keyPrefix: 'pp_sec_new',
      keyHmac: hashKeyV2(secret),
      hashVersion: 2,
      expiresAt: null,
      createdAt: Date.now(),
    })

    // First use from 203.0.113.10 is new subnet
    const res1 = manager.authenticate(secret, 'key_audit', '203.0.113.10')
    expect(res1.ok).toBe(true)
    expect(res1.isNewSubnet).toBe(true)

    // Second use from same /24 subnet 203.0.113.25 is NOT new
    const res2 = manager.authenticate(secret, 'key_audit', '203.0.113.25')
    expect(res2.ok).toBe(true)
    expect(res2.isNewSubnet).toBe(false)

    // Use from different subnet 198.51.100.5 IS new
    const res3 = manager.authenticate(secret, 'key_audit', '198.51.100.5')
    expect(res3.ok).toBe(true)
    expect(res3.isNewSubnet).toBe(true)
  })
})
