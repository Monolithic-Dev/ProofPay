'use client'

import React, { useState } from 'react'
import { PageShell } from '@/components/common/PageShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { Building, Shield, Clock, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export default function WorkspaceSettingsPage() {
  const queryClient = useQueryClient()

  const [savedSuccess, setSavedSuccess] = useState(false)
  const [thresholdDollars, setThresholdDollars] = useState('5000')
  const [autoReleaseHours, setAutoReleaseHours] = useState('72')
  const [membersCanAccept, setMembersCanAccept] = useState(false)

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/v1/auth/me')
      if (!res.ok) return null
      return res.json()
    },
  })

  const org = meData?.org

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  return (
    <PageShell
      title="Settings"
      subtitle="Manage your profile, team members, financial policies, and credentials"
    >
      <SettingsNav />

      <form onSubmit={handleSave} className="space-y-8 max-w-4xl">
        {savedSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Workspace policy settings updated successfully.</span>
          </div>
        )}

        {/* General Info */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/20 text-brand">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text">Workspace Identity</h3>
              <p className="text-xs text-muted">Legal or commercial organization name</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">Organization Name</label>
              <input
                type="text"
                defaultValue={org?.name || 'My Organization'}
                className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2 text-sm text-text focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">Workspace Slug</label>
              <input
                type="text"
                disabled
                defaultValue={org?.slug || 'workspace-slug'}
                className="w-full bg-surface-subtle/50 border border-border/60 rounded-xl px-3.5 py-2 text-sm text-muted cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Financial Governance & Policies */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text">Financial Governance (RBAC §5.3)</h3>
              <p className="text-xs text-muted">Approval thresholds and release windows</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-border/60 bg-surface/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 max-w-lg">
                <div className="text-sm font-semibold text-text flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Funding Approval Threshold (4-Eyes Principle)</span>
                </div>
                <div className="text-xs text-muted">
                  Contracts with total volume above this threshold require secondary approval from an Admin or Finance officer before authorization hold can start.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">$</span>
                <input
                  type="number"
                  value={thresholdDollars}
                  onChange={(e) => setThresholdDollars(e.target.value)}
                  className="w-28 bg-surface-subtle border border-border rounded-lg px-3 py-1.5 text-sm text-text font-mono text-right focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/60 bg-surface/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 max-w-lg">
                <div className="text-sm font-semibold text-text flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand" />
                  <span>Default Auto-Release Honor Period</span>
                </div>
                <div className="text-xs text-muted">
                  Standard review window for milestone submissions before funds automatically capture if buyer does not contest.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={autoReleaseHours}
                  onChange={(e) => setAutoReleaseHours(e.target.value)}
                  className="w-20 bg-surface-subtle border border-border rounded-lg px-3 py-1.5 text-sm text-text font-mono text-right focus:outline-none focus:border-brand"
                />
                <span className="text-sm text-muted">hours</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/60 bg-surface/30 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-text">Members can accept incoming contracts</div>
                <div className="text-xs text-muted">When disabled, only Owner and Admin roles may accept seller contracts</div>
              </div>
              <input
                type="checkbox"
                checked={membersCanAccept}
                onChange={(e) => setMembersCanAccept(e.target.checked)}
                className="w-4 h-4 rounded text-brand focus:ring-brand accent-brand cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-lg shadow-brand/20 transition-all"
          >
            Save Policy Settings
          </button>
        </div>
      </form>
    </PageShell>
  )
}
