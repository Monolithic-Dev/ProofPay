'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { MonoText } from '@/components/common/MonoText'
import {
  ShieldCheck,
  Server,
  Database,
  Cpu,
  CreditCard,
  Layers,
  Search,
  ExternalLink,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  Building,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { formatUsd } from '@/lib/format'

export default function AdminConsolePage() {
  const [searchQuery, setSearchQuery] = useState('')

  const { data: contractsData, isLoading, error } = useQuery({
    queryKey: ['admin-contracts'],
    queryFn: async () => {
      const res = await fetch('/api/v1/contracts')
      if (!res.ok) throw new Error('Failed to load contracts for admin inspection')
      return res.json()
    },
  })

  const contracts = contractsData?.contracts || []

  // Calculate platform aggregates
  const totalVolumeMinor = contracts.reduce((acc: number, c: any) => acc + (c.total_minor || 0), 0)
  const activeContractsCount = contracts.filter((c: any) => ['ACCEPTED', 'FUNDED', 'IN_PROGRESS'].includes(c.status)).length
  const completedContractsCount = contracts.filter((c: any) => c.status === 'COMPLETED').length

  const filteredContracts = contracts.filter((c: any) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.status.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <PageShell
      title="Staff Back-Office Console"
      subtitle="Operational oversight, system health diagnostics, and contract ledger inspection"
    >
      <div className="space-y-8 max-w-6xl pb-16">
        {/* System Health Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-2">
            <div className="flex items-center justify-between text-muted text-xs">
              <span className="font-semibold uppercase tracking-wider">Database Engine</span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-base font-bold text-text">PostgreSQL 16</span>
            </div>
            <div className="text-[11px] text-muted">Drizzle ORM • Port 5435</div>
          </div>

          <div className="card p-5 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-2">
            <div className="flex items-center justify-between text-muted text-xs">
              <span className="font-semibold uppercase tracking-wider">AI LPU Engine</span>
              <Cpu className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <span className="text-base font-bold text-text">Groq LPU Active</span>
            </div>
            <div className="text-[11px] text-muted">Qwen / Claude Consensus • ~900ms</div>
          </div>

          <div className="card p-5 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-2">
            <div className="flex items-center justify-between text-muted text-xs">
              <span className="font-semibold uppercase tracking-wider">PayPal Gateway</span>
              <CreditCard className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <span className="text-base font-bold text-text">Sandbox Gateway</span>
            </div>
            <div className="text-[11px] text-muted">Authorization Hold Rails</div>
          </div>

          <div className="card p-5 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-2">
            <div className="flex items-center justify-between text-muted text-xs">
              <span className="font-semibold uppercase tracking-wider">Audit Ledger</span>
              <ShieldCheck className="w-4 h-4 text-brand" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand" />
              <span className="text-base font-bold text-text">Append-Only SHA-256</span>
            </div>
            <div className="text-[11px] text-muted">Cryptographic Chained Log</div>
          </div>
        </div>

        {/* Aggregate KPI Banner */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <div className="text-xs text-muted font-medium">Total Agreement Volume</div>
            <div className="text-2xl font-black text-text mt-1">{formatUsd(totalVolumeMinor)}</div>
          </div>
          <div>
            <div className="text-xs text-muted font-medium">Total Contracts</div>
            <div className="text-2xl font-black text-text mt-1">{contracts.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted font-medium">Active In-Progress</div>
            <div className="text-2xl font-black text-brand mt-1">{activeContractsCount}</div>
          </div>
          <div>
            <div className="text-xs text-muted font-medium">Settled &amp; Completed</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{completedContractsCount}</div>
          </div>
        </div>

        {/* Global Contract Inspector Table */}
        <div className="card border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm overflow-hidden">
          <div className="p-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-text">Global Contract Inspector</h3>
              <p className="text-xs text-muted">Read-only platform inspection for dispute mediation and support</p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by ID, title, status…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-surface-subtle border border-border rounded-xl text-xs text-text placeholder:text-muted/60 focus:outline-none focus:border-brand w-full sm:w-64"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-8">
              <LoadingBlock message="Loading system contracts for inspection…" />
            </div>
          ) : error ? (
            <div className="p-8">
              <ErrorState title="Failed to load admin data" message={(error as any)?.message} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-surface-subtle/50 text-muted font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Title &amp; ID</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Volume</th>
                    <th className="py-3 px-4">PayPal Hold ID</th>
                    <th className="py-3 px-4 text-right">Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredContracts.map((c: any) => (
                    <tr key={c.id} className="hover:bg-surface/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-text text-sm">{c.title}</div>
                        <div className="text-[11px] text-muted font-mono">{c.id}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-surface border border-border capitalize">
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-text">
                        {formatUsd(c.total_minor)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-muted">
                        {c.paypal_order_id || c.authorization_id || 'Not deposited'}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <Link
                          href={`/contracts/${c.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border text-muted hover:text-text hover:border-brand/40 transition-colors"
                        >
                          <span>Timeline</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        <Link
                          href={`/contracts/${c.id}/ledger`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors font-medium"
                        >
                          <span>Ledger</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
