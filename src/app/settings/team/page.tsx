'use client'

import React, { useState } from 'react'
import { PageShell } from '@/components/common/PageShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { UserPlus, Trash2, Mail, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export default function TeamSettingsPage() {
  const queryClient = useQueryClient()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'finance' | 'member' | 'viewer'>('member')
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null)

  // Fetch active org
  const { data: orgData, isLoading: isOrgLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await fetch('/api/v1/organizations')
      if (!res.ok) return null
      return res.json()
    },
  })

  const orgId = orgData?.organizations?.[0]?.id

  // Fetch team members
  const { data, isLoading, error } = useQuery({
    queryKey: ['team-members', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const res = await fetch(`/api/v1/organizations/${orgId}/members`)
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Failed to load team members')
      }
      return res.json()
    },
  })

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const res = await fetch(`/api/v1/organizations/${orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Failed to send invite')
      }
      return res.json()
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['team-members', orgId] })
      setInviteEmail('')
      setIsInviteOpen(false)
      setInviteSuccessMsg(`Invitation created for ${res.invitation.email}`)
      setActionError(null)
    },
    onError: (err: any) => {
      setActionError(err.message || 'Invitation failed')
    },
  })

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const res = await fetch(`/api/v1/organizations/${orgId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Failed to update role')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', orgId] })
      setActionError(null)
    },
    onError: (err: any) => {
      setActionError(err.message || 'Role update failed')
    },
  })

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/v1/organizations/${orgId}/members/${memberId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Failed to remove member')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', orgId] })
      setActionError(null)
    },
    onError: (err: any) => {
      setActionError(err.message || 'Removal failed')
    },
  })

  const members = data?.members || []
  const pendingInvites = data?.pending_invitations || []

  return (
    <PageShell
      title="Settings"
      subtitle="Manage your profile, team members, financial policies, and credentials"
      actions={
        <button
          type="button"
          onClick={() => setIsInviteOpen(true)}
          disabled={!orgId}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-lg shadow-brand/20 transition-all disabled:opacity-50"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Teammate</span>
        </button>
      }
    >
      <SettingsNav />

      <div className="space-y-8 max-w-5xl">
        {actionError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {inviteSuccessMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{inviteSuccessMsg}</span>
          </div>
        )}

        {/* Members List */}
        <div className="card border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm overflow-hidden">
          <div className="p-6 border-b border-border/60 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-text">Workspace Members</h3>
              <p className="text-xs text-muted">People with access to this workspace and contracts</p>
            </div>
            <span className="text-xs text-muted font-medium bg-surface/80 px-2.5 py-1 rounded-full border border-border/60">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </span>
          </div>

          {isOrgLoading || isLoading ? (
            <div className="p-8">
              <LoadingBlock message="Loading team members..." />
            </div>
          ) : !orgId ? (
            <div className="p-8 text-center text-sm text-muted">
              Sign in or select a sandbox persona in <span className="font-mono">/demo</span> to manage workspace team members.
            </div>
          ) : error ? (
            <div className="p-8">
              <ErrorState title="Failed to load members" message={(error as any)?.message} />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {members.map((m: any) => (
                <div key={m.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface/30 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold text-sm shrink-0">
                      {m.display_name ? m.display_name.slice(0, 2).toUpperCase() : 'PP'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text truncate">{m.display_name || 'Member'}</div>
                      <div className="text-xs text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="truncate">{m.email}</span>
                        <span>•</span>
                        <span>Joined {new Date(m.joined_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-start sm:self-auto shrink-0">
                    {m.role === 'owner' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand/10 text-brand border border-brand/20">
                        Owner
                      </span>
                    ) : (
                      <select
                        value={m.role}
                        onChange={(e) => updateRoleMutation.mutate({ memberId: m.id, role: e.target.value })}
                        disabled={updateRoleMutation.isPending}
                        className="bg-surface border border-border text-xs text-text rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand"
                      >
                        <option value="admin">Admin</option>
                        <option value="finance">Finance</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    )}

                    {m.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove ${m.display_name || m.email} from this workspace?`)) {
                            removeMemberMutation.mutate(m.id)
                          }
                        }}
                        disabled={removeMemberMutation.isPending}
                        className="p-1.5 text-muted hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Invitations */}
        {pendingInvites.length > 0 && (
          <div className="card border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm overflow-hidden">
            <div className="p-6 border-b border-border/60">
              <h3 className="text-base font-semibold text-text">Pending Invitations</h3>
              <p className="text-xs text-muted">Invitations awaiting acceptance</p>
            </div>
            <div className="divide-y divide-border/60">
              {pendingInvites.map((inv: any) => (
                <div key={inv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="w-4 h-4 text-muted shrink-0" />
                    <span className="text-sm font-medium text-text truncate">{inv.email}</span>
                    <span className="px-2 py-0.5 rounded text-xs bg-surface border border-border text-muted capitalize shrink-0">
                      {inv.role}
                    </span>
                  </div>
                  <div className="text-xs text-muted flex items-center gap-1.5 shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-text">Invite Teammate</h3>
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="text-muted hover:text-text"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted">
              Send an invitation link to collaborate on milestone contracts, review submissions, or manage finance approvals.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                inviteMutation.mutate({ email: inviteEmail, role: inviteRole })
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2 text-sm text-text focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted block mb-1">Role &amp; Permissions</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2 text-sm text-text focus:outline-none focus:border-brand"
                >
                  <option value="member">Member — Create, submit &amp; discuss contracts</option>
                  <option value="finance">Finance — Authorize &amp; approve funding, view ledger</option>
                  <option value="admin">Admin — Manage members, API keys, and contracts</option>
                  <option value="viewer">Viewer — Read-only auditing and reports</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition-all shadow-md shadow-brand/20 disabled:opacity-50"
                >
                  {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  )
}
