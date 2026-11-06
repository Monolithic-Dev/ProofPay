/**
 * Shared security posture types and scoring definitions.
 * Implements PLAT-6.
 */

export interface SecurityPosture {
  score: number // 0–100
  generated_at: string
  mfa: { privileged_total: number; privileged_enrolled: number }
  api_keys: {
    total: number
    older_than_90d: number
    never_used_30d: number
    without_expiry: number
    without_allowlist: number
  }
  sessions: { stale_30d: number }
  invitations: { pending_older_than_14d: number }
  members: { unverified: number }
  risk_events_30d: { total: number; by_rule: Record<string, number> }
  step_up: { enforced: boolean }
  recommendations: {
    id: string
    severity: 'high' | 'medium' | 'low'
    title: string
    detail: string
    action_href: string
  }[]
}

export interface RiskEvent {
  id: string
  rule: string
  severity: 'high' | 'medium' | 'low'
  description: string
  timestamp: string
  clientIp?: string
}

/**
 * Calculates a deterministic 0–100 security posture score and actionable recommendations.
 */
export function calculateSecurityPosture(data: {
  mfaPrivilegedTotal: number
  mfaPrivilegedEnrolled: number
  apiKeysTotal: number
  apiKeysOlder90d: number
  apiKeysWithoutExpiry: number
  apiKeysWithoutAllowlist: number
  staleSessions30d: number
  pendingInvitesOlder14d: number
  unverifiedMembers: number
  riskEventsCount: number
  stepUpEnforced: boolean
  now?: string
}): SecurityPosture {
  const recommendations: SecurityPosture['recommendations'] = []

  // 1. MFA Coverage (30 pts)
  let mfaPoints = 30
  if (data.mfaPrivilegedTotal > 0) {
    const ratio = data.mfaPrivilegedEnrolled / data.mfaPrivilegedTotal
    mfaPoints = Math.round(ratio * 30)
    if (ratio < 1) {
      recommendations.push({
        id: 'rec_mfa',
        severity: 'high',
        title: 'Enroll all privileged roles in MFA',
        detail: `${data.mfaPrivilegedTotal - data.mfaPrivilegedEnrolled} administrator or finance member(s) lack Multi-Factor Authentication.`,
        action_href: '/app/settings/security',
      })
    }
  }

  // 2. API Key Hygiene (20 pts)
  let keyPoints = 20
  if (data.apiKeysTotal > 0) {
    let deductions = 0
    if (data.apiKeysOlder90d > 0) deductions += 8
    if (data.apiKeysWithoutExpiry > 0) deductions += 6
    if (data.apiKeysWithoutAllowlist > 0) deductions += 6
    keyPoints = Math.max(0, 20 - deductions)

    if (data.apiKeysOlder90d > 0) {
      recommendations.push({
        id: 'rec_key_age',
        severity: 'medium',
        title: 'Rotate stale API keys',
        detail: `${data.apiKeysOlder90d} API key(s) are older than 90 days.`,
        action_href: '/app/settings/developer',
      })
    }
    if (data.apiKeysWithoutAllowlist > 0) {
      recommendations.push({
        id: 'rec_key_cidr',
        severity: 'medium',
        title: 'Restrict API keys to CIDR allowlists',
        detail: `${data.apiKeysWithoutAllowlist} API key(s) accept connections from any IP.`,
        action_href: '/app/settings/developer',
      })
    }
  }

  // 3. Risk Events (15 pts)
  const riskDeduction = Math.min(15, data.riskEventsCount * 3)
  const riskPoints = Math.max(0, 15 - riskDeduction)
  if (data.riskEventsCount > 0) {
    recommendations.push({
      id: 'rec_risk_events',
      severity: 'high',
      title: 'Review elevated risk events',
      detail: `${data.riskEventsCount} anomaly or risk event(s) occurred in the last 30 days.`,
      action_href: '/app/security',
    })
  }

  // 4. Session Hygiene (10 pts)
  const sessionPoints = data.staleSessions30d > 0 ? 5 : 10

  // 5. Invitations (10 pts)
  const invitePoints = data.pendingInvitesOlder14d > 0 ? 5 : 10

  // 6. Member Verification (10 pts)
  const memberPoints = data.unverifiedMembers > 0 ? 5 : 10
  if (data.unverifiedMembers > 0) {
    recommendations.push({
      id: 'rec_unverified_members',
      severity: 'low',
      title: 'Verify pending member accounts',
      detail: `${data.unverifiedMembers} member(s) have unverified emails.`,
      action_href: '/app/settings/members',
    })
  }

  // 7. Step-Up Enforced (5 pts)
  const stepUpPoints = data.stepUpEnforced ? 5 : 0
  if (!data.stepUpEnforced) {
    recommendations.push({
      id: 'rec_step_up',
      severity: 'medium',
      title: 'Enable Step-Up Authentication enforcement',
      detail: 'Step-up authentication is currently running in shadow mode.',
      action_href: '/app/security',
    })
  }

  const totalScore = Math.min(
    100,
    mfaPoints + keyPoints + riskPoints + sessionPoints + invitePoints + memberPoints + stepUpPoints
  )

  return {
    score: totalScore,
    generated_at: data.now ?? new Date().toISOString(),
    mfa: {
      privileged_total: data.mfaPrivilegedTotal,
      privileged_enrolled: data.mfaPrivilegedEnrolled,
    },
    api_keys: {
      total: data.apiKeysTotal,
      older_than_90d: data.apiKeysOlder90d,
      never_used_30d: 0,
      without_expiry: data.apiKeysWithoutExpiry,
      without_allowlist: data.apiKeysWithoutAllowlist,
    },
    sessions: { stale_30d: data.staleSessions30d },
    invitations: { pending_older_than_14d: data.pendingInvitesOlder14d },
    members: { unverified: data.unverifiedMembers },
    risk_events_30d: { total: data.riskEventsCount, by_rule: {} },
    step_up: { enforced: data.stepUpEnforced },
    recommendations,
  }
}
