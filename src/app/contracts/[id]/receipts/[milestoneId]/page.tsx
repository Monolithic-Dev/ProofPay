'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { MonoText } from '@/components/common/MonoText'
import {
  CreditCard,
  CheckCircle2,
  Printer,
  ShieldCheck,
  ArrowLeft,
  Lock,
  Layers,
  FileCheck2,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { formatUsd } from '@/lib/format'

export default function MilestoneReceiptPage() {
  const params = useParams()
  const contractId = params?.id as string
  const milestoneId = params?.milestoneId as string
  const router = useRouter()

  const { data: contract, isLoading, error } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/contracts/${contractId}`)
      if (!res.ok) throw new Error('Failed to load contract')
      const json = await res.json()
      return json.contract
    },
  })

  if (isLoading) {
    return (
      <PageShell title="Loading Receipt…">
        <LoadingBlock message="Retrieving PayPal settlement details and capture ID…" />
      </PageShell>
    )
  }

  if (error || !contract) {
    return (
      <PageShell title="Receipt Error">
        <ErrorState title="Receipt Not Found" message="Unable to locate the specified settlement receipt." />
      </PageShell>
    )
  }

  const milestones = contract.milestones || []
  const milestone =
    milestones.find((m: any) => m.id === milestoneId || m.milestone_key === milestoneId) ||
    milestones[0]

  const captureId = milestone?.capture_id || contract.authorization_id || 'CAP-SANDBOX-TEST'

  return (
    <div className="min-h-screen bg-bg py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation & Print Bar */}
        <div className="flex items-center justify-between no-print">
          <Link
            href={`/contracts/${contractId}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Contract Timeline</span>
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border hover:border-brand/40 text-xs font-semibold text-text shadow-sm transition-all"
          >
            <Printer className="w-4 h-4 text-brand" />
            <span>Print or Save PDF</span>
          </button>
        </div>

        {/* Official Receipt Card */}
        <div className="card p-8 sm:p-12 border border-border/80 rounded-2xl bg-surface shadow-2xl space-y-8 print:border-none print:shadow-none">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-brand tracking-tight">ProofPay</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                  Settled on PayPal Rails
                </span>
              </div>
              <p className="text-xs text-muted">Official Milestone Settlement Receipt &amp; Proof of Release</p>
            </div>

            <div className="text-right">
              <div className="text-xs font-mono text-muted uppercase">Receipt ID</div>
              <div className="text-sm font-bold font-mono text-text">RCP-{contract.id.slice(0, 8)}</div>
              <div className="text-xs text-muted mt-0.5">{new Date().toLocaleDateString()}</div>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl bg-surface-2/40 border border-border/60 text-xs">
            <div className="space-y-1">
              <div className="font-semibold uppercase tracking-wider text-muted">Authorized Buyer (Client)</div>
              <div className="font-bold text-text text-sm">Client Account</div>
              <div className="text-muted">Payer Source: PayPal Sandbox Account</div>
            </div>
            <div className="space-y-1">
              <div className="font-semibold uppercase tracking-wider text-muted">Recipient (Seller)</div>
              <div className="font-bold text-text text-sm">Provider Account</div>
              <div className="text-muted">Status: Captured &amp; Released on Proof</div>
            </div>
          </div>

          {/* Line Item Table */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">Milestone Fulfillment</div>
            <div className="border border-border/60 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-subtle/50 text-muted border-b border-border/60">
                    <th className="py-2.5 px-4 font-semibold">Description</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Amount (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  <tr>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-text">{milestone?.title || contract.title}</div>
                      <div className="text-[11px] text-muted">Contract: {contract.title}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        PASSED
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-text">
                      {formatUsd(milestone?.amount_minor || contract.total_minor)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Settlement Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between text-muted">
                <span>Milestone Gross:</span>
                <span className="text-text font-medium">{formatUsd(milestone?.amount_minor || contract.total_minor)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>ProofPay Platform Fee:</span>
                <span className="text-emerald-400 font-medium">$0.00 (Sandbox)</span>
              </div>
              <div className="border-t border-border/60 pt-2 flex justify-between font-bold text-sm text-text">
                <span>Net Released:</span>
                <span className="text-brand">{formatUsd(milestone?.amount_minor || contract.total_minor)}</span>
              </div>
            </div>
          </div>

          {/* Cryptographic & PayPal Audit Box */}
          <div className="p-4 rounded-xl border border-border/60 bg-surface-subtle space-y-2 text-xs">
            <div className="font-semibold text-text flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand" />
              <span>Cryptographic Ledger &amp; PayPal Traceability</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted font-mono">
              <div>
                <span className="text-text font-sans">PayPal Capture ID:</span>{' '}
                <span>{captureId}</span>
              </div>
              <div>
                <span className="text-text font-sans">Canonical Agreement Hash:</span>{' '}
                <span>{contract.contract_hash?.slice(0, 16)}…</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
