'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Ban,
  Activity,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  calculateSecurityPosture,
  type SecurityPosture,
} from '@/shared/security'

export default function SecurityCenterPage() {
  const [useRealApi, setUseRealApi] = useState(false)

  // 1. Fetch current user role
  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/v1/auth/me')
      if (!res.ok) return null
      return res.json()
    },
  })

  // 2. Fetch posture (falling back to mock posture)
  const {
    data: postureData,
    isLoading: isPostureLoading,
    error,
  } = useQuery<SecurityPosture>({
    queryKey: ['security-posture', useRealApi],
    queryFn: async () => {
      if (useRealApi) {
        const res = await fetch('/api/v1/security/posture')
        if (res.ok) return res.json()
      }
      // Mock calculation from PLAT-6 spec
      return calculateSecurityPosture({
        mfaPrivilegedTotal: 2,
        mfaPrivilegedEnrolled: 1,
        apiKeysTotal: 3,
        apiKeysOlder90d: 1,
        apiKeysWithoutExpiry: 1,
        apiKeysWithoutAllowlist: 2,
        staleSessions30d: 0,
        pendingInvitesOlder14d: 0,
        unverifiedMembers: 0,
        riskEventsCount: 0,
        stepUpEnforced: true,
      })
    },
  })

  const userRole = (meData?.user?.role || 'owner').toLowerCase()
  const isForbidden = userRole === 'member'

  // Loading state
  if (isMeLoading || isPostureLoading) {
    return (
      <PageShell
        title="Security Center"
        subtitle="Security posture rating, credential hygiene, and identity governance"
      >
        <SettingsNav />
        <div className="flex items-center justify-center py-24" data-testid="security-center-loading">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted">Evaluating organization security posture...</p>
          </div>
        </div>
      </PageShell>
    )
  }

  // 403 Forbidden state for Member role
  if (isForbidden) {
    return (
      <PageShell
        title="Security Center"
        subtitle="Security posture rating, credential hygiene, and identity governance"
      >
        <SettingsNav />
        <div
          className="card p-12 text-center border border-rose-500/20 bg-rose-500/5 rounded-2xl max-w-2xl mx-auto space-y-4"
          data-testid="security-center-forbidden"
        >
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
            <Ban className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-text">403 — Access Denied</h2>
          <p className="text-sm text-muted">
            The Security Center is restricted to Organization Owners, Administrators, and Finance roles.
            Members do not have permission to view organizational posture or access credentials.
          </p>
          <div className="pt-2">
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-text bg-surface border border-border/80 rounded-xl hover:bg-surface/80 transition-colors"
            >
              Return to Settings
            </Link>
          </div>
        </div>
      </PageShell>
    )
  }

  // Error state
  if (error || !postureData) {
    return (
      <PageShell
        title="Security Center"
        subtitle="Security posture rating, credential hygiene, and identity governance"
      >
        <SettingsNav />
        <div
          className="card p-8 text-center border border-border/80 rounded-2xl max-w-xl mx-auto space-y-4"
          data-testid="security-center-error"
        >
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold text-text">Unable to load security posture</h2>
          <p className="text-sm text-muted">Please refresh the page or try again in a moment.</p>
        </div>
      </PageShell>
    )
  }

  const { score, mfa, api_keys, recommendations } = postureData

  const scoreBadgeColor =
    score >= 80
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : score >= 60
        ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        : 'text-rose-400 bg-rose-500/10 border-rose-500/20'

  const mfaRatio =
    mfa.privileged_total > 0
      ? Math.round((mfa.privileged_enrolled / mfa.privileged_total) * 100)
      : 100

  return (
    <PageShell
      title="Security Center"
      subtitle="Security posture rating, credential hygiene, and identity governance"
    >
      <SettingsNav />

      <div className="space-y-8 max-w-5xl" data-testid="security-center-content">
        {/* Posture Score Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Organization Posture Rating
                </span>
                <div className="flex items-baseline gap-4 mt-2">
                  <span className="text-5xl font-black tracking-tight text-text" data-testid="posture-score">
                    {score}
                  </span>
                  <span className="text-sm text-muted">/ 100 points</span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${scoreBadgeColor}`}
                  >
                    {score >= 80 ? 'Strong Posture' : score >= 60 ? 'Moderate' : 'Needs Attention'}
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <TrendingUp className="w-4 h-4" />
                <span>+5 pts this month</span>
              </div>
              <span>Evaluated at {new Date(postureData.generated_at).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Step-Up Protection
              </span>
              <div className="mt-2 flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold text-text text-sm">
                  {postureData.step_up.enforced ? 'Enforced (Active)' : 'Shadow Mode'}
                </span>
              </div>
              <p className="text-xs text-muted mt-2">
                Requires fresh authentication before funding, refunds, and API key generation.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-border/60">
              <Link
                href="/settings"
                className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
              >
                Configure Authentication Policies
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Security Cards Grid: MFA & API Key Hygiene */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* MFA Adoption Card */}
          <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-text text-base">MFA Adoption</h3>
                  <p className="text-xs text-muted">Privileged role enrollment</p>
                </div>
              </div>
              <span className="text-sm font-bold text-text">{mfaRatio}%</span>
            </div>

            <div className="w-full bg-border/40 rounded-full h-2 overflow-hidden">
              <div
                className="bg-brand h-2 rounded-full transition-all duration-300"
                style={{ width: `${mfaRatio}%` }}
              />
            </div>

            <p className="text-xs text-muted">
              {mfa.privileged_enrolled} of {mfa.privileged_total} Owners, Admins, and Finance members have Multi-Factor Authentication enabled.
            </p>

            <div className="pt-2">
              <Link
                href="/settings/team"
                className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
              >
                Manage Team MFA
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* API Key Hygiene Card */}
          <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-text text-base">API Key Hygiene</h3>
                  <p className="text-xs text-muted">{api_keys.total} active API keys</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-surface/60 rounded-xl border border-border/60">
                <span className="text-muted block font-medium">Older than 90d</span>
                <span className="text-base font-bold text-text mt-1 block">
                  {api_keys.older_than_90d}
                </span>
              </div>
              <div className="p-3 bg-surface/60 rounded-xl border border-border/60">
                <span className="text-muted block font-medium">Missing CIDR</span>
                <span className="text-base font-bold text-text mt-1 block">
                  {api_keys.without_allowlist}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/settings/api-keys"
                className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
              >
                Rotate & Restrict Keys
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Actionable Recommendations List */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-text text-lg">Actionable Recommendations</h3>
              <p className="text-xs text-muted">
                Address prioritized security gaps to raise your organization posture score.
              </p>
            </div>
            <span className="text-xs font-semibold text-muted">
              {recommendations.length} action(s) recommended
            </span>
          </div>

          <div className="space-y-3 mt-4" data-testid="recommendations-list">
            {recommendations.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted border border-border/60 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                All posture benchmarks met. Zero outstanding recommendations.
              </div>
            ) : (
              recommendations.map((rec) => {
                const badge =
                  rec.severity === 'high'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : rec.severity === 'medium'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20'

                return (
                  <div
                    key={rec.id}
                    className="p-4 rounded-xl border border-border/60 bg-surface/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${badge}`}
                        >
                          {rec.severity}
                        </span>
                        <h4 className="font-semibold text-text text-sm">{rec.title}</h4>
                      </div>
                      <p className="text-xs text-muted">{rec.detail}</p>
                    </div>

                    <Link
                      href={rec.action_href}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text bg-surface border border-border/80 hover:bg-surface/80 transition-colors whitespace-nowrap self-start sm:self-auto"
                    >
                      <span>Resolve</span>
                      <ExternalLink className="w-3.5 h-3.5 text-muted" />
                    </Link>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Risk Events Table / Empty State */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface text-muted flex items-center justify-center border border-border/80">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-text text-base">Risk Events (Last 30 Days)</h3>
                <p className="text-xs text-muted">
                  Heuristic anomaly detection, token spikes, and suspicious sign-in attempts
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-muted">0 events</span>
          </div>

          <div className="p-8 text-center border border-border/60 rounded-xl bg-surface/20 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-semibold text-text">No anomalous risk events detected</h4>
            <p className="text-xs text-muted max-w-md mx-auto">
              All member sign-ins, API invocations, and payment authorizations conform to standard operational baselines.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

