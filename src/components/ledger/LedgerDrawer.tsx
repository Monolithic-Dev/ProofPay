'use client'

/**
 * LedgerDrawer Component — detail drawer displaying raw event payload and SHA-256 hash linkage.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S6).
 */
import React, { useEffect } from 'react'
import { X, Copy, Check, ArrowRight } from 'lucide-react'
import { MonoText } from '@/components/common/MonoText'
import { explainLedgerEvent } from '@/lib/explain'
import type { LedgerEvent } from '@/shared/types'

export interface LedgerDrawerProps {
  event: LedgerEvent | null
  onClose: () => void
}

export function LedgerDrawer({ event, onClose }: LedgerDrawerProps) {
  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!event) return null

  const explanation = explainLedgerEvent(event.type, event.payload)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-label={`Event #${event.seq} Details`}
        className="relative w-full max-w-xl bg-surface border-l border-border h-full shadow-2xl z-10 flex flex-col p-6 space-y-6 overflow-y-auto animate-in slide-in-from-right duration-200"
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-surface-2 border border-border font-bold text-text">
              #{event.seq}
            </span>
            <div className="space-y-0.5">
              <h3 className="font-bold text-base text-text">{explanation.title}</h3>
              <p className="text-xs text-muted font-mono">{event.type}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-lg border border-border hover:bg-surface-2 text-muted hover:text-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Plain language explanation */}
        <div className="p-4 rounded-xl bg-surface-2/60 border border-border space-y-2 text-xs">
          <span className="font-semibold text-brand text-xs uppercase tracking-wide block">
            Plain Language Summary
          </span>
          <p className="text-text leading-relaxed">{explanation.summary}</p>
          <p className="text-muted leading-relaxed">{explanation.why}</p>
        </div>

        {/* Cryptographic Linkage Box */}
        <div className="p-4 rounded-xl bg-surface-2/60 border border-border space-y-3 text-xs font-mono">
          <span className="font-semibold text-text uppercase text-[10px] tracking-wider block">
            Cryptographic SHA-256 Chain Linkage
          </span>

          <div className="space-y-1">
            <span className="text-muted text-[11px] block">Previous Hash (parent):</span>
            <MonoText value={event.prev_hash} />
          </div>

          <div className="flex justify-center text-muted">
            <ArrowRight className="w-4 h-4 rotate-90 my-0.5" />
          </div>

          <div className="space-y-1">
            <span className="text-muted text-[11px] block">Event Block Hash:</span>
            <MonoText value={event.hash} />
          </div>
        </div>

        {/* Raw Payload JSON */}
        <div className="space-y-2 flex-1 flex flex-col">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text">Event Payload JSON</span>
            <MonoText value={JSON.stringify(event.payload, null, 2)} short length={10} label="Raw" />
          </div>

          <pre className="p-4 rounded-xl bg-surface-2 border border-border font-mono text-xs text-text overflow-x-auto flex-1 leading-relaxed">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </div>

        {/* Event Meta */}
        <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted font-mono">
          <span>Actor: {event.actor_type}</span>
          <span>{new Date(event.created_at).toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
