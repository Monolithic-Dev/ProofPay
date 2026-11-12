'use client'

/**
 * Express Sandbox Lane Page — /demo/express
 * Implements AIP-13 90-Second Express Evaluation Flow.
 *
 * Lets evaluators experience the entire ProofPay payment lifecycle:
 * Pre-authorized hold -> Worker submit -> Multi-Stage AI verify -> PayPal capture -> SHA-256 ledger
 * In < 90 seconds, without logging into a personal PayPal sandbox account.
 */
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Zap,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ExternalLink,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react'
import { useCurrentUser, useApiClient } from '@/lib/query'
import { useQueryClient } from '@tanstack/react-query'

interface ExpressPoolStatus {
  available_count: number
  in_use_count: number
  consumed_count: number
  pool_ready: boolean
  hold_duration_days: number
  min_capture_amount_usd: string
}

interface StepInfo {
  id: string
  title: string
  desc: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export default function ExpressSandboxPage() {
  const api = useApiClient()
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()

  const [poolStatus, setPoolStatus] = useState<ExpressPoolStatus | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [activeStep, setActiveStep] = useState<number>(0)
  const [contractId, setContractId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [events, setEvents] = useState<any[]>([])

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch pool status on mount + clear timers on unmount
  useEffect(() => {
    fetch('/api/v1/demo/express')
      .then((res) => res.json())
      .then((data) => setPoolStatus(data))
      .catch((err) => console.error('Failed to load express pool status:', err))

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const steps: StepInfo[] = [
    {
      id: 'step_claim',
      title: '1. Pre-Authorized Contract Claim',
      desc: 'Claim pre-funded PayPal authorization hold ($10.00 USD, 28-day validity).',
      status: activeStep === 0 && isRunning ? 'running' : activeStep > 0 ? 'completed' : 'pending',
    },
    {
      id: 'step_deliver',
      title: '2. Worker Agent Delivers Dataset',
      desc: 'SynthetixBot delivers 25 product catalog records with validated schema.',
      status: activeStep === 1 && isRunning ? 'running' : activeStep > 1 ? 'completed' : 'pending',
    },
    {
      id: 'step_verify',
      title: '3. Multi-Stage AI Verification',
      desc: 'Deterministic schema rules + LLM rubric reasoning citing verbatim deliverable quotes.',
      status: activeStep === 2 && isRunning ? 'running' : activeStep > 2 ? 'completed' : 'pending',
    },
    {
      id: 'step_capture',
      title: '4. Instant PayPal Capture',
      desc: 'ProofPay protocol triggers $10.00 capture against authorization hold directly to seller.',
      status: activeStep === 3 && isRunning ? 'running' : activeStep > 3 ? 'completed' : 'pending',
    },
    {
      id: 'step_ledger',
      title: '5. Cryptographic SHA-256 Ledger',
      desc: 'Event sealed in tamper-proof hash chain; offline Proof Pack (.zip) compiled.',
      status: activeStep >= 4 ? 'completed' : activeStep === 3 && isRunning ? 'running' : 'pending',
    },
  ]

  const handleStartExpressLane = async () => {
    try {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      setIsRunning(true)
      setErrorMsg(null)
      setActiveStep(0)
      setEvents([])

      // 1. Ensure logged in as buyer persona if not logged in
      if (!currentUser) {
        await api.demoLogin('buyer')
        await queryClient.invalidateQueries({ queryKey: ['me'] })
      }

      // 2. Call express run endpoint
      const res = await fetch('/api/v1/demo/express', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message || data.message || 'Failed to start express lane')
      }

      const runData = await res.json()

      // 3. Poll run events until completion
      pollIntervalRef.current = setInterval(async () => {
        try {
          const runRes: any = await api.getDemoRun(runData.run_id)
          const run = runRes?.run ?? runRes
          if (run?.events) {
            setEvents(run.events)
          }

          if (run?.contract_id) {
            setContractId(run.contract_id)
          }

          // Advance UI step based on events
          const eventCount = run?.events?.length || 0
          setActiveStep((prev) => {
            let next = prev
            if (eventCount >= 1) next = Math.max(next, 1)
            if (eventCount >= 2) next = Math.max(next, 2)
            if (eventCount >= 3) next = Math.max(next, 3)
            return next
          })

          if (run?.status === 'DONE') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            setActiveStep(4)
            setIsRunning(false)
          } else if (run?.status === 'FAILED') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            setIsRunning(false)
            setErrorMsg('Express evaluation encountered a failure during verification.')
          }
        } catch (pollErr) {
          console.warn('Polling error:', pollErr)
        }
      }, 1500)

      // Safeguard timeout (90 seconds)
      timeoutRef.current = setTimeout(() => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
        setIsRunning(false)
      }, 90000)
    } catch (err: any) {
      console.error('Express launch error:', err)
      setErrorMsg(err.message || 'Failed to launch express evaluation')
      setIsRunning(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Navigation & Header */}
      <div>
        <Link
          href="/demo"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-brand transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sandbox Playground</span>
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
                Express Sandbox Lane
              </h1>
              <span className="px-3 py-0.5 rounded-full text-xs font-mono bg-brand/10 text-brand border border-brand/20 font-semibold whitespace-nowrap">
                &le; 90 Seconds
              </span>
            </div>
            <p className="text-sm text-muted mt-1.5 max-w-2xl">
              One-click autonomous verification and PayPal settlement walkthrough. Evaluates the complete lifecycle using pre-authorized PayPal sandbox holds without requiring personal credentials.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/demo/mcp"
              className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              <span>MCP Simulator →</span>
            </Link>
            <Link
              href="/demo/tribunal"
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              <span>AI Tribunal →</span>
            </Link>
            <Link
              href="/demo/agent-wallet"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              <span>Agent Wallet →</span>
            </Link>
            <span className="text-xs text-muted whitespace-nowrap">Environment:</span>
            <span className="px-2.5 py-1 rounded-lg bg-surface border border-border text-xs font-mono font-medium text-text whitespace-nowrap">
              PayPal v2 Sandbox
            </span>
          </div>
        </div>
      </div>

      {/* Honest Framing Banner (AIP-13) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-brand/5 border border-brand/20 flex items-start gap-3.5">
        <ShieldCheck className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <strong className="font-semibold text-text block text-sm">
            Pre-Authorized Sandbox Pool for Instant Evaluation
          </strong>
          <p className="text-muted leading-relaxed">
            This express lane connects directly to a pre-authorized pool of PayPal sandbox authorizations ($10.00 USD spending cap). When launched, the autonomous worker agent delivers live data, the multi-stage verification engine checks it against formal criteria, and the PayPal capture executes against the sandbox ledger.
          </p>
        </div>
      </div>

      {/* Pool Status Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
          <span className="text-[11px] font-medium text-muted block">Pre-Authorized Pool</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
            <strong className="text-lg font-bold text-text">
              {poolStatus?.available_count ?? 8} Available
            </strong>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
          <span className="text-[11px] font-medium text-muted block">Spending Cap / Hold</span>
          <strong className="text-lg font-bold text-text">
            ${poolStatus?.min_capture_amount_usd ?? '10.00'} USD
          </strong>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
          <span className="text-[11px] font-medium text-muted block">Authorization Window</span>
          <strong className="text-lg font-bold text-text">
            {poolStatus?.hold_duration_days ?? 28} Days Valid
          </strong>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
          <span className="text-[11px] font-medium text-muted block">Evaluation Time</span>
          <strong className="text-lg font-bold text-brand">~20 Seconds</strong>
        </div>
      </div>

      {/* Execution Console */}
      <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-border shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text">Live Evaluation Pipeline</h2>
            <p className="text-xs text-muted mt-0.5">
              Press Start to claim a pre-authorized contract and execute autonomous verification.
            </p>
          </div>

          <button
            type="button"
            disabled={isRunning}
            onClick={handleStartExpressLane}
            className="px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Executing Pipeline…</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                <span>Start Express Evaluation (90s)</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-bad/10 border border-bad/30 text-xs text-bad flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Stepper Display */}
        <div className="space-y-3 pt-2">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className={`p-4 rounded-xl border transition-all flex items-start gap-4 ${
                step.status === 'completed'
                  ? 'bg-ok/5 border-ok/30'
                  : step.status === 'running'
                  ? 'bg-brand/5 border-brand shadow-sm ring-1 ring-brand/30'
                  : 'bg-surface-2/40 border-border opacity-70'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {step.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-ok" />
                ) : step.status === 'running' ? (
                  <Loader2 className="w-5 h-5 text-brand animate-spin" />
                ) : (
                  <span className="w-5 h-5 rounded-full border border-border text-muted text-[11px] font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-text">{step.title}</h3>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                      step.status === 'completed'
                        ? 'bg-ok/10 text-ok font-semibold'
                        : step.status === 'running'
                        ? 'bg-brand/10 text-brand font-semibold'
                        : 'text-muted'
                    }`}
                  >
                    {step.status}
                  </span>
                </div>
                <p className="text-xs text-muted">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Live Event Stream Logs */}
        {events.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text">Audit Event Stream</span>
              <span className="text-[11px] font-mono text-muted">{events.length} events emitted</span>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-2 border border-border font-mono text-[11px] space-y-1.5 max-h-48 overflow-y-auto">
              {events.map((ev, i) => (
                <div key={i} className="flex items-start gap-2 text-text">
                  <span className="text-muted flex-shrink-0">[{ev.actor || 'protocol'}]</span>
                  <span className={ev.kind === 'error' ? 'text-bad' : 'text-text'}>{ev.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Post-Run Inspection Action Bar */}
        {contractId && activeStep >= 3 && (
          <div className="p-5 rounded-xl bg-gradient-to-r from-ok/10 via-surface to-brand/10 border border-ok/30 space-y-3">
            <div className="flex items-center gap-2 text-ok">
              <CheckCircle2 className="w-4 h-4" />
              <strong className="text-xs uppercase tracking-wider font-bold">
                Express Settlement Completed Successfully
              </strong>
            </div>
            <p className="text-xs text-muted">
              Funds captured directly via PayPal Sandbox API. Explore the verified artifacts, LLM reasoning report, and cryptographic hash chain below:
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={`/contracts/${contractId}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-border text-xs font-semibold text-text hover:bg-surface-2 transition-colors shadow-sm"
              >
                <span>View Contract Workspace</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted" />
              </Link>

              <Link
                href={`/contracts/${contractId}/milestones/m1`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-border text-xs font-semibold text-text hover:bg-surface-2 transition-colors shadow-sm"
              >
                <span>Inspect AI Verification Report</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted" />
              </Link>

              <Link
                href={`/contracts/${contractId}/ledger`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:opacity-95 transition-opacity shadow-sm"
              >
                <span>Audit Cryptographic Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
