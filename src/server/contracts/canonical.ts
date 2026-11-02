/**
 * Canonical JSON serialization and SHA-256 hashing.
 * Implements deterministic serialization per data-model.md §3.8 & §4.
 */
import { createHash } from 'crypto'

export const ZERO_HASH = '0'.repeat(64)

/**
 * Deterministically serialize a value to canonical JSON:
 * - Recursively sorts object keys lexicographically
 * - No whitespace
 * - Numbers serialized consistently
 * - Rejects undefined, NaN, Infinity, functions, and bigint
 */
export function canonicalize(value: unknown): string {
  if (value === undefined) {
    throw new TypeError('Cannot canonicalize undefined')
  }
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    throw new TypeError(`Cannot canonicalize type: ${typeof value}`)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot canonicalize non-finite number: ${value}`)
    }
    return JSON.stringify(value)
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']'
  }

  // Object handling
  const obj = value as Record<string, unknown>
  const sortedKeys = Object.keys(obj).sort()
  const pairs: string[] = []

  for (const k of sortedKeys) {
    const val = obj[k]
    if (val === undefined) {
      throw new TypeError(`Cannot canonicalize object with undefined value at key "${k}"`)
    }
    pairs.push(JSON.stringify(k) + ':' + canonicalize(val))
  }

  return '{' + pairs.join(',') + '}'
}

/** Backwards-compatible alias for canonicalize */
export const canonicalJson = canonicalize

/** SHA-256 hex digest of a string */
export function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

/**
 * Compute the canonical contract hash.
 * contractHash = sha256_hex(canonicalize(contractJson))
 */
export function contractHash(contractJson: unknown): string {
  return sha256Hex(canonicalize(contractJson))
}

/** Backwards-compatible alias for contractHash */
export const hashContract = contractHash

/**
 * Compute the hash of a ledger event.
 * hash = sha256_hex( prev_hash + "|" + contract_id + "|" + seq + "|" + type + "|" + canonicalize(payload) + "|" + created_at_iso )
 */
export function hashLedgerEvent(params: {
  prevHash: string
  contractId: string
  seq: number
  type: string
  payload: unknown
  createdAt: string // YYYY-MM-DDTHH:mm:ss.SSSZ
}): string {
  const { prevHash, contractId, seq, type, payload, createdAt } = params
  const raw = [
    prevHash,
    contractId,
    String(seq),
    type,
    canonicalize(payload),
    createdAt,
  ].join('|')
  return sha256Hex(raw)
}
