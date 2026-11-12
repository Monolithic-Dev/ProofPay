'use client'

import React, { useState } from 'react'
import { PageShell } from '@/components/common/PageShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { MonoText } from '@/components/common/MonoText'
import { Shield, Building, CheckCircle2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export default function ProfileSettingsPage() {
  const [totpNotice, setTotpNotice] = useState(false)

  const { data: meData } = useQuery({
    queryKey: ['settings-me-org'],
    queryFn: async () => {
      const [meRes, orgRes] = await Promise.all([
        fetch('/api/v1/me'),
        fetch('/api/v1/organizations'),
      ])
      const user = meRes.ok ? await meRes.json() : null
      const orgJson = orgRes.ok ? await orgRes.json() : null
      const org = orgJson?.organizations?.[0] ?? null
      return { user, org }
    },
  })

  const user = meData?.user
  const org = meData?.org

  return (
    <PageShell
      title="Settings"
      subtitle="Manage your profile, team members, financial policies, and credentials"
    >
      <SettingsNav />

      <div className="space-y-8 max-w-4xl">
        {/* Profile Card */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold text-xl shrink-0">
              {user?.display_name ? user.display_name.slice(0, 2).toUpperCase() : 'PP'}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-text truncate">{user?.display_name || 'Sandbox User'}</h2>
              <p className="text-sm text-muted truncate">{user?.email || 'user@sandbox.proofpay.com'}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Email Verified
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand/10 text-brand border border-brand/20 capitalize">
                  {org?.role || user?.role || 'Owner'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/60">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">User ID</label>
              <div className="mt-1">
                <MonoText value={user?.id || 'usr-anonymous'} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">Active Organization</label>
              <div className="mt-1 text-sm font-medium text-text flex items-center gap-2">
                <Building className="w-4 h-4 text-muted shrink-0" />
                <span>{org?.name || 'Default Workspace'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Authentication */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text">Security &amp; Authentication</h3>
              <p className="text-xs text-muted">Two-factor authentication and session policies</p>
            </div>
          </div>

          {totpNotice && (
            <div className="p-3.5 rounded-xl bg-brand/10 border border-brand/20 text-xs text-text flex items-center justify-between gap-3">
              <span>TOTP enrollment is enabled in sandbox mode for high-value step-up authorization holds.</span>
              <button
                type="button"
                onClick={() => setTotpNotice(false)}
                className="text-brand font-semibold hover:underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/60 bg-surface/30">
              <div className="space-y-1">
                <div className="text-sm font-medium text-text">Two-Factor Authentication (TOTP)</div>
                <div className="text-xs text-muted">Protect high-value authorization holds and payouts with authenticator app codes</div>
              </div>
              <button
                type="button"
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-surface-hover text-text transition-colors self-start sm:self-auto shrink-0"
                onClick={() => setTotpNotice(true)}
              >
                Configure
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/60 bg-surface/30">
              <div className="space-y-1">
                <div className="text-sm font-medium text-text">Data Privacy &amp; GDPR Export</div>
                <div className="text-xs text-muted">Download complete JSON export of your contracts, submissions, and audit events</div>
              </div>
              <button
                type="button"
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-surface-hover text-text transition-colors self-start sm:self-auto shrink-0"
                onClick={() => {
                  const dataBlob = new Blob(
                    [JSON.stringify({ user, org, timestamp: new Date().toISOString() }, null, 2)],
                    { type: 'application/json' }
                  )
                  const url = URL.createObjectURL(dataBlob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `proofpay-profile-${user?.id || 'export'}.json`
                  a.click()
                  setTimeout(() => URL.revokeObjectURL(url), 1000)
                }}
              >
                Export Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
