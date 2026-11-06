/**
 * API Key and Service-Account Hardening.
 * Implements PLAT-4 (Audit S-11, S-14).
 *
 * Provides HMAC-SHA256 key hashing with pepper, v1 SHA-256 upgrade path,
 * IPv4/IPv6 CIDR allow-listing, rotation with grace period, and unseen IP auditing.
 */
import * as crypto from 'node:crypto'
import { normalizeIpv4 } from '@/server/net/ip'

export interface ApiKeyRecord {
  id: string
  serviceAccountId: string
  keyPrefix: string
  keyHmac: string
  hashVersion: number // 1 = legacy SHA256, 2 = HMAC-SHA256 with pepper
  allowedCidrs?: string[]
  expiresAt: number | null
  createdAt: number
  lastUsedAt?: number
  lastUsedIp?: string
  rotatedFrom?: string
  graceUntil?: number | null
  seenSubnets?: Set<string>
}

export const API_KEY_PEPPER = process.env.API_KEY_PEPPER || 'proofpay_default_api_key_pepper_2026'

/**
 * Computes legacy v1 SHA-256 hash (without pepper).
 */
export function hashKeyV1(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex')
}

/**
 * Computes v2 HMAC-SHA256 hash using API_KEY_PEPPER.
 */
export function hashKeyV2(secret: string, pepper: string = API_KEY_PEPPER): string {
  return crypto.createHmac('sha256', pepper).update(secret).digest('hex')
}

/**
 * Verifies key secret against stored record.
 * Falls back to v1 hash if stored as v1, and returns shouldUpgrade: true.
 */
export function verifyApiKeySecret(
  secret: string,
  record: ApiKeyRecord,
  pepper: string = API_KEY_PEPPER
): { valid: boolean; shouldUpgrade: boolean } {
  if (record.hashVersion === 2) {
    const expected = hashKeyV2(secret, pepper)
    const valid = crypto.timingSafeEqual(Buffer.from(record.keyHmac), Buffer.from(expected))
    return { valid, shouldUpgrade: false }
  }

  // Fallback to legacy v1 SHA-256
  const legacyHash = hashKeyV1(secret)
  if (legacyHash === record.keyHmac) {
    return { valid: true, shouldUpgrade: true }
  }

  return { valid: false, shouldUpgrade: false }
}

/**
 * Checks if an IPv4 or IPv6 IP is contained within a CIDR range.
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  if (cidr === '*' || cidr === '0.0.0.0/0' || cidr === '::/0') return true

  const [rangeIp = '', bitsStr = '32'] = cidr.split('/')
  const prefixLength = Number(bitsStr)

  // IPv4 CIDR matching
  const normIp = normalizeIpv4(ip)
  const normRange = rangeIp ? normalizeIpv4(rangeIp) : null

  if (normIp && normRange) {
    const ipInt = normIp
      .split('.')
      .map(Number)
      .reduce((acc, octet) => ((acc << 8) | octet) >>> 0, 0)
    const rangeInt = normRange
      .split('.')
      .map(Number)
      .reduce((acc, octet) => ((acc << 8) | octet) >>> 0, 0)
    const mask = prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0
    return ((ipInt & mask) >>> 0) === ((rangeInt & mask) >>> 0)
  }

  // IPv6 CIDR matching
  if (ip.includes(':') && rangeIp.includes(':')) {
    // Basic prefix matching for IPv6
    return ip.toLowerCase().startsWith(rangeIp.replace(/::.*$/, '').toLowerCase())
  }

  return false
}

/**
 * Validates request IP against key's allowed CIDRs.
 */
export function validateIpAllowlist(clientIp: string, allowedCidrs?: string[]): boolean {
  if (!allowedCidrs || allowedCidrs.length === 0) return true
  return allowedCidrs.some((cidr) => isIpInCidr(clientIp, cidr))
}

/**
 * Extracts subnet prefix (/24 for IPv4, /48 for IPv6) for new-IP detection.
 */
