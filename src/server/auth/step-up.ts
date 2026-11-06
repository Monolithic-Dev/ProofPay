/**
 * Step-up authentication for sensitive actions.
 * Implements PLAT-3 (Audit S-12).
 *
 * Enforces recent proof of identity (TTL 600s) bound to session ID before
 * sensitive operations like funding, refunding, minting API keys, or role elevation.
 */

export const STEP_UP_ACTIONS = [
  'funding.start',
  'funding.approve',
  'payment.refund',
  'apikey.create',
  'apikey.rotate',
  'serviceaccount.create',
  'member.role_change_privileged',
  'org.transfer_ownership',
  'me.export',
  'account.delete',
] as const

export type StepUpAction = (typeof STEP_UP_ACTIONS)[number]

export interface StepUpGrant {
  id: string
  sessionId: string
  userId: string
  method: 'password' | 'totp'
  verifiedAt: number
  expiresAt: number
  createdAt: number
}

// In-memory grant store with TTL and session binding
const stepUpGrants = new Map<string, StepUpGrant>()

// Rate limiting state: userId -> { attempts: number, firstAttemptAt: number }
const failedAttemptsByUser = new Map<string, { count: number; windowStart: number }>()
const MAX_FAILED_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
export const GRANT_TTL_MS = 600 * 1000 // 600 seconds (10 minutes)

export function clearStepUpStore(): void {
  stepUpGrants.clear()
  failedAttemptsByUser.clear()
}

export function isStepUpAction(action: string): action is StepUpAction {
  return STEP_UP_ACTIONS.includes(action as StepUpAction)
}

/**
 * Checks whether an active, valid step-up grant exists for the session and user.
 */
export function hasValidStepUpGrant(
  userId: string,
  sessionId: string,
  now: number = Date.now()
): boolean {
  for (const grant of stepUpGrants.values()) {
    if (
      grant.userId === userId &&
      grant.sessionId === sessionId &&
      grant.expiresAt > now
    ) {
      return true
    }
  }
  return false
}

/**
 * Enforces step-up requirement.
 * Returns true if allowed, false if blocked (or throws error).
 */
export function checkStepUpPermission(
  userId: string,
  sessionId: string,
  action: StepUpAction,
  now: number = Date.now(),
  enforce: boolean = process.env.STEP_UP_ENFORCE === 'true'
): {
  allowed: boolean
  error?: 'STEP_UP_REQUIRED'
  details?: { methods: string[]; action: StepUpAction; max_age_sec: number }
} {
  const hasGrant = hasValidStepUpGrant(userId, sessionId, now)

  if (!hasGrant) {
    if (!enforce) {
      // Shadow mode: log only
      console.info(`[StepUp:Shadow] action "${action}" would_require_step_up for user "${userId}"`)
      return { allowed: true }
    }

    return {
      allowed: false,
      error: 'STEP_UP_REQUIRED',
      details: {
        methods: ['password', 'totp'],
        action,
        max_age_sec: 600,
      },
    }
  }

  return { allowed: true }
}

/**
 * Validates step-up attempt and issues a grant if successful.
 */
export function recordStepUpAttempt(
  userId: string,
  sessionId: string,
  method: 'password' | 'totp',
  isValidCredential: boolean,
  now: number = Date.now()
): { success: boolean; grant?: StepUpGrant; rateLimited?: boolean } {
  // Check rate limit on user
  const record = failedAttemptsByUser.get(userId)
  if (record) {
    if (now - record.windowStart < ATTEMPT_WINDOW_MS) {
      if (record.count >= MAX_FAILED_ATTEMPTS) {
        return { success: false, rateLimited: true }
      }
    } else {
      // Window expired, reset
      failedAttemptsByUser.delete(userId)
    }
  }

  if (!isValidCredential) {
    const existing = failedAttemptsByUser.get(userId)
    if (!existing || now - existing.windowStart >= ATTEMPT_WINDOW_MS) {
      failedAttemptsByUser.set(userId, { count: 1, windowStart: now })
    } else {
      existing.count += 1
    }
    return { success: false }
  }

  // Clear failed attempts on success
  failedAttemptsByUser.delete(userId)

  const grantId = `grant_${Math.random().toString(36).slice(2)}_${now}`
  const grant: StepUpGrant = {
    id: grantId,
    sessionId,
    userId,
    method,
    verifiedAt: now,
    expiresAt: now + GRANT_TTL_MS,
    createdAt: now,
  }

  stepUpGrants.set(grantId, grant)
  return { success: true, grant }
}
