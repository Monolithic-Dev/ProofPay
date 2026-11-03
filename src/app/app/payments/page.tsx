'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { Money } from '@/components/common/Money'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { formatUsd } from '@/lib/format'
import {
  DollarSign,
  Lock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink,
  Search,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  Receipt,
  Clock,
  Copy,
  Check,
} from 'lucide-react'

interface PaymentRow {
  id: string
  contract_id: string
  contract_title: string
  milestone_id?: string
  milestone_title?: string
  type: 'HOLD_AUTHORIZED' | 'CAPTURE_RELEASED' | 'HOLD_VOIDED'
  amount_minor: number
  currency: string
  paypal_id: string | null
  status: string
  receipt_url: string | null
  date: string
}

interface PaymentsSummary {
  held_minor: number
  released_minor_month: number
  voided_minor: number
  refunded_minor: number
  at_risk_minor: number
  currency: string
}

export default function PaymentsPage() {
  const [summary, setSummary] = useState<PaymentsSummary | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'ALL' | 'HOLD_AUTHORIZED' | 'CAPTURE_RELEASED' | 'HOLD_VOIDED'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    async function loadPaymentsData() {
      setIsLoading(true)
      setError(null)
      try {
        const [sumRes, payRes] = await Promise.all([
          fetch('/api/v1/payments/summary', { credentials: 'include' }),
          fetch('/api/v1/payments', { credentials: 'include' }),
        ])

        if (!sumRes.ok || !payRes.ok) {
          throw new Error('Failed to load payments data')
        }

        const sumJson = await sumRes.json()
        const payJson = await payRes.json()

        setSummary(sumJson)
        setPayments(payJson.payments || [])
      } catch (err: any) {
        setError(err.message || 'Error loading payments')
      } finally {
        setIsLoading(false)
      }
    }

    loadPaymentsData()
  }, [])

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredPayments = payments.filter((p) => {
    if (filterType !== 'ALL' && p.type !== filterType) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      p.contract_title.toLowerCase().includes(q) ||
      (p.milestone_title && p.milestone_title.toLowerCase().includes(q)) ||
      (p.paypal_id && p.paypal_id.toLowerCase().includes(q)) ||
      p.id.toLowerCase().includes(q)
    )
  })

  if (isLoading) {
    return (
      <PageShell title="Payments & Holds">
        <LoadingBlock message="Loading PayPal authorization holds, releases, and transaction records…" />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell title="Payments & Holds">
        <ErrorState
          title="Could not load payments"
          message={error}
          onRetry={() => window.location.reload()}
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Payments & Holds"
      subtitle="View all PayPal authorization holds, automated milestone releases, and cryptographically verified settlement receipts."
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/ledger"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-border text-xs font-semibold text-text hover:bg-surface-2 transition-colors shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-brand" />
            <span>Audit Ledger</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Sandbox Honest Callout */}
        <div className="p-4 rounded-2xl bg-surface border border-border flex items-start gap-3 shadow-sm">
          <div className="p-2 rounded-xl bg-brand/10 text-brand shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="text-xs space-y-1">
            <p className="font-semibold text-text">PayPal Authorization Holds, Not Escrow</p>
            <p className="text-muted leading-relaxed">
              Funds are secured as a 29-day authorization hold on the buyer’s PayPal funding source.
              Money only moves when milestone deliverables achieve 100% verified passing criteria.
              Sandbox test mode moves simulated currency without real charges.
            </p>
          </div>
        </div>

        {/* Financial Stat Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tile 1: Open Holds */}
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted uppercase tracking-wider">Open Holds</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Lock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-text">
              {formatUsd(summary?.held_minor ?? 0)}
            </div>
            <p className="text-[11px] text-muted mt-1.5 flex items-center gap-1">
              <span>Authorized & secured on PayPal</span>
            </p>
          </div>

          {/* Tile 2: Released This Month */}
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted uppercase tracking-wider">Released (Month)</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-400">
              {formatUsd(summary?.released_minor_month ?? 0)}
            </div>
            <p className="text-[11px] text-muted mt-1.5 flex items-center gap-1">
              <span>Captured on verified proof</span>
            </p>
          </div>

          {/* Tile 3: Voided / Returned */}
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted uppercase tracking-wider">Voided Holds</span>
              <div className="p-2 rounded-xl bg-zinc-500/10 text-zinc-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-text">
              {formatUsd(summary?.voided_minor ?? 0)}
            </div>
            <p className="text-[11px] text-muted mt-1.5 flex items-center gap-1">
              <span>Cancelled before capture</span>
            </p>
          </div>

          {/* Tile 4: At Risk / Expiring */}
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted uppercase tracking-wider">Hold Expiring Soon</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-amber-400">
              {formatUsd(summary?.at_risk_minor ?? 0)}
            </div>
            <p className="text-[11px] text-muted mt-1.5 flex items-center gap-1">
              <span>Due within 72 hours</span>
            </p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Tab Filters */}
          <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-xl border border-border text-xs font-medium self-start">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterType === 'ALL'
                  ? 'bg-surface text-text shadow-xs font-semibold'
                  : 'text-muted hover:text-text'
              }`}
            >
              All Records ({payments.length})
            </button>
            <button
              onClick={() => setFilterType('HOLD_AUTHORIZED')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterType === 'HOLD_AUTHORIZED'
                  ? 'bg-surface text-text shadow-xs font-semibold'
                  : 'text-muted hover:text-text'
              }`}
            >
              Active Holds
            </button>
            <button
              onClick={() => setFilterType('CAPTURE_RELEASED')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterType === 'CAPTURE_RELEASED'
                  ? 'bg-surface text-text shadow-xs font-semibold'
                  : 'text-muted hover:text-text'
              }`}
            >
              Captured Releases
            </button>
            <button
              onClick={() => setFilterType('HOLD_VOIDED')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterType === 'HOLD_VOIDED'
                  ? 'bg-surface text-text shadow-xs font-semibold'
                  : 'text-muted hover:text-text'
              }`}
            >
              Voided
            </button>
          </div>

          {/* Search Field */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search agreement, milestone, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-surface border border-border text-text placeholder-muted focus:outline-none focus:border-brand transition-colors"
            />
          </div>
        </div>

        {/* Transactions Table */}
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
          {filteredPayments.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3 text-muted">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-text mb-1">No payment transactions found</h3>
              <p className="text-xs text-muted max-w-sm mx-auto mb-4">
                {searchQuery || filterType !== 'ALL'
                  ? 'Try adjusting your search query or active filter.'
                  : 'Fund an agreement to see PayPal authorizations and milestone releases reflected here in real time.'}
              </p>
              <Link
                href="/contracts"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition-colors"
              >
                <span>View Agreements</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-muted font-medium">
                    <th className="py-3 px-4">Transaction / Agreement</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">PayPal ID</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Receipt / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPayments.map((p) => {
                    const isRelease = p.type === 'CAPTURE_RELEASED'
                    const isHold = p.type === 'HOLD_AUTHORIZED'
                    const isVoid = p.type === 'HOLD_VOIDED'

                    return (
                      <tr key={p.id} className="hover:bg-surface-2/40 transition-colors">
                        {/* Transaction & Agreement Title */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-text">
                            <Link
                              href={`/contracts/${p.contract_id}`}
                              className="hover:text-brand transition-colors flex items-center gap-1"
                            >
                              <span>{p.contract_title}</span>
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </Link>
                          </div>
                          {p.milestone_title && (
                            <div className="text-[11px] text-muted mt-0.5">
                              Milestone: {p.milestone_title}
                            </div>
                          )}
                        </td>

                        {/* Type Chip */}
                        <td className="py-3 px-4">
                          {isHold && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-medium">
                              <Lock className="w-3 h-3" />
                              <span>Hold Authorized</span>
                            </span>
                          )}
                          {isRelease && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Capture Released</span>
                            </span>
                          )}
                          {isVoid && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 text-[11px] font-medium">
                              <Clock className="w-3 h-3" />
                              <span>Hold Voided</span>
                            </span>
                          )}
                        </td>

                        {/* PayPal Reference ID with Copy */}
                        <td className="py-3 px-4">
                          {p.paypal_id ? (
                            <button
                              onClick={() => handleCopy(p.paypal_id!, p.id)}
                              className="inline-flex items-center gap-1 font-mono text-[11px] text-muted hover:text-text transition-colors bg-surface-2 px-2 py-0.5 rounded border border-border"
                              title="Click to copy PayPal reference ID"
                            >
                              <span>{p.paypal_id}</span>
                              {copiedId === p.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-60" />
                              )}
                            </button>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 text-muted whitespace-nowrap">
                          {new Date(p.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4 text-right font-semibold">
                          <span className={isRelease ? 'text-emerald-400' : 'text-text'}>
                            {formatUsd(p.amount_minor)}
                          </span>
                        </td>

                        {/* Action / Receipt */}
                        <td className="py-3 px-4 text-right">
                          {p.receipt_url ? (
                            <Link
                              href={p.receipt_url}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface border border-border text-brand text-[11px] font-medium transition-colors"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Receipt</span>
                            </Link>
                          ) : (
                            <Link
                              href={`/contracts/${p.contract_id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-muted hover:text-text text-[11px] font-medium transition-colors"
                            >
                              <span>View</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