export function extractSubnetPrefix(ip: string): string {
  const norm = normalizeIpv4(ip)
  if (norm) {
    const parts = norm.split('.')
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
  }
  if (ip.includes(':')) {
    const parts = ip.split(':')
    return `${parts.slice(0, 3).join(':')}::/48`
  }
  return ip
}

/**
 * In-memory API key store for testing and service accounts.
 */
export class ApiKeyManager {
  private keys = new Map<string, ApiKeyRecord>()

  addKey(record: ApiKeyRecord): void {
    if (!record.seenSubnets) record.seenSubnets = new Set()
    this.keys.set(record.id, record)
  }

  getKey(id: string): ApiKeyRecord | undefined {
    return this.keys.get(id)
  }

  authenticate(
    secret: string,
    keyId: string,
    clientIp: string,
    now: number = Date.now()
  ): { ok: boolean; error?: string; isNewSubnet?: boolean } {
    const record = this.keys.get(keyId)
    if (!record) return { ok: false, error: 'INVALID_API_KEY' }

    // 1. Expiration check
    if (record.expiresAt && now > record.expiresAt) {
      return { ok: false, error: 'EXPIRED_API_KEY' }
    }

    // 2. Rotation grace period check
    if (record.graceUntil && now > record.graceUntil) {
      return { ok: false, error: 'ROTATION_GRACE_EXPIRED' }
    }

    // 3. Cryptographic hash verification (v2 with v1 upgrade)
    const { valid, shouldUpgrade } = verifyApiKeySecret(secret, record)
    if (!valid) return { ok: false, error: 'INVALID_SECRET' }

    if (shouldUpgrade) {
      record.keyHmac = hashKeyV2(secret)
      record.hashVersion = 2
    }

    // 4. IP CIDR check
    if (!validateIpAllowlist(clientIp, record.allowedCidrs)) {
      return { ok: false, error: 'IP_NOT_ALLOWED' }
    }

    // 5. New IP / Subnet tracking
    const subnet = extractSubnetPrefix(clientIp)
    let isNewSubnet = false
    if (!record.seenSubnets) record.seenSubnets = new Set()
    if (!record.seenSubnets.has(subnet)) {
      record.seenSubnets.add(subnet)
      isNewSubnet = true
    }

    record.lastUsedAt = now
    record.lastUsedIp = clientIp

    return { ok: true, isNewSubnet }
  }

  rotateKey(
    serviceAccountId: string,
    keyId: string,
    graceHours: number = 24,
    now: number = Date.now()
  ): { newSecret: string; newRecord: ApiKeyRecord } {
    const existing = this.keys.get(keyId)
    if (!existing) throw new Error('Key not found')

    // Count active keys for this service account
    const active = Array.from(this.keys.values()).filter(
      (k) => k.serviceAccountId === serviceAccountId && (!k.graceUntil || now < k.graceUntil)
    )

    if (active.length >= 2) {
      throw new Error('Maximum of 2 active keys permitted during rotation grace period')
    }

    const cappedGrace = Math.min(Math.max(graceHours, 1), 72)
    existing.graceUntil = now + cappedGrace * 3600 * 1000

    const newSecret = `pp_sec_${crypto.randomBytes(24).toString('hex')}`
    const newId = `key_${crypto.randomBytes(8).toString('hex')}`
    const newRecord: ApiKeyRecord = {
      id: newId,
      serviceAccountId,
      keyPrefix: newSecret.slice(0, 10),
      keyHmac: hashKeyV2(newSecret),
      hashVersion: 2,
      allowedCidrs: existing.allowedCidrs,
      expiresAt: now + 90 * 24 * 3600 * 1000, // 90 days default
      createdAt: now,
      rotatedFrom: keyId,
      seenSubnets: new Set(),
    }

    this.keys.set(newId, newRecord)
    return { newSecret, newRecord }
  }
}
