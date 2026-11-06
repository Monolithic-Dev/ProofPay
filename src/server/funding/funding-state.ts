/**
 * Funding flow state binding and attempt-scoped idempotency.
 * Implements PLAT-10 (Audit M-7, M-8, M-11).
 *
 * Prevents unauthorized or session-hijacked funding confirmations,
 * stale order re-authorizations, and replay attacks on return URLs.
 */
import * as crypto from 'node:crypto'

export interface FundingStateRecord {
  id: string
  contractId: string
  userId: string
  sessionIdHash: string
  orderId: string
  nonceHash: string
  expiresAt: number
  usedAt: number | null
  createdAt: number
}

// In-memory store of active funding states
const fundingStates = new Map<string, FundingStateRecord>()

export const FUNDING_STATE_TTL_MS = 30 * 60 * 1000 // 30 minutes

export function clearFundingStates(): void {
  fundingStates.clear()
}

export function hashString(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

/**
 * Creates an attempt-scoped idempotency key for PayPal order creation.
 */
export function makeFundingRequestId(contractId: string, attempt: number): string {
  const safeAttempt = Math.max(1, attempt)
  return `pp:${contractId}:fund:${safeAttempt}`
}

/**
 * Initiates funding state binding: generates a random 32-byte nonce, stores its hash,
 * and returns the plaintext nonce to be included in PayPal return_url (?state=<nonce>).
 */
export function createFundingState(params: {
  contractId: string
  userId: string
  sessionId: string
  orderId: string
  now?: number
}): { nonce: string; stateId: string; expiresAt: number } {
  const now = params.now ?? Date.now()
  const nonce = crypto.randomBytes(32).toString('hex')
  const nonceHash = hashString(nonce)
  const sessionIdHash = hashString(params.sessionId)
  const stateId = `fs_${crypto.randomBytes(8).toString('hex')}`

  const record: FundingStateRecord = {
    id: stateId,
    contractId: params.contractId,
    userId: params.userId,
    sessionIdHash,
    orderId: params.orderId,
    nonceHash,
    expiresAt: now + FUNDING_STATE_TTL_MS,
    usedAt: null,
    createdAt: now,
  }

  fundingStates.set(stateId, record)
  return { nonce, stateId, expiresAt: record.expiresAt }
}

export type ValidateFundingResult =
  | { valid: true; record: FundingStateRecord }
  | { valid: false; reason: 'MISSING_STATE' | 'STATE_NOT_FOUND' | 'EXPIRED' | 'ALREADY_USED' | 'SESSION_MISMATCH' | 'USER_MISMATCH' | 'ORDER_MISMATCH' }

/**
 * Validates and atomically consumes a funding state on return / confirmation.
 */
export function validateAndConsumeFundingState(params: {
  nonce: string
  userId: string
  sessionId: string
  orderId: string
  now?: number
}): ValidateFundingResult {
  if (!params.nonce) {
    return { valid: false, reason: 'MISSING_STATE' }
  }

  const now = params.now ?? Date.now()
  const incomingHash = hashString(params.nonce)
  const incomingSessionHash = hashString(params.sessionId)

  // Find record matching nonce hash
  let target: FundingStateRecord | undefined
  for (const record of fundingStates.values()) {
    if (record.nonceHash === incomingHash) {
      target = record
      break
    }
  }

  if (!target) {
    return { valid: false, reason: 'STATE_NOT_FOUND' }
  }

  if (target.usedAt !== null) {
    return { valid: false, reason: 'ALREADY_USED' }
  }

  if (now > target.expiresAt) {
    return { valid: false, reason: 'EXPIRED' }
  }

  if (target.userId !== params.userId) {
    return { valid: false, reason: 'USER_MISMATCH' }
  }

  if (target.sessionIdHash !== incomingSessionHash) {
    return { valid: false, reason: 'SESSION_MISMATCH' }
  }

  if (target.orderId !== params.orderId) {
    return { valid: false, reason: 'ORDER_MISMATCH' }
  }

  // Atomically mark used
  target.usedAt = now
  return { valid: true, record: target }
}
