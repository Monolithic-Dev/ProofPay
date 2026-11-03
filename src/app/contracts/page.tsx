'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  FileText,
  Plus,
  Search,
  Filter,
  DollarSign,
  ShieldCheck,
  Clock,
  ArrowRight,
  User,
  Bot,
  ExternalLink,
  Lock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from 'lucide-react'
import { PageShell } from '@/components/common/PageShell'
import { StatusChip } from '@/components/contract/StatusChip'
import { MonoText } from '@/components/common/MonoText'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { useContracts, useCurrentUser } from '@/lib/query'
import { formatUsd } from '@/lib/format'

export default function ContractsPage() {
  const { data: contracts, isLoading, error } = useContracts()
  const { data: currentUser } = useCurrentUser()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'buyer' | 'seller'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredContracts = useMemo(() => {
    if (!contracts) return []
    return contracts.filter((c) => {
      // Search
      const matchesSearch =
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        c.buyer_id.toLowerCase().includes(search.toLowerCase()) ||
        (c.seller_id && c.seller_id.toLowerCase().includes(search.toLowerCase()))

      if (!matchesSearch) return false

      // Role filter
      if (roleFilter === 'buyer' && currentUser && c.buyer_id !== currentUser.id) {
        return false
      }
      if (roleFilter === 'seller' && currentUser && c.seller_id !== currentUser.id) {
        return false
      }

      // Status filter
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false
      }

      return true
    })
  }, [contracts, search, roleFilter, statusFilter, currentUser])

  // Metric aggregates
  const metrics = useMemo(() => {
    if (!contracts) return { totalMinor: 0, activeCount: 0, fundedCount: 0, completedCount: 0 }
    let totalMinor = 0
    let activeCount = 0
    let fundedCount = 0
    let completedCount = 0

    for (const c of contracts) {
      totalMinor += c.total_minor || 0
      if (['ACCEPTED', 'FUNDED', 'IN_PROGRESS'].includes(c.status)) {
        activeCount++
      }
      if (['FUNDED', 'IN_PROGRESS'].includes(c.status)) {
        fundedCount++
      }
      if (c.status === 'COMPLETED') {
        completedCount++
      }
    }
    return { totalMinor, activeCount, fundedCount, completedCount }
  }, [contracts])

  return (
    <PageShell
      title="Contracts & Agreements"
      subtitle="Manage your AI-negotiated contracts, track milestone verifications, and monitor PayPal authorization holds."
      actions={
        <Link
          href="/studio"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-95 transition-opacity shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Contract</span>
        </Link>
      }
    >
      <div className="space-y-8">
        {/* Role & User Context Banner */}
        {currentUser ? (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-surface border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center">
                {currentUser.is_agent ? (
                  <Bot className="w-5 h-5 text-brand" />
                ) : currentUser.role === 'buyer' ? (
                  <Briefcase className="w-5 h-5 text-blue-500" />
                ) : (
                  <User className="w-5 h-5 text-emerald-500" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-text">{currentUser.display_name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium capitalize">
                    {currentUser.role}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {currentUser.role === 'buyer'
                    ? 'Client perspective: You draft contracts, fund PayPal authorizations, and approve releases.'
                    : 'Provider perspective: You accept agreements, submit deliverables, and get paid upon proof.'}
                </p>
              </div>
            </div>

            <Link
              href="/auth/login"
              className="text-xs font-medium text-brand hover:underline px-3 py-1.5 rounded-lg border border-brand/20 bg-brand/5 hover:bg-brand/10 transition-colors"
            >
              Switch Role / Persona →
            </Link>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between">
            <p className="text-sm text-muted">
              You are currently browsing as a guest. Sign in to view and fund your private contracts.
            </p>
            <Link
              href="/auth/login"
              className="px-3.5 py-1.5 rounded-lg bg-brand text-white text-xs font-medium"
            >
              Sign In
            </Link>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-surface border border-border shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-medium">Total Agreement Volume</span>
              <DollarSign className="w-4 h-4 text-brand" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-text">
              {formatUsd(metrics.totalMinor)}
            </p>
            <p className="text-[11px] text-muted">Across all negotiated contracts</p>
          </div>

          <div className="p-5 rounded-xl bg-surface border border-border shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-medium">Active Agreements</span>
              <FileText className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-text">{metrics.activeCount}</p>
            <p className="text-[11px] text-muted">Accepted, funded, or in progress</p>
          </div>

          <div className="p-5 rounded-xl bg-surface border border-border shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-medium">PayPal Holds Locked</span>
              <Lock className="w-4 h-4 text-ok" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-text">{metrics.fundedCount}</p>
            <p className="text-[11px] text-muted">Secured via PayPal 29-day auth holds</p>
          </div>

          <div className="p-5 rounded-xl bg-surface border border-border shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-medium">Completed &amp; Settled</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-text">{metrics.completedCount}</p>
            <p className="text-[11px] text-muted">100% verified &amp; released</p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contracts by title, party, or ID..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {/* Role Filter Tabs */}
            <div className="inline-flex rounded-lg border border-border bg-surface p-1 text-xs">
              <button
                type="button"
                onClick={() => setRoleFilter('all')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  roleFilter === 'all'
                    ? 'bg-surface-2 text-text shadow-sm'
                    : 'text-muted hover:text-text'
                }`}
              >
                All Roles
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('buyer')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  roleFilter === 'buyer'
                    ? 'bg-surface-2 text-text shadow-sm'
                    : 'text-muted hover:text-text'
                }`}
              >
                As Buyer
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('seller')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  roleFilter === 'seller'
                    ? 'bg-surface-2 text-text shadow-sm'
                    : 'text-muted hover:text-text'
                }`}
              >
                As Seller
              </button>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter contracts by status"
              className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-text focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="all">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="FUNDED">Funded</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && <LoadingBlock message="Loading your contracts from database..." />}

        {/* Error or Guest State */}
        {error && !currentUser ? (
          <div className="p-8 rounded-2xl bg-surface border border-border text-center space-y-4 max-w-md mx-auto my-6 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-text">Sign In Required</h3>
              <p className="text-xs text-muted leading-relaxed">
                ProofPay contracts and authorization holds are protected by cryptographic role-based access. Sign in to view your organization&apos;s agreements.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                href="/auth/login"
                className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-sm transition-all"
              >
                Sign In to Workspace
              </Link>
              <Link
                href="/demo"
                className="px-4 py-2 rounded-xl bg-surface border border-border text-xs font-semibold text-text hover:bg-surface-2 transition-colors"
              >
                Explore Sandbox
              </Link>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl bg-bad/10 border border-bad/20 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <h3 className="text-sm font-semibold text-text">Failed to load contracts</h3>
            <p className="text-xs text-muted">{(error as any)?.message || 'Please try again later'}</p>
          </div>
        ) : null}

        {/* Empty State */}
        {!isLoading && !error && filteredContracts.length === 0 && (
          <div className="p-12 rounded-xl bg-surface border border-border text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center mx-auto text-muted">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-text">No contracts found</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                {search || roleFilter !== 'all' || statusFilter !== 'all'
                  ? 'No contracts matched your current filters. Try resetting the search or filters.'
                  : 'Start your first agreement by describing your project in natural language in Contract Studio.'}
              </p>
            </div>
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-xs font-medium hover:opacity-95 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              <span>Synthesize First Contract</span>
            </Link>
          </div>
        )}

        {/* Contracts Grid */}
        {!isLoading && !error && filteredContracts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredContracts.map((c) => {
              const milestones = c.milestones || []
              const releasedCount = milestones.filter((m) => m.status === 'RELEASED').length
              const progressPct =
                milestones.length > 0
                  ? Math.round((releasedCount / milestones.length) * 100)
                  : 0

              return (
                <div
                  key={c.id}
                  className="p-5 rounded-xl bg-surface border border-border hover:border-brand/40 transition-all shadow-sm flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/contracts/${c.id}`}
                          className="font-semibold text-base text-text hover:text-brand transition-colors line-clamp-1 group-hover:underline"
                        >
                          {c.title}
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <MonoText value={c.id} short length={8} className="text-[11px] text-muted" />
                          <span className="text-[11px] text-muted">•</span>
                          <span className="text-[11px] text-muted">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <StatusChip status={c.status} />
                    </div>

                    {/* Parties */}
                    <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-lg bg-surface-2 border border-border/60">
                      <div>
                        <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">
                          Buyer
                        </span>
                        <span className="text-text font-medium truncate block font-mono">
                          {c.buyer_id.slice(0, 8)}…
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">
                          Seller
                        </span>
                        <span className="text-text font-medium truncate block font-mono">
                          {c.seller_id ? `${c.seller_id.slice(0, 8)}…` : 'Unassigned'}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>
                          Milestones: {releasedCount} of {milestones.length} released
                        </span>
                        <span className="font-medium text-text">{progressPct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                        <div
                          className="h-full bg-brand rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-border flex items-center justify-between text-sm">
                    <div>
                      <span className="text-xs text-muted block">Total Value</span>
                      <span className="text-base font-bold text-text">
                        {formatUsd(c.total_minor)}
                      </span>
                    </div>

                    <Link
                      href={`/contracts/${c.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-surface-2 hover:bg-brand hover:text-white border border-border text-xs font-medium transition-all"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PageShell>
  )
}
