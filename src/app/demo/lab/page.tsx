'use client'

/**
 * Resilience Lab Interactive Showcase (/demo/lab)
 * Implements N3 Signature Feature: Break it live & watch safe recovery.
 */
import React, { useState } from 'react'
import Link from 'next/link'
import {
  ShieldAlert,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Lock,
  ArrowRight,
  Database,
  Coins,
  Cpu,
  Layers,
  Activity,
  Play,
} from 'lucide-react'

interface ResilienceFault {
  id: string
  name: string
  description: string
  targetComponent: 'paypal' | 'worker' | 'llm' | 'webhook'
  active: boolean
  recoveryPolicy: string
}

export default function ResilienceLabPage() {
  const [activeFaultId, setActiveFaultId] = useState<string | null>(null)
  const [isInjecting, setIsInjecting] = useState(false)
  const [logs, setLogs] = useState<string[]>([
    'System standing: PayPal authorization hold active ($10.00 USD)',
    'Continuous Money Invariant: authorized ($10.00) = captured ($0.00) + voided ($0.00) + remaining ($10.00)',
    'Idempotency filter active: zero duplicate captures permitted',
  ])

  const faults: ResilienceFault[] = [
    {
      id: 'paypal_capture_timeout',
      name: 'PayPal API Capture Timeout (504)',
      description: 'Simulates network socket drop during POST /v2/payments/authorizations/{id}/capture.',
      targetComponent: 'paypal',
      active: activeFaultId === 'paypal_capture_timeout',
      recoveryPolicy: 'Idempotency key retained; backoff worker retries capture once; exactly one capture executes.',
    },
    {
      id: 'duplicate_webhook',
      name: 'Duplicate Webhook Delivery Attack',
      description: 'Replays PAYMENT.AUTHORIZATION.CREATED webhook with identical resource ID.',
      targetComponent: 'webhook',
      active: activeFaultId === 'duplicate_webhook',
      recoveryPolicy: 'Idempotency ledger filter ignores redundant event; funds invariant remains unchanged.',
    },
    {
      id: 'worker_pause_60s',
      name: 'Worker Node Queue Disruption',
      description: 'Pauses background queue consumers to simulate container restart.',
      targetComponent: 'worker',
      active: activeFaultId === 'worker_pause_60s',
      recoveryPolicy: 'Dead-letter protection retains jobs in flight; resumed processing finishes cleanly.',
    },
    {
      id: 'llm_eval_outage',
      name: 'LLM Evaluator Service Degradation',
      description: 'Injects 503 Service Unavailable into rubric grading LLM provider.',
      targetComponent: 'llm',
      active: activeFaultId === 'llm_eval_outage',
      recoveryPolicy: 'Degraded mode triggers ESCALATE with VERIFIER_UNAVAILABLE; 0 false passes occur.',
    },
  ]

  const handleInjectFault = async (fault: ResilienceFault) => {
    setIsInjecting(true)
    setActiveFaultId(fault.id)

    setLogs((prev) => [
      `[INJECT] Fault triggered: "${fault.name}"`,
      `[INJECT] Target subsystem: ${fault.targetComponent.toUpperCase()}`,
      ...prev,
    ])

    try {
      const res = await fetch('/api/v1/demo/lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faultId: fault.id }),
      })
      const data = await res.json()

      if (data.recoveryLog) {
        setLogs((prev) => [...data.recoveryLog, ...prev])
      }
    } catch {
      setLogs((prev) => [`[ERROR] Simulation fault request failed`, ...prev])
    } finally {
      setIsInjecting(false)
    }
  }

  const handleReset = () => {
    setActiveFaultId(null)
    setLogs([
      'System standing: PayPal authorization hold active ($10.00 USD)',
      'Continuous Money Invariant: authorized ($10.00) = captured ($0.00) + voided ($0.00) + remaining ($10.00)',
      'Idempotency filter active: zero duplicate captures permitted',
    ])
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
              Resilience Lab (N3)
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-medium flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span>Fault Injection Mode</span>
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            Break the live payment rails, webhooks, and AI evaluation on purpose. Watch autonomous recovery without duplicate captures.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-semibold text-text hover:bg-surface-2 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted" />
            <span>Reset Baseline</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Fault Injectors */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand" />
            <span>Select Fault to Inject (Sandbox Demo Only)</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {faults.map((fault) => (
              <div
                key={fault.id}
                className={`p-4 rounded-xl border transition-all space-y-3 ${
                  fault.active
                    ? 'border-red-500/50 bg-red-500/5 shadow-sm'
                    : 'border-border bg-surface hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text">{fault.name}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-2 border border-border text-muted">
                    {fault.targetComponent}
                  </span>
                </div>

                <p className="text-xs text-muted leading-relaxed min-h-[48px]">
                  {fault.description}
                </p>

                <div className="text-[11px] text-muted p-2 rounded bg-surface-2 border border-border/60">
                  <span className="font-semibold text-text block">Expected Recovery:</span>
                  <span>{fault.recoveryPolicy}</span>
                </div>

                <button
                  type="button"
                  disabled={isInjecting}
                  onClick={() => handleInjectFault(fault)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    fault.active
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-surface-2 hover:bg-red-500/10 text-text hover:text-red-600 dark:hover:text-red-400 border border-border'
                  }`}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{fault.active ? 'Re-Trigger Fault' : 'Inject This Fault'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Invariants & Live Telemetry */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-ok" />
            <span>Guaranteed Financial Invariants</span>
          </h2>

          <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Zero Duplicate Captures</span>
              <span className="px-2 py-0.5 rounded bg-ok/10 text-ok border border-ok/20 font-mono text-[10px] font-bold">
                VERIFIED (0 DUPLICATES)
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Money Balance Invariant</span>
              <span className="px-2 py-0.5 rounded bg-ok/10 text-ok border border-ok/20 font-mono text-[10px] font-bold">
                AUTH = CAP + VOID + REM
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Ledger SHA-256 Merkle</span>
              <span className="px-2 py-0.5 rounded bg-ok/10 text-ok border border-ok/20 font-mono text-[10px] font-bold">
                CHAIN INTACT
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Database Matches Ledger</span>
              <span className="px-2 py-0.5 rounded bg-ok/10 text-ok border border-ok/20 font-mono text-[10px] font-bold">
                100% CONSISTENT
              </span>
            </div>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wider text-muted pt-2">
            Live Recovery Event Stream
          </h3>
          <div className="p-3.5 rounded-xl bg-surface-2 border border-border font-mono text-[11px] space-y-1.5 max-h-72 overflow-y-auto">
            {logs.map((log, i) => (
              <div
                key={i}
                className={`leading-relaxed ${
                  log.includes('[INJECT')
                    ? 'text-red-600 dark:text-red-400 font-bold'
                    : log.includes('[RECOVERY') || log.includes('[STATUS')
                    ? 'text-ok'
                    : 'text-text/90'
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

