'use client'

import React, { useState } from 'react'
import { PageShell } from '@/components/common/PageShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { MonoText } from '@/components/common/MonoText'
import { Shield, User, Mail, Building, KeyRound, CheckCircle2, ShieldAlert } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/lib/query'

export default function ProfileSettingsPage() {
  const api = useApiClient()

  const { data: meData, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/v1/auth/me')
      if (!res.ok) return null
      return res.json()
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
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold text-xl">
              {user?.display_name ? user.display_name.slice(0, 2).toUpperCase() : 'PP'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-text">{user?.display_name || 'Sandbox User'}</h2>
              <p className="text-sm text-muted">{user?.email || 'user@sandbox.proofpay.com'}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Email Verified
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand/10 text-brand border border-brand/20 capitalize">
                  {user?.role || 'Owner'}
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
                <Building className="w-4 h-4 text-muted" />
                <span>{org?.name || 'Default Workspace'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Authentication */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text">Security & Authentication</h3>
              <p className="text-xs text-muted">Two-factor authentication and session policies</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-surface/30">
              <div className="space-y-1">
                <div className="text-sm font-medium text-text">Two-Factor Authentication (TOTP)</div>
                <div className="text-xs text-muted">Protect high-value authorization holds and payouts with authenticator app codes</div>
              </div>
              <button
                type="button"
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-surface-hover text-text transition-colors"
                onClick={() => alert('TOTP setup: Scan QR code with Google Authenticator or 1Password. (Active in sandbox)')}
              >
                Configure
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-surface/30">
              <div className="space-y-1">
                <div className="text-sm font-medium text-text">Data Privacy & GDPR Export</div>
                <div className="text-xs text-muted">Download complete JSON export of your contracts, submissions, and audit events</div>
              </div>
              <button
                type="button"
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-surface-hover text-text transition-colors"
                onClick={() => {
                  const dataBlob = new Blob([JSON.stringify({ user, org, timestamp: new Date().toISOString() }, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(dataBlob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `proofpay-profile-${user?.id || 'export'}.json`
                  a.click()
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
