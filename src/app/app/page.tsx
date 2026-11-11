'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { ScrollReveal } from '@/components/common/ScrollReveal'
import { Money } from '@/components/common/Money'
import { StatusChip } from '@/components/contract/StatusChip'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { useCurrentUser, useContracts } from '@/lib/query'
import { formatUsd } from '@/lib/format'
import {
  ShieldCheck,
  ArrowRight,
  Plus,
  Inbox,
  AlertTriangle,
  Lock,
  Layers,
  CheckCircle2,
  Users,
  FileCode,
  ListChecks,
  DollarSign,
  TrendingUp,
  Clock,
  Briefcase,
  User,
} from 'lucide-react'

export default function DashboardPage() {
  const { data: user, isLoading: isLoadingUser } = useCurrentUser()
  const { data: contracts, isLoading: isLoadingContracts } = useContracts()

  const [paymentsSummary, setPaymentsSummary] = useState<any>(null)
  const [inboxItems, setInboxItems] = useState<any[]>([])
  const [isLoadingExtras, setIsLoadingExtras] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [sumRes, inRes] = await Promise.all([
          fetch('/api/v1/payments/summary').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/v1/inbox').then((r) => (r.ok ? r.json() : { items: [] })),
        ])
        setPaymentsSummary(sumRes)
        setInboxItems(inRes?.items || [])
      } catch (e) {
        console.error('Failed to load dashboard extras', e)
      } finally {
        setIsLoadingExtras(false)
      }
    }
    loadDashboardData()
  }, [])

  if (isLoadingUser || isLoadingContracts) {
    return (
      <PageShell title="Dashboard">
        <LoadingBlock message="Loading your workspace dashboard and hold status…" />
      </PageShell>
    )
  }

  const activeContracts = (contracts || []).filter((c) =>
    ['ACCEPTED', 'FUNDED', 'IN_PROGRESS'].includes(c.status)
  )

  const heldMinor = paymentsSummary?.held_minor ?? 0
  const releasedMinor = paymentsSummary?.released_minor_month ?? 0
  const atRiskMinor = paymentsSummary?.at_risk_minor ?? 0

  return (
    <PageShell
      title={`Welcome, ${user?.display_name || 'Partner'}`}
      subtitle={`Organization: ${user?.org_role ? `${user.org_role.toUpperCase()} • ` : ''}Real-time milestone verifications and PayPal authorization holds.`}
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/inbox"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-border text-xs font-semibold text-text hover:bg-surface-2 transition-colors relative shadow-sm"
          >
            <Inbox className="w-3.5 h-3.5 text-muted" />
            <span>Inbox</span>
            {inboxItems.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-brand text-white text-[10px] font-bold">
                {inboxItems.length}
              </span>
            )}
          </Link>
          <Link
            href="/studio"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-md shadow-brand/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Agreement</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Section A: Needs Your Attention Banner */}
        {inboxItems.length > 0 ? (
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">
                  {inboxItems.length} Action Item{inboxItems.length > 1 ? 's' : ''} Require Attention
                </h3>
                <p className="text-xs text-muted">
                  {inboxItems[0]?.title || 'Pending deliverables, funding requests, or milestone reviews await your action.'}
                </p>
              </div>
            </div>
            <Link
              href="/inbox"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-xs hover:bg-amber-400 transition-colors shrink-0 shadow-sm"
            >
              <span>Review in Inbox</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-surface border border-border/80 flex items-center justify-between text-xs text-muted">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-text font-medium">All caught up!</span>
              <span>No blocking verification escalations or funding requests.</span>
            </div>
            <Link href="/contracts" className="text-brand hover:underline font-medium">
              View all contracts →
            </Link>
          </div>
        )}

        {/* Section B: Money at a Glance (3 Stat Tiles with Clean Surfaces) */}
        <ScrollReveal animation="fade-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Tile 1: Open Holds */}
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-3 relative overflow-hidden group hover:border-brand/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Held on PayPal</span>
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-500 dark:text-sky-400 group-hover:scale-105 transition-transform">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-black text-text tracking-tight font-mono">
                  {formatUsd(heldMinor)}
                </div>
                <p className="text-[11px] text-muted">
                  Active 29-day authorization holds securing digital work.
                </p>
              </div>
            </div>

            {/* Tile 2: Released This Month */}
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-3 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Released on Proof</span>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-black text-emerald-500 dark:text-emerald-400 tracking-tight font-mono">
                  {formatUsd(releasedMinor)}
                </div>
                <p className="text-[11px] text-muted">
                  Funds captured and settled after passing verification.
                </p>
              </div>
            </div>

            {/* Tile 3: Funds at Risk */}
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-3 relative overflow-hidden group hover:border-amber-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Attention &amp; Risk</span>
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-black text-text tracking-tight font-mono">
                  {formatUsd(atRiskMinor)}
                </div>
                <p className="text-[11px] text-muted">
                  Milestones in escalation review or approaching auto-release.
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Section C: Active Contracts Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-lg font-bold text-text">Active Agreements</h2>
              <p className="text-xs text-muted">Contracts currently funded or undergoing deliverable verification.</p>
            </div>
            <Link
              href="/contracts"
              className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
            >
              <span>See all contracts ({contracts?.length || 0})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {activeContracts.length === 0 ? (
            <div className="p-10 rounded-2xl border border-dashed border-border bg-surface/50 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border text-muted mx-auto flex items-center justify-center">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-text">No active funded contracts yet</h3>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Create a contract using plain English or pick from our verified industry templates to get started.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/studio"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold shadow-sm"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Create with AI Compiler</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="border border-border/80 rounded-2xl overflow-hidden glass-card shadow-lg">
              <div className="divide-y divide-border/60">
                {activeContracts.slice(0, 5).map((contract) => (
                  <Link
                    key={contract.id}
                    href={`/contracts/${contract.id}`}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-2/70 transition-all block group"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text text-sm group-hover:text-brand transition-colors">
                          {contract.title}
                        </span>
                        <StatusChip status={contract.status} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span>ID: <code className="font-mono text-text bg-surface-2 px-1.5 py-0.5 rounded border border-border/50">{contract.id.slice(0, 8)}</code></span>
                        <span>•</span>
                        <span>{contract.milestones?.length || 0} Milestones</span>
                        {contract.authorization_id && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400 font-mono text-[11px] font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              Hold Authorized
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:text-right shrink-0">
                      <div>
                        <div className="text-[11px] text-muted uppercase font-bold tracking-wider">Agreement Total</div>
                        <div className="text-sm font-bold font-mono text-text">
                          {formatUsd(contract.total_minor)}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border/60 flex items-center justify-center text-muted group-hover:text-brand group-hover:border-brand/40 group-hover:translate-x-0.5 transition-all">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section D: Getting Started Checklist */}
        <ScrollReveal animation="fade-up" delayMs={100}>
          <div className="p-6 rounded-2xl glass-card border border-border/80 space-y-5 shadow-lg">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-surface-2 border border-border flex items-center justify-center text-text">
                  <ListChecks className="w-3.5 h-3.5" />
                </div>
                <span>Getting Started Checklist</span>
              </h3>
              <p className="text-xs text-muted">Complete these steps to experience the pay-on-acceptance protocol.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              <Link
                href="/studio"
                className="p-4 rounded-xl bg-surface-2/70 border border-border/80 hover:border-brand/50 hover:bg-surface-2 transition-all space-y-2 block group shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400">Step 1</span>
                  <CheckCircle2 className={`w-4 h-4 ${contracts && contracts.length > 0 ? 'text-emerald-400' : 'text-muted/40'}`} />
                </div>
                <div className="font-bold text-xs text-text group-hover:text-brand transition-colors">Create Agreement</div>
                <p className="text-[11px] text-muted leading-relaxed">Compile natural language into formal milestones &amp; criteria.</p>
              </Link>

              <Link
                href="/contracts"
                className="p-4 rounded-xl bg-surface-2/70 border border-border/80 hover:border-brand/50 hover:bg-surface-2 transition-all space-y-2 block group shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400">Step 2</span>
                  <Users className="w-4 h-4 text-muted/40" />
                </div>
                <div className="font-bold text-xs text-text group-hover:text-brand transition-colors">Invite Counterparty</div>
                <p className="text-[11px] text-muted leading-relaxed">Share a 14-day token link for the seller to lock the agreement hash.</p>
              </Link>

              <Link
                href="/contracts"
                className="p-4 rounded-xl bg-surface-2/70 border border-border/80 hover:border-brand/50 hover:bg-surface-2 transition-all space-y-2 block group shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400">Step 3</span>
                  <Lock className="w-4 h-4 text-muted/40" />
                </div>
                <div className="font-bold text-xs text-text group-hover:text-brand transition-colors">Authorize Hold</div>
                <p className="text-[11px] text-muted leading-relaxed">Approve the 29-day authorization hold on PayPal rails.</p>
              </Link>

              <Link
                href="/demo"
                className="p-4 rounded-xl bg-surface-2/70 border border-border/80 hover:border-brand/50 hover:bg-surface-2 transition-all space-y-2 block group shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400">Step 4</span>
                  <ShieldCheck className="w-4 h-4 text-muted/40" />
                </div>
                <div className="font-bold text-xs text-text group-hover:text-brand transition-colors">Verify &amp; Release</div>
                <p className="text-[11px] text-muted leading-relaxed">Submit work to trigger automated evaluation and partial capture.</p>
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </PageShell>
  )
}
