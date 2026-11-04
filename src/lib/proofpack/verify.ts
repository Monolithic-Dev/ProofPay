/**
 * Client-Side Offline Proof Pack Verifier.
 * Implements pure SHA-256 hash-chain validation without requiring server trust.
 * Implements docs/v2/PROOFPAY-WINNING-PLAN.md B2.
 */

export const ZERO_HASH = '0'.repeat(64)

/** Deterministic canonical JSON serializer (browser + Node compatible) */
export function canonicalize(value: unknown): string {
  if (value === undefined) throw new TypeError('Cannot canonicalize undefined')
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    throw new TypeError(`Cannot canonicalize type: ${typeof value}`)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`Cannot canonicalize non-finite number: ${value}`)
    return JSON.stringify(value)
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']'
  }

  const obj = value as Record<string, unknown>
  const sortedKeys = Object.keys(obj).sort()
  const pairs: string[] = []

  for (const k of sortedKeys) {
    const val = obj[k]
    if (val !== undefined) {
      pairs.push(JSON.stringify(k) + ':' + canonicalize(val))
    }
  }

  return '{' + pairs.join(',') + '}'
}

/** Computes SHA-256 hex digest using Web Crypto API */
export async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(text)

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuf = await crypto.subtle.digest('SHA-256', data)
    const hashArr = Array.from(new Uint8Array(hashBuf))
    return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  // Fallback for Node environments during tests
  const { createHash } = await import('crypto')
  return createHash('sha256').update(text).digest('hex')
}

export interface ProofPackEvent {
  seq: number
  type: string
  actor_type?: string
  payload: Record<string, unknown>
  prev_hash: string
  hash: string
  created_at: string
}

export interface VerificationResult {
  valid: boolean
  eventsChecked: number
  contractHashValid?: boolean
  error?: string
  brokenAtSeq?: number
  expectedHash?: string
  actualHash?: string
}

export async function verifyProofPack(pack: any): Promise<VerificationResult> {
  if (!pack || !pack.ledger || !Array.isArray(pack.ledger)) {
    return { valid: false, eventsChecked: 0, error: 'Invalid Proof Pack: missing ledger array' }
  }

  // 1. Verify contract hash if present
  let contractHashValid = true
  if (pack.contract?.canonical && pack.contract?.hash) {
    const canonicalStr = canonicalize(pack.contract.canonical)
    const computedContractHash = await sha256Hex(canonicalStr)
    if (computedContractHash !== pack.contract.hash) {
      contractHashValid = false
      return {
        valid: false,
        eventsChecked: 0,
        contractHashValid: false,
        error: `Contract canonical JSON hash mismatch: expected ${pack.contract.hash}, got ${computedContractHash}`,
      }
    }
  }

  // 2. Verify ledger hash chain
  let prevHash = ZERO_HASH

  for (let i = 0; i < pack.ledger.length; i++) {
    const event = pack.ledger[i] as ProofPackEvent

    // Check prev_hash link
    if (event.prev_hash !== prevHash) {
      return {
        valid: false,
        eventsChecked: i,
        contractHashValid,
        brokenAtSeq: event.seq,
        error: `Hash chain link broken at sequence #${event.seq}: prev_hash does not match preceding event hash`,
        expectedHash: prevHash,
        actualHash: event.prev_hash,
      }
    }

    // Recompute this event's hash
    const raw = [
      event.prev_hash,
      pack.contract?.id || '',
      String(event.seq),
      event.type,
      canonicalize(event.payload || {}),
      new Date(event.created_at).toISOString(),
    ].join('|')

    const computed = await sha256Hex(raw)

    if (computed !== event.hash) {
      return {
        valid: false,
        eventsChecked: i,
        contractHashValid,
        brokenAtSeq: event.seq,
        error: `Tampering detected at event #${event.seq} (${event.type}): payload or metadata hash mismatch`,
        expectedHash: computed,
        actualHash: event.hash,
      }
    }

    prevHash = event.hash
  }

  return {
    valid: true,
    eventsChecked: pack.ledger.length,
    contractHashValid,
  }
}
