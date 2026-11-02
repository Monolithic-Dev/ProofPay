'use client'

/**
 * ManipulationCallout Component — notifies when prompt injection is detected and neutralized.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S5).
 */
import React from 'react'
import { ShieldAlert } from 'lucide-react'

export interface ManipulationCalloutProps {
  severity?: 'none' | 'low' | 'high' | string
  spans?: Array<{ quote: string; reason?: string }>
  className?: string
}

export function ManipulationCallout({
  severity = 'none',
  spans = [],
  className = '',
}: ManipulationCalloutProps) {
  if (severity === 'none' && spans.length === 0) return null

  return (
    <div
      role="alert"
      className={`p-5 rounded-2xl bg-warn/10 border border-warn/30 text-text space-y-3 ${className}`}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-warn flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-semibold text-warn text-sm">
            Adversarial Text Neutralized ({severity.toUpperCase()})
          </h4>
          <p className="text-xs text-muted leading-relaxed">
            We found text addressed to the AI checker trying to override verification instructions. It was strictly ignored by the policy engine.
          </p>
        </div>
      </div>

      {spans.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-warn/20">
          <span className="text-[11px] font-semibold text-warn">Flagged Input Spans:</span>
          {spans.map((s, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-lg bg-surface/80 border border-warn/20 text-xs font-mono text-text space-y-1"
            >
              <div className="text-bad font-medium">&ldquo;{s.quote}&rdquo;</div>
              {s.reason && <p className="text-[11px] text-muted font-sans">{s.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
