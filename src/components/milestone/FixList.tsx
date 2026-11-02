'use client'

/**
 * FixList Component — actionable bullet list of exact fixes required on rejected deliverables.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S5).
 */
import React from 'react'
import { AlertCircle, Wrench } from 'lucide-react'

export interface FixItem {
  code: string
  criterion_key?: string
  message: string
}

export interface FixListProps {
  reasons: FixItem[]
  className?: string
}

export function FixList({ reasons = [], className = '' }: FixListProps) {
  if (reasons.length === 0) return null

  return (
    <div
      className={`p-5 rounded-2xl bg-bad/5 border border-bad/20 space-y-3 ${className}`}
    >
      <div className="flex items-center gap-2 text-bad">
        <Wrench className="w-4 h-4" />
        <h4 className="font-semibold text-sm">Required Fixes Before Resubmission</h4>
      </div>

      <ul className="space-y-2 text-xs">
        {reasons.map((r, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2.5 p-2.5 rounded-lg bg-surface border border-bad/15 text-text"
          >
            <AlertCircle className="w-4 h-4 text-bad flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-medium text-text">{r.message}</span>
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
                <span>Code: {r.code}</span>
                {r.criterion_key && <span>• Criterion: {r.criterion_key}</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
