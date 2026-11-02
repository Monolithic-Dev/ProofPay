'use client'

/**
 * VerificationReport Component — Comprehensive verification outcome breakdown.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S5).
 */
import React from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Cpu, Zap, Timer } from 'lucide-react'
import { CriterionRow } from './CriterionRow'
import { ManipulationCallout } from './ManipulationCallout'
import { FixList } from './FixList'
import type { VerificationView } from '@/server/verify/view'

export interface VerificationReportProps {
  verification: any
  className?: string
}

export function VerificationReport({
  verification,
  className = '',
}: VerificationReportProps) {
  const isPass = verification.decision === 'PASS'
  const isReject = verification.decision === 'REJECT'
  const isEscalate = verification.decision === 'ESCALATE'

  let decisionPillClass = 'bg-surface-2 text-muted border-border'
  let DecisionIcon = AlertTriangle
  let decisionTitle = 'Verification In Progress'
  let decisionSubtitle = 'Automated checks are evaluating criteria…'

  if (isPass) {
    decisionPillClass = 'bg-ok text-white shadow-sm'
    DecisionIcon = CheckCircle2
    decisionTitle = 'All criteria passed'
    decisionSubtitle = 'Deterministic checks and semantic rubrics passed. Approved for release.'
  } else if (isReject) {
    decisionPillClass = 'bg-bad text-white shadow-sm'
    DecisionIcon = XCircle
    decisionTitle = 'Deliverable rejected'
    decisionSubtitle = 'One or more criteria failed verification. Seller can review fixes and resubmit.'
  } else if (isEscalate) {
    decisionPillClass = 'bg-warn text-white shadow-sm'
    DecisionIcon = AlertTriangle
    decisionTitle = 'Needs review'
    decisionSubtitle = 'Verification was borderline or subjective. Buyer makes final release decision.'
  }

  return (
    <div className={`p-6 sm:p-8 rounded-2xl bg-surface border border-border shadow-sm space-y-6 ${className}`}>
      {/* Header Banner with Big Decision Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold ${decisionPillClass}`}
            >
              <DecisionIcon className="w-4 h-4" />
              <span>{decisionTitle}</span>
            </span>
            <span className="text-xs text-muted font-mono">
              ID: {verification.id.slice(0, 8)}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted pt-1 leading-relaxed">
            {decisionSubtitle}
          </p>
        </div>
      </div>

      {/* Adversarial Manipulation Callout */}
      {verification.manipulation && (
        <ManipulationCallout
          severity={verification.manipulation.severity}
          spans={verification.manipulation.spans}
        />
      )}

      {/* Actionable Fix List if Rejected */}
      {isReject && verification.reasons && (
        <FixList reasons={verification.reasons} />
      )}

      {/* Criteria Breakdown */}
      <div className="space-y-3">
        {(() => {
          const criteriaList = verification.criteria || verification.stage1 || []
          return (
            <>
              <h4 className="text-xs font-medium text-muted">
                Criteria verification breakdown ({criteriaList.length})
              </h4>

              <div className="space-y-3">
                {criteriaList.map((c: any, i: number) => (
                  <CriterionRow key={c.criterion_key || i} criterion={c} />
                ))}
              </div>
            </>
          )
        })()}
      </div>

      {/* Metadata Footer */}
      <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-muted">
        <div className="flex flex-wrap items-center gap-4">
          {verification.model && (
            <span className="inline-flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-brand" />
              Model: {verification.model}
            </span>
          )}
          {verification.prompt_version && (
            <span>Prompt: {verification.prompt_version}</span>
          )}
          {verification.cache_hit && (
            <span className="inline-flex items-center gap-1 text-ok">
              <Zap className="w-3.5 h-3.5" />
              Cache Hit
            </span>
          )}
        </div>

        {verification.latency_ms !== undefined && (
          <span className="inline-flex items-center gap-1">
            <Timer className="w-3.5 h-3.5 text-muted" />
            Latency: {verification.latency_ms} ms
          </span>
        )}
      </div>
    </div>
  )
}
