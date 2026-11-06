/**
 * Email abuse prevention and suppression controls.
 * Implements PLAT-12 (Audit S-6).
 *
 * Enforces invite rate limits by organization age, per-recipient caps,
 * plain-text sanitization of user strings, and honoring of abuse suppressions.
 */
import * as crypto from 'node:crypto'

// Suppressed recipient email hashes (SHA-256)
const emailSuppressions = new Set<string>()

// Track invites: key -> timestamp[]
const orgInviteLog = new Map<string, number[]>()
const recipientInviteLog = new Map<string, number[]>()

export function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

export function clearEmailAbuseStore(): void {
  emailSuppressions.clear()
  orgInviteLog.clear()
  recipientInviteLog.clear()
}

export function addEmailSuppression(email: string): void {
  emailSuppressions.add(hashEmail(email))
}

export function isEmailSuppressed(email: string): boolean {
  return emailSuppressions.has(hashEmail(email))
}

/**
 * Strips script tags, HTML tags, and escapes sensitive characters for email subjects and body text.
 */
export function sanitizeEmailString(input: string, maxLen: number = 80): string {
  if (!input) return ''
  // Strip <script> and <style> with inner content
  const noScripts = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  // Strip remaining HTML tags and control characters
  const clean = noScripts.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
  // Trim and cap length
  return clean.trim().slice(0, maxLen)
}

/**
 * Checks whether an organization is permitted to send an external invitation.
 */
export function checkEmailInviteQuota(params: {
  orgId: string
  orgCreatedAt: number
  recipientEmail: string
  now?: number
}): { allowed: boolean; reason?: string } {
  const now = params.now ?? Date.now()
  const oneDayAgo = now - 24 * 3600 * 1000

  // 1. Check suppression list
  if (isEmailSuppressed(params.recipientEmail)) {
    return { allowed: false, reason: 'RECIPIENT_SUPPRESSED' }
  }

  // 2. Org daily quota
  const orgAgeDays = (now - params.orgCreatedAt) / (24 * 3600 * 1000)
  const maxOrgDaily = orgAgeDays < 7 ? 5 : 30 // new orgs (<7 days) max 5/day, otherwise 30

  const orgTimestamps = (orgInviteLog.get(params.orgId) ?? []).filter((ts) => ts > oneDayAgo)
  if (orgTimestamps.length >= maxOrgDaily) {
    return {
      allowed: false,
      reason: `Organization daily invite limit exceeded (${maxOrgDaily}/day).`,
    }
  }

  // 3. Recipient daily quota (max 3/day across all orgs)
  const recipientHash = hashEmail(params.recipientEmail)
  const recipientTimestamps = (recipientInviteLog.get(recipientHash) ?? []).filter((ts) => ts > oneDayAgo)
  if (recipientTimestamps.length >= 3) {
    return {
      allowed: false,
      reason: 'Recipient daily invite limit exceeded (max 3/day).',
    }
  }

  // Record successful quota consumption
  orgTimestamps.push(now)
  orgInviteLog.set(params.orgId, orgTimestamps)

  recipientTimestamps.push(now)
  recipientInviteLog.set(recipientHash, recipientTimestamps)

  return { allowed: true }
}
