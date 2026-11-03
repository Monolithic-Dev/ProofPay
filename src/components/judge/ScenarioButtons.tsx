'use client'

/**
 * ScenarioButtons Component — one-click scenario triggers for Hackathon Judges.
 * Implements phase-6-frontend.md §6.4, phase-7 §7.4 & ux-flows.md §4 (S0).
 */
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Sparkles, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { useApiClient } from '@/lib/query'

export interface ScenarioDef {
  key: string
  title: string
  description: string
  duration: string
  isChaos?: boolean
}

export const SCENARIOS: ScenarioDef[] = [
  {
    key: 'happy_path',
    title: 'Happy Path',
    description: 'Buyer agent proposes, worker agent accepts, human authorizes PayPal hold once, both milestones deliver and release autonomously.',
    duration: '~45s',
  },
  {
    key: 'reject_then_pass',
    title: 'Self-Correction Loop',
    description: 'Worker delivers flawed schema (22 rows, malformed email); verification engine rejects with feedback; worker repairs and passes.',
    duration: '~60s',
  },
  {
    key: 'injection_attack',
    title: 'Adversarial Grader Defense',
    description: 'Worker injects an adversarial prompt injection into the summary; ProofPay quarantines the payload and preserves escrow.',
    duration: '~40s',
  },
  {
    key: 'capture_declined',
    title: 'Payment Gateway Resilience',
    description: 'Simulates a transient INSTRUMENT_DECLINED gateway error; ProofPay retains escrow hold and safely recovers upon retry.',
    duration: '~50s',
    isChaos: true,
  },
  {
    key: 'silent_buyer_autorelease',
    title: 'Silent Buyer Protection',
    description: 'Human review criterion triggers escalation; buyer remains unresponsive; protocol auto-releases escrow to protect worker compensation.',
    duration: '~60s',
  },
]

export function ScenarioButtons({ className = '' }: { className?: string }) {
  const router = useRouter()
  const api = useApiClient()
  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [chaosEnabled, setChaosEnabled] = useState(false)

  useEffect(() => {
    let mounted = true
    api.getHealth()
      .then((res) => {
        if (mounted && res?.features?.chaos) {
          setChaosEnabled(true)
        }
      })
      .catch(() => {
        // Fallback: keep chaos disabled if health check fails
      })
    return () => {
      mounted = false
    }
  }, [api])

  const handleRun = async (scenarioKey: string) => {
    setRunningKey(scenarioKey)
    setErrorMessage(null)

    try {
      const res = await api.runScenario(scenarioKey)
      const targetRunId = res?.run_id || res?.id
      if (targetRunId) {
        router.push(`/agent-console/${targetRunId}`)
      } else {
        throw new Error('No run ID returned by scenario starter')
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to start scenario'
      if (err.status === 409) {
        setErrorMessage('A scenario run is already active. Please wait for it to complete or open the existing run.')
      } else {
        setErrorMessage(msg)
      }
      setRunningKey(null)
    }
  }

  // Filter out chaos scenario if chaos feature is disabled on the server
  const visibleScenarios = SCENARIOS.filter((s) => !s.isChaos || chaosEnabled)

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-semibold text-text">Autonomous Agent Scenarios</h3>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Real multi-agent transactions on PayPal sandbox with human-in-the-loop approval.
          </p>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-2 border border-border text-muted">
          Judge Mode
        </span>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Unable to start scenario:</span> {errorMessage}
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visibleScenarios.map((s) => {
          const isLoading = runningKey === s.key

          return (
            <div
              key={s.key}
              className="p-4 rounded-xl bg-surface border border-border shadow-sm hover:border-brand/40 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-text">{s.title}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted font-mono">
                    <Clock className="w-3 h-3" />
                    {s.duration}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">{s.description}</p>
              </div>

              <button
                type="button"
                disabled={Boolean(runningKey)}
                onClick={() => handleRun(s.key)}
                className={`w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all focus:ring-2 focus:ring-brand focus:outline-none ${
                  isLoading
                    ? 'bg-brand/20 text-brand border border-brand/30 cursor-wait'
                    : runningKey
                    ? 'bg-surface-2 text-muted border border-border cursor-not-allowed opacity-60'
                    : 'bg-surface-2 border border-border text-text hover:bg-brand hover:text-white hover:border-transparent'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Initializing agents...
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    Run Scenario
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
