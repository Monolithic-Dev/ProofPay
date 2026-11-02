'use client'

/**
 * EscalationActions Component — human escrow review interface for escalated milestones.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S5).
 */
import React, { useState } from 'react'
import { Eye, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Countdown } from '@/components/contract/Countdown'

export interface EscalationActionsProps {
  autoReleaseAt?: string | null
  onDecide: (decision: 'PASS' | 'REJECT', note?: string) => Promise<void>
  isDeciding?: boolean
  className?: string
}

export function EscalationActions({
  autoReleaseAt,
  onDecide,
  isDeciding = false,
  className = '',
}: EscalationActionsProps) {
  const [note, setNote] = useState('')

  const handleAction = async (decision: 'PASS' | 'REJECT') => {
    if (isDeciding) return
    await onDecide(decision, note.trim() || undefined)
  }

  return (
    <div
      className={`p-6 sm:p-8 rounded-2xl bg-surface border border-warn/30 shadow-sm space-y-6 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-warn" />
            <h3 className="text-base font-bold text-text">Human Escrow Review</h3>
          </div>
          <p className="text-xs text-muted">
            The automated verification was borderline. As the buyer, you have the final decision.
          </p>
        </div>

        {autoReleaseAt && (
          <Countdown
            target={autoReleaseAt}
            label="Auto-releases"
            warnBelowMs={12 * 3600 * 1000}
          />
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="escalation-note" className="text-xs font-semibold text-text block">
          Review Note (optional)
        </label>
        <textarea
          id="escalation-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add comments explaining your approval or rejection…"
          rows={3}
          disabled={isDeciding}
          className="w-full p-3 rounded-xl bg-surface-2 border border-border text-xs text-text placeholder-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand transition-all resize-y"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          disabled={isDeciding}
          onClick={() => handleAction('PASS')}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-ok text-white text-xs font-semibold hover:opacity-95 transition-all shadow-sm focus:ring-2 focus:ring-ok focus:outline-none disabled:opacity-50"
        >
          {isDeciding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>Approve Deliverable &amp; Release Funds</span>
        </button>

        <button
          type="button"
          disabled={isDeciding}
          onClick={() => handleAction('REJECT')}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface border border-bad/30 text-bad text-xs font-semibold hover:bg-bad/5 transition-all focus:ring-2 focus:ring-bad focus:outline-none disabled:opacity-50"
        >
          {isDeciding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          <span>Reject Deliverable</span>
        </button>
      </div>
    </div>
  )
}
