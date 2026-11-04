'use client'

import React, { useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Copy, Check, Terminal } from 'lucide-react'
import { useSystemHealth } from '@/lib/query'

export function WorkerStatusBanner() {
  const { data: health, isLoading } = useSystemHealth()
  const [copied, setCopied] = useState(false)

  if (isLoading || !health) {
    return null
  }

  const isWorkerOnline =
    Boolean(health.worker?.last_heartbeat) && health.worker_lag_seconds <= 60

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('npm run worker')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isWorkerOnline) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
        <div className="flex items-center gap-2 text-emerald-400 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>Background Job Worker: Active</span>
          <span className="text-muted text-[11px]">
            (heartbeat {health.worker_lag_seconds}s ago)
          </span>
        </div>
        <div className="text-[11px] text-muted">
          Queue: {health.pending_jobs} pending job{health.pending_jobs === 1 ? '' : 's'}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-amber-300">
              Background Job Worker is Offline
            </h4>
            <p className="text-muted text-[11px] leading-relaxed">
              Autonomous scenarios and deliverable verifications require the background worker to execute asynchronous steps.
              Start the worker in a separate terminal to run interactive scenarios.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyCommand}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:bg-surface-2 text-text font-mono text-[11px] transition-colors flex-shrink-0"
        >
          <Terminal className="w-3.5 h-3.5 text-muted" />
          <span>npm run worker</span>
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-muted" />
          )}
        </button>
      </div>
    </div>
  )
}

