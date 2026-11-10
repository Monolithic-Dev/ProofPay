'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import {
  Activity,
  Database,
  CreditCard,
  Cpu,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'

interface HealthPayload {
  status: 'ok' | 'degraded' | 'down'
  db: string
  db_latency_ms: number
  worker_lag_seconds: number
  pending_jobs: number
  stuck_jobs: number
  llm_budget: {
    spent_usd: number
    limit_usd: number
    remaining_usd: number
    exhausted: boolean
  }
  llm?: {
    spent_usd: number
    limit_usd: number
    remaining_usd: number
    exhausted: boolean
    last_canary?: {
      at: string
      passed: number
      total: number
    } | null
  }
  paypal: {
    ok: boolean
    mode: string
  }
  worker: {
    last_heartbeat: string | null
  }
  features: {
    chaos: boolean
    demo: boolean
  }
  version: string
  timestamp: string
}

export default function SystemStatusPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [httpCode, setHttpCode] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/health', { cache: 'no-store' })
      setHttpCode(res.status)
      const data = (await res.json()) as HealthPayload
      setHealth(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach /api/v1/health')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  const statusBadge = () => {
    if (!health) return null
    if (health.status === 'ok') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-ok/10 text-ok border border-ok/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          ALL SUBSYSTEMS OPERATIONAL
        </span>
      )
    }
    if (health.status === 'degraded') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" />
          DEGRADED MODE ACTIVE
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-danger/10 text-danger border border-danger/30">
        <XCircle className="w-3.5 h-3.5" />
        SUBSYSTEM OUTAGE DETECTED
      </span>
    )
  }

  const budgetPct =
    health && health.llm_budget.limit_usd > 0
      ? Math.min(100, Math.round((health.llm_budget.spent_usd / health.llm_budget.limit_usd) * 100))
      : 0

  return (
    <PageShell
      title="Live System Status"
      subtitle="Real-time telemetry from PostgreSQL, PayPal Sandbox OAuth, background worker queue, and LLM safety budgets."
      backHref="/trust"
      backLabel="Back to Trust Center"
      actions={
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-border text-xs font-semibold text-text hover:bg-surface-2 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh Telemetry'}</span>
        </button>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top Summary Banner */}
        <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              {statusBadge()}
              {httpCode !== null && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-2 border border-border text-muted">
                  HTTP {httpCode}
                </span>
              )}
              {health?.version && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-2 border border-border text-muted">
                  commit: {health.version.slice(0, 10)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              Endpoint: <code className="font-mono text-text">GET /api/v1/health</code>
              {health?.timestamp && ` · Last checked: ${new Date(health.timestamp).toLocaleString()}`}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span
              className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] ${
                health?.features.demo
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                  : 'bg-surface-2 text-muted border-border'
              }`}
            >
              DEMO_MODE={String(Boolean(health?.features.demo))}
            </span>
            <span
              className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] ${
                health?.features.chaos
                  ? 'bg-danger/10 text-danger border-danger/30'
                  : 'bg-surface-2 text-muted border-border'
              }`}
            >
              CHAOS_MODE={String(Boolean(health?.features.chaos))}
            </span>
          </div>
        </div>

        {/* 4 Core Subsystems Grid */}
        {health && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* PostgreSQL */}
            <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text">
                  <Database className="w-4 h-4 text-brand" />
                  PostgreSQL Ledger DB
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    health.db === 'ok' ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger'
                  }`}
                >
                  {health.db}
                </span>
              </div>
              <p className="text-2xl font-extrabold font-mono text-text">
                {health.db_latency_ms} <span className="text-xs font-normal text-muted">ms</span>
              </p>
              <p className="text-[11px] text-muted">Roundtrip SELECT 1 latency</p>
            </div>

            {/* PayPal Sandbox */}
            <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text">
                  <CreditCard className="w-4 h-4 text-sky-400" />
                  PayPal REST v2 OAuth
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    health.paypal.ok ? 'bg-ok/10 text-ok' : 'bg-amber-500/10 text-amber-500'
                  }`}
                >
                  {health.paypal.ok ? 'connected' : 'offline'}
                </span>
              </div>
              <p className="text-2xl font-extrabold font-mono text-text uppercase">
                {health.paypal.mode}
              </p>
              <p className="text-[11px] text-muted">Authorization holds &amp; partial captures</p>
            </div>

            {/* Background Worker */}
            <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text">
                  <Clock className="w-4 h-4 text-purple-400" />
                  Worker &amp; Job Queue
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    health.stuck_jobs === 0 && health.worker_lag_seconds <= 120
                      ? 'bg-ok/10 text-ok'
                      : 'bg-amber-500/10 text-amber-500'
                  }`}
                >
                  {health.stuck_jobs > 0 ? 'stuck' : 'healthy'}
                </span>
              </div>
              <p className="text-2xl font-extrabold font-mono text-text">
                {health.pending_jobs}{' '}
                <span className="text-xs font-normal text-muted">
                  pending · {health.stuck_jobs} stuck
                </span>
              </p>
              <p className="text-[11px] text-muted">
                Heartbeat lag: {health.worker_lag_seconds}s
                {health.worker.last_heartbeat
                  ? ` (${new Date(health.worker.last_heartbeat).toLocaleTimeString()})`
                  : ' (no worker ping yet)'}
              </p>
            </div>

            {/* LLM Safety Budget */}
            <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  LLM Daily Budget Guard
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    !health.llm_budget.exhausted ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger'
                  }`}
                >
                  {health.llm_budget.exhausted ? 'exhausted' : 'active'}
                </span>
              </div>
              <p className="text-2xl font-extrabold font-mono text-text">
                ${health.llm_budget.spent_usd.toFixed(4)}
                <span className="text-xs font-normal text-muted">
                  {' '}
                  / ${health.llm_budget.limit_usd.toFixed(2)}
                </span>
              </p>
              <div className="w-full h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    budgetPct > 85 ? 'bg-danger' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Canary & Governance Footer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl border border-border bg-surface space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-text">
              <ShieldCheck className="w-4 h-4 text-brand" />
              <span>Verifier Canary Probe</span>
            </div>
            {health?.llm?.last_canary ? (
              <div className="text-xs text-muted space-y-1">
                <p>
                  Last canary run passed{' '}
                  <strong className="text-ok font-mono">
                    {health.llm.last_canary.passed} / {health.llm.last_canary.total}
                  </strong>{' '}
                  adversarial &amp; deterministic probes.
                </p>
                <p className="font-mono text-[11px]">
                  Timestamp: {new Date(health.llm.last_canary.at).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted">No canary probe recorded in current process yet.</p>
            )}
          </div>

          <div className="p-5 rounded-xl border border-border bg-surface space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-text">
                <Activity className="w-4 h-4 text-brand" />
                <span>Agent Discovery &amp; Machine Docs</span>
              </div>
              <p className="text-xs text-muted">
                Inspect machine-readable A2A capability cards and OpenAPI 3.1 contract definitions directly:
              </p>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/.well-known/agent.json"
                target="_blank"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <span>/.well-known/agent.json</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <Link
                href="/api/v1/openapi"
                target="_blank"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <span>/api/v1/openapi</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

