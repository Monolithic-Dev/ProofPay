'use client'

/**
 * FixList Component — actionable bullet list of exact fixes required on rejected deliverables.
 * Implements phase-6-frontend.md §6.4 & docs/v2/01-NEW-FEATURES-SECURITY-AI-PRODUCT.md A5.
 */
import React from 'react'
import { AlertCircle, Wrench, Sparkles } from 'lucide-react'
import { computeFixHint } from '@/lib/fix-hints'

export interface FixItem {
  code: string
  criterion_key?: string
  message: string
  observed?: unknown
  expected?: unknown
  check?: string
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

      <ul className="space-y-2.5 text-xs">
        {reasons.map((r, idx) => {
          const hint = computeFixHint({
            criterion_key: r.criterion_key || r.code,
            check: r.check,
            observed: r.observed,
            expected: r.expected,
            message: r.message,
          })

          return (
            <li
              key={idx}
              className="p-3 rounded-xl bg-surface border border-bad/15 space-y-2 text-text"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-bad flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5 flex-1">
                  <span className="font-medium text-text">{r.message}</span>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
                    <span>Code: {r.code}</span>
                    {r.criterion_key && <span>• Criterion: {r.criterion_key}</span>}
                  </div>
                </div>
              </div>

              {hint && (
                <div className="ml-6 p-2 rounded-lg bg-surface-2 border border-border flex items-center gap-2 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                  <span className="text-text font-semibold">{hint.action}</span>
                  <span className="text-muted">({hint.minimal_delta})</span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
