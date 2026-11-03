'use client'

/**
 * CriterionRow Component — individual criterion outcome in the verification report.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S5).
 */
import React from 'react'
import { Check, X, AlertTriangle, ShieldCheck, Bot, UserCheck } from 'lucide-react'
import type { CriterionResult } from '@/server/verify/view'

export interface CriterionRowProps {
  criterion: CriterionResult
  className?: string
}

export function CriterionRow({ criterion, className = '' }: CriterionRowProps) {
  const isPass = criterion.status === 'pass'
  const isFail = criterion.status === 'fail'
  const isHuman = criterion.status === 'needs_human' || criterion.status === 'cannot_verify'

  const isDet = criterion.type === 'deterministic'
  const isRubric = criterion.type === 'rubric'

  return (
    <div
      className={`p-4 rounded-xl border transition-all text-xs space-y-2.5 ${
        isPass
          ? 'bg-ok/5 border-ok/20'
          : isFail
          ? 'bg-bad/5 border-bad/20'
          : 'bg-warn/5 border-warn/20'
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              isPass ? 'bg-ok text-white' : isFail ? 'bg-bad text-white' : 'bg-warn text-white'
            }`}
          >
            {isPass ? (
              <Check className="w-3.5 h-3.5" />
            ) : isFail ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-muted text-[11px] font-semibold">
                {criterion.criterion_key}
              </span>
              <span className="font-semibold text-text text-sm">
                {criterion.message || (isPass ? 'Criterion satisfied' : 'Check failed')}
              </span>
            </div>

            {/* Expected vs Observed */}
            {(criterion.expected !== undefined || criterion.observed !== undefined) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted pt-1">
                {criterion.expected !== undefined && (
                  <span>
                    Expected: <strong className="text-text font-mono">{String(criterion.expected)}</strong>
                  </span>
                )}
                {criterion.observed !== undefined && (
                  <span>
                    Observed: <strong className="text-text font-mono">{typeof criterion.observed === 'object' ? JSON.stringify(criterion.observed) : String(criterion.observed)}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Badges & Confidence */}
        <div className="flex flex-wrap items-center gap-2 self-start">
          {criterion.confidence !== undefined && (
            <span className="text-[11px] font-mono text-muted bg-surface px-2 py-0.5 rounded border border-border">
              {Math.round(criterion.confidence * 100)}% confidence
            </span>
          )}

          {isDet ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-ok/10 text-ok border border-ok/20">
              <ShieldCheck className="w-3 h-3" />
              Deterministic
            </span>
          ) : isRubric ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand/10 text-brand border border-brand/20">
              <Bot className="w-3 h-3" />
              AI Rubric
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warn/10 text-warn border border-warn/20">
              <UserCheck className="w-3 h-3" />
              Human Review
            </span>
          )}
        </div>
      </div>

      {/* Evidence Quotes */}
      {criterion.evidence && criterion.evidence.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border/40">
          <span className="text-[10px] uppercase font-semibold text-muted tracking-wider">
            Verified Supporting Evidence:
          </span>
          <div className="space-y-1">
            {criterion.evidence.map((ev, i) => (
              <div
                key={i}
                className="p-2 rounded bg-surface/80 border border-border/80 font-mono text-[11px] text-text flex items-start justify-between gap-2"
              >
                <span>&ldquo;{ev.quote}&rdquo;</span>
                {ev.verified && (
                  <span className="text-ok font-sans text-[10px] font-semibold flex-shrink-0">
                    verified ✓
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
