'use client'

/**
 * ScenarioButtons Component — one-click scenario triggers for Hackathon Judges.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S0).
 */
import React, { useState } from 'react'
import { Play, Sparkles, Clock } from 'lucide-react'

export interface ScenarioDef {
  key: string
  title: string
  description: string
  duration: string
}

export const SCENARIOS: ScenarioDef[] = [
  {
    key: 'happy_path',
    title: '1. Happy Path',
    description: 'Buyer funds, seller delivers m1 & m2, verifier passes, both released to PayPal.',
    duration: '~45s',
  },
  {
    key: 'reject_then_pass',
    title: '2. Reject → Fix → Pass',
    description: 'm1 fails deterministic schema checks; seller receives feedback, fixes, and passes.',
    duration: '~60s',
  },
  {
    key: 'injection_attack',
    title: '3. Injection Neutralized',
    description: 'Adversarial prompt injection inside deliverable is flagged and rejected by policy.',
    duration: '~40s',
  },
  {
    key: 'capture_declined',
    title: '4. Capture Retry (Chaos)',
    description: 'Simulates transient gateway decline in chaos mode; safely retried without double charge.',
    duration: '~50s',
  },
  {
    key: 'silent_buyer_autorelease',
    title: '5. Silent Buyer Auto-Release',
    description: 'Buyer ignores escalation; timer fires and milestone auto-releases automatically.',
    duration: '~60s',
  },
]

export function ScenarioButtons({ className = '' }: { className?: string }) {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-semibold text-text">Interactive Demo Scenarios</h3>
        </div>
        <span className="text-xs text-muted">Ready for Phase 7 autonomous agents</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SCENARIOS.map((s) => (
          <div
            key={s.key}
            className="p-4 rounded-xl bg-surface border border-border shadow-sm hover:border-brand/40 transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-1">
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
              onClick={() => setSelectedScenario(s.key)}
              title="Runs autonomous agent scenario in Judge Mode (Phase 7)"
              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-surface-2 border border-border text-xs font-medium text-text hover:bg-brand hover:text-white hover:border-transparent transition-all focus:ring-2 focus:ring-brand focus:outline-none"
            >
              <Play className="w-3 h-3 fill-current" />
              Run Scenario
            </button>
          </div>
        ))}
      </div>

      {selectedScenario && (
        <div className="p-3 rounded-lg bg-brand/10 border border-brand/20 text-xs text-brand flex items-center justify-between">
          <span>
            Scenario <strong>{selectedScenario}</strong> selected. Phase 7 scenario runner will execute this live.
          </span>
          <button
            type="button"
            onClick={() => setSelectedScenario(null)}
            className="font-bold underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
