/**
 * Canonical JSON serialization and SHA-256 hashing.
 * Implements the hash definition from data-model.md §3.8.
 */
import { createHash } from 'crypto'

/**
 * Recursively sort object keys and stringify with no whitespace.
 * Arrays preserve their order; only object key order is normalized.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']'
  }

  const obj = value as Record<string, unknown>
  const sortedKeys = Object.keys(obj).sort()
  const pairs = sortedKeys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k]))
  return '{' + pairs.join(',') + '}'
}

/** SHA-256 hex digest of the canonical JSON */
export function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

/**
 * Hash a contract JSON for the contract_hash field.
 * Stored at ACCEPTED state and used to detect tampering.
 */
export function hashContract(contractJson: unknown): string {
  return sha256Hex(canonicalJson(contractJson))
}

/**
 * Hash a ledger event.
 * hash = sha256_hex( prev_hash + "|" + contract_id + "|" + seq + "|" + type + "|" + canonical_json(payload) + "|" + created_at_iso )
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
    canonicalJson(payload),
    createdAt,
  ].join('|')
  return sha256Hex(raw)
}

/** Zero hash for the first ledger event */
export const ZERO_HASH = '0'.repeat(64)
