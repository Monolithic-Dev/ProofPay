'use client'

/**
 * LintPanel Component — grouped validation issues with one-click automated fixes.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S1).
 */
import React from 'react'
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Wrench, Loader2 } from 'lucide-react'
import type { LintIssue } from '@/shared/types'

export interface LintPanelProps {
  issues: LintIssue[]
  onApplyFix: (codeOrId: string) => Promise<void>
  isFixing?: boolean
  className?: string
}

export function LintPanel({
  issues = [],
  onApplyFix,
  isFixing = false,
  className = '',
}: LintPanelProps) {
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => (i.severity as string) === 'warn' || (i.severity as string) === 'warning')
  const infos = issues.filter((i) => i.severity === 'info')

  if (issues.length === 0) {
    return (
      <div className={`p-5 rounded-2xl bg-ok/5 border border-ok/20 text-ok space-y-2 ${className}`}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-ok" />
          <h3 className="text-sm font-semibold text-text">Criteria Verified</h3>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Zero ambiguity detected. All milestones have strict, machine-checkable deterministic or rubric acceptance criteria.
        </p>
      </div>
    )
  }

  return (
    <div className={`p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-4 ${className}`}>
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-semibold text-text">Ambiguity &amp; Linter Checks</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {errors.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-bad/10 text-bad font-medium">
              {errors.length} error{errors.length > 1 ? 's' : ''}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-warn/10 text-warn font-medium">
              {warnings.length} warning{warnings.length > 1 ? 's' : ''}
            </span>
          )}
          {infos.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-surface-2 text-muted font-medium">
              {infos.length} note{infos.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {issues.map((issue, idx) => {
          const isError = issue.severity === 'error'
          const isWarn = (issue.severity as string) === 'warn' || (issue.severity as string) === 'warning'
          const Icon = isError ? AlertCircle : isWarn ? AlertTriangle : Info

          let borderClass = 'border-border'
          let bgClass = 'bg-surface-2/60'
          let iconColor = 'text-muted'

          if (isError) {
            borderClass = 'border-bad/20'
            bgClass = 'bg-bad/5'
            iconColor = 'text-bad'
          } else if (isWarn) {
            borderClass = 'border-warn/20'
            bgClass = 'bg-warn/5'
            iconColor = 'text-warn'
          }

          const hasFix = Boolean((issue as any).suggested_fix?.patch || issue.fix)
          const rawFixDesc = (issue as any).suggested_fix?.description || issue.fix
          const fixDesc =
            typeof rawFixDesc === 'string' &&
            (rawFixDesc.trim().startsWith('[') || rawFixDesc.trim().startsWith('{'))
              ? 'Automated schema patch ready'
              : rawFixDesc

          return (
            <div
              key={issue.code || idx}
              className={`p-3.5 rounded-xl border ${borderClass} ${bgClass} space-y-2 text-xs`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 ${iconColor} flex-shrink-0 mt-0.5`} />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-text block">{issue.message}</span>
                    <span className="font-mono text-[10px] text-muted block">
                      Code: {issue.code} {issue.path ? `· ${issue.path}` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {hasFix && (
                <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-muted text-[11px] leading-relaxed">
                    {fixDesc}
                  </span>
                  <button
                    type="button"
                    disabled={isFixing}
                    onClick={() => onApplyFix(issue.code)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg bg-brand text-white font-medium hover:opacity-95 transition-all text-xs flex-shrink-0 disabled:opacity-50"
                  >
                    {isFixing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wrench className="w-3.5 h-3.5" />
                    )}
                    <span>Fix with one click</span>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
