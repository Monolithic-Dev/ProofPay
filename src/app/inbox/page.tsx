'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import {
  Inbox,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertTriangle,
  FileText,
  DollarSign,
  ShieldCheck,
  Send,
} from 'lucide-react'
import { formatUsd } from '@/lib/format'
import { useContracts, useCurrentUser } from '@/lib/query'

export default function InboxPage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'escalation'>('all')

  const { data: contracts, isLoading, error } = useContracts()
  const { data: user } = useCurrentUser()

  const safeContracts = Array.isArray(contracts) ? contracts : []

  // Derive actionable items from contracts
  const actionItems: any[] = []

  safeContracts.forEach((c: any) => {
    if (c.status === 'PROPOSED') {
      actionItems.push({
        id: `prop-${c.id}`,
        contractId: c.id,
        title: `Contract proposed: ${c.title}`,
        type: 'acceptance',
        icon: FileText,
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        badge: 'Review Agreement',
        urgency: 'Action needed to start work',
        amount: c.total_minor,
      })
    } else if (c.status === 'ACCEPTED') {
      actionItems.push({
        id: `fund-${c.id}`,
        contractId: c.id,
        title: `Funding required: ${c.title}`,
        type: 'pending',
        icon: DollarSign,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        badge: 'Authorize Hold',
        urgency: 'Lock funds via PayPal to proceed',
        amount: c.total_minor,
      })
    } else if (c.status === 'ACTIVE' || c.status === 'FUNDED') {
      actionItems.push({
        id: `sub-${c.id}`,
        contractId: c.id,
        title: `Milestone delivery active: ${c.title}`,
        type: 'pending',
        icon: Send,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        badge: 'In Progress',
        urgency: 'Deliverables pending submission & verification',
        amount: c.total_minor,
      })
    }
  })

  const filteredItems = actionItems.filter((item) => {
    if (filter === 'pending') return item.type === 'pending'
    if (filter === 'escalation') return item.type === 'escalation'
    return true
  })

  return (
    <PageShell
      title="Action Inbox"
      subtitle="Unified feed of agreements requiring decisions, funding, or submission reviews"
    >
      <div className="space-y-6 max-w-4xl">
        {/* Filters */}
        <div className="flex items-center gap-2">
          {(['all', 'pending', 'escalation'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                filter === tab
                  ? 'bg-brand text-white shadow-md shadow-brand/20'
                  : 'bg-surface border border-border text-muted hover:text-text'
              }`}
            >
              {tab === 'all' ? 'All Items' : tab}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="p-8">
            <LoadingBlock message="Loading inbox items..." />
          </div>
        ) : error ? (
          <div className="card p-12 border border-border/80 rounded-2xl bg-surface/30 backdrop-blur-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border text-muted mx-auto flex items-center justify-center">
              <Inbox className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-text">Sign In Required for Inbox</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Sign in to your account or launch a demo workspace to view your real-time agreements, escalations, and approvals.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href="/auth/login"
                className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover shadow-sm"
              >
                Sign In
              </Link>
              <Link
                href="/demo"
                className="px-4 py-2 rounded-xl bg-surface-2 text-text text-xs font-semibold hover:bg-surface-3 border border-border"
              >
                Explore Sandbox Demos
              </Link>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="card p-12 border border-border/80 rounded-2xl bg-surface/30 backdrop-blur-sm text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-text">You&apos;re All Caught Up</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              No pending milestone escalations, funding approvals, or unreviewed contract proposals requiring your immediate attention.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.id}
                  className="card p-5 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm hover:border-brand/40 transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl border ${item.color} shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text">{item.title}</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface border border-border text-muted">
                          {formatUsd(item.amount)}
                        </span>
                      </div>
                      <div className="text-xs text-muted flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{item.urgency}</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/contracts/${item.contractId}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand/10 hover:bg-brand/20 text-brand text-xs font-semibold border border-brand/20 transition-all shrink-0"
                  >
                    <span>{item.badge}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PageShell>
  )
}
