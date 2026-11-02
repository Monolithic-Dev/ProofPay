'use client'

/**
 * RecentEvents Component — right rail audit feed with plain-language explanations.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4.
 */
import React, { useState } from 'react'
import Link from 'next/link'
import { HelpCircle, ChevronRight, Activity } from 'lucide-react'
import { explainLedgerEvent } from '@/lib/explain'
import { relativeTime } from '@/lib/format'
import type { LedgerEvent } from '@/shared/types'

export interface RecentEventsProps {
  events: LedgerEvent[] | undefined | null
  contractId: string
  className?: string
}

export function RecentEvents({
  events = [],
  contractId,
  className = '',
}: RecentEventsProps) {
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null)

  const recent = (events || []).slice(-6).reverse()

  return (
    <div className={`p-5 rounded-xl bg-surface border border-border shadow-sm space-y-4 ${className}`}>
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand" />
          <h2 className="text-sm font-semibold text-text">Audit Activity</h2>
        </div>
        <Link
          href={`/contracts/${contractId}/ledger`}
          className="text-xs font-medium text-brand hover:underline inline-flex items-center gap-0.5"
        >
          View Ledger
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="text-xs text-muted py-4 text-center">No ledger events recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {recent.map((ev) => {
            const explanation = explainLedgerEvent(ev.type, ev.payload)
            const isExpanded = expandedSeq === ev.seq

            return (
              <div
                key={ev.seq}
                className="p-3 rounded-lg bg-surface-2/60 border border-border/80 text-xs space-y-1.5 transition-all"
              >
                <div className="flex items-center justify-between text-muted">
                  <span className="font-mono text-[11px]">#{ev.seq}</span>
                  <span>{relativeTime(ev.created_at)}</span>
                </div>

                <div className="font-medium text-text">{explanation.title}</div>
                <p className="text-muted text-[11px] leading-relaxed">{explanation.summary}</p>

                <div className="pt-1 flex items-center justify-between">
                  <span className="capitalize px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] text-muted font-mono">
                    {ev.actor_type}
                  </span>

                  <button
                    type="button"
                    onClick={() => setExpandedSeq(isExpanded ? null : ev.seq)}
                    className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline focus:outline-none"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>Why?</span>
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-2 p-2 rounded bg-surface border border-brand/20 text-[11px] text-text space-y-1 animate-in fade-in duration-150">
                    <span className="font-semibold text-brand block">Why did this happen?</span>
                    <p className="text-muted leading-relaxed">{explanation.why}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
