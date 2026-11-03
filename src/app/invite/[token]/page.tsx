'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { MonoText } from '@/components/common/MonoText'
import {
  Shield,
  CheckCircle2,
  Lock,
  ArrowRight,
  Clock,
  Layers,
  DollarSign,
  AlertCircle,
  FileText,
  User,
  XCircle,
} from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { formatUsd } from '@/lib/format'

export default function InviteReviewPage() {
  const params = useParams()
  const token = params?.token as string
  const router = useRouter()

  const [declineReason, setDeclineReason] = useState('')
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['invitation', token],
    queryFn: async () => {
      const res = await fetch(`/api/v1/invitations/${token}`)
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Invalid or expired invitation')
      }
      return res.json()
    },
  })

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/invitations/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Failed to accept contract')
      }
      return res.json()
    },
    onSuccess: (data) => {
      router.push(`/contracts/${data.contract.id}`)
    },
    onError: (err: any) => {
      setActionError(err.message || 'Acceptance failed')
    },
  })

  const declineMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetch(`/api/v1/invitations/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', reason }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Failed to decline contract')
      }
      return res.json()
    },
    onSuccess: () => {
      setShowDeclineModal(false)
      router.push('/contracts')
    },
    onError: (err: any) => {
      setActionError(err.message || 'Decline failed')
    },
  })

  if (isLoading) {
    return (
      <PageShell title="Loading Agreement Proposal…">
        <LoadingBlock message="Retrieving contract terms, criteria, and canonical hash…" />
      </PageShell>
    )
  }

  if (error || !data) {
    return (
      <PageShell title="Invitation Error">
        <ErrorState
          title="Invalid or Expired Invitation"
          message={(error as any)?.message || 'The invitation link could not be validated.'}
        />
      </PageShell>
    )
  }

  const { contract, invitation } = data
  const isAccepted = !!invitation.accepted_at

  return (
    <PageShell
      title="Contract Proposal Review"
      subtitle={`You have been invited by ${contract.buyer?.display_name || 'Client'} to review and accept this agreement`}
    >
      <div className="space-y-8 max-w-4xl pb-16">
        {actionError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Agreement Status Banner */}
        <div className="p-6 rounded-2xl bg-brand/5 border border-brand/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                {contract.status}
              </span>
              <span className="text-xs text-muted">
                Invited recipient: <strong>{invitation.email}</strong>
              </span>
            </div>
            <h2 className="text-xl font-bold text-text">{contract.title}</h2>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>Canonical Hash:</span>
              <MonoText value={contract.contract_hash} short />
            </div>
          </div>

          <div className="text-right flex flex-col items-start md:items-end justify-center shrink-0">
            <div className="text-xs text-muted uppercase font-semibold">Total Commitment</div>
            <div className="text-2xl font-black text-text">{formatUsd(contract.total_minor)}</div>
            <div className="text-[11px] text-muted">Secured via PayPal Authorization Hold</div>
          </div>
        </div>

        {/* Milestones Breakdown */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <h3 className="text-base font-semibold text-text">Milestone Deliverables &amp; Acceptance Criteria</h3>
              <p className="text-xs text-muted">Funds release only when submitted work passes these objective checks</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface border border-border text-muted">
              {contract.milestones.length} Milestones
            </span>
          </div>

          <div className="space-y-4">
            {contract.milestones.map((m: any, idx: number) => (
              <div key={m.id} className="p-4 rounded-xl border border-border/60 bg-surface/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-text">{m.title}</span>
                  </div>
                  <span className="text-sm font-bold text-text">{formatUsd(m.amount_minor)}</span>
                </div>

                <div className="space-y-1.5 pl-8">
                  {m.criteria?.map((c: any) => (
                    <div key={c.id} className="text-xs flex items-center justify-between p-2 rounded bg-surface/60 border border-border/40 text-muted">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-text font-medium">{c.label}</span>
                      </div>
                      <span className="font-mono text-[11px] text-brand uppercase">{c.check_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/50 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-sm font-bold text-text">Ready to Lock Terms?</h4>
            <p className="text-xs text-muted">
              Accepting binds your workspace as the seller party and prompts the client to deposit the PayPal hold.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDeclineModal(true)}
              className="px-4 py-2.5 rounded-xl border border-border hover:border-red-500/40 text-muted hover:text-red-400 text-xs font-semibold transition-colors"
            >
              Decline Proposal
            </button>
            <button
              type="button"
              disabled={acceptMutation.isPending || isAccepted}
              onClick={() => acceptMutation.mutate()}
              className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-lg shadow-brand/20 transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{acceptMutation.isPending ? 'Locking Terms…' : isAccepted ? 'Already Accepted' : 'Accept & Lock Terms'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-text">Decline Contract Proposal</h3>
            <p className="text-xs text-muted">
              Are you sure you want to decline this agreement? Please provide a brief reason for the client.
            </p>
            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g., Deliverable scope or timeline requires adjustment…"
              className="w-full bg-surface-subtle border border-border rounded-xl p-3 text-xs text-text focus:outline-none focus:border-brand"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeclineModal(false)}
                className="px-4 py-2 text-xs font-medium text-muted hover:text-text"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={declineMutation.isPending}
                onClick={() => declineMutation.mutate(declineReason)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
              >
                {declineMutation.isPending ? 'Declining…' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
