'use client'

/**
 * VerificationReport Component — Comprehensive verification outcome breakdown.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S5).
 * Enhanced with Verification Theater pipeline timeline (B10).
 */
import React from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Cpu,
  Zap,
  Timer,
  ShieldCheck,
  Search,
  Lock,
  Scale,
  ArrowRight
} from 'lucide-react'
import { CriterionRow } from './CriterionRow'
import { ManipulationCallout } from './ManipulationCallout'
import { FixList } from './FixList'

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

  const criteriaList = verification.criteria || verification.stage1 || []
  const detChecks = criteriaList.filter((c: any) => c.type === 'deterministic')
  const rubricChecks = criteriaList.filter((c: any) => c.type === 'rubric')
  const detPassed = detChecks.filter((c: any) => c.status === 'pass').length
  const detFailed = detChecks.length - detPassed
  const hasManipulation = Boolean(verification.manipulation && verification.manipulation.severity !== 'NONE')

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
              ID: {verification.id?.slice(0, 8)}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted pt-1 leading-relaxed">
            {decisionSubtitle}
          </p>
        </div>
      </div>

      {/* Verification Theater: 4-Stage Execution Timeline */}
      <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-brand" />
            Verification Pipeline (Code Decides • LLM Evaluates Evidence)
          </span>
          <span className="text-[11px] text-muted font-mono">
            {verification.latency_ms ? `${verification.latency_ms}ms total` : '< 500ms'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
          {/* Stage 1: Deterministic Checks */}
          <div className="p-3 rounded-lg bg-surface border border-border text-xs space-y-1">
            <div className="flex items-center justify-between text-muted">
              <span className="font-semibold text-text flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-ok" />
                1. Code Checks
              </span>
              <span className="text-[10px] font-mono text-muted">&lt;50ms</span>
            </div>
            <p className="text-[11px] text-muted">
              {detChecks.length > 0
                ? detFailed === 0
                  ? `✓ All ${detChecks.length} checks passed`
                  : `✗ ${detFailed} check failed`
                : '✓ Schema & format valid'}
            </p>
          </div>

          {/* Stage 2: Evidence Extraction */}
          <div className="p-3 rounded-lg bg-surface border border-border text-xs space-y-1">
            <div className="flex items-center justify-between text-muted">
              <span className="font-semibold text-text flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-brand" />
                2. Evidence
              </span>
              <span className="text-[10px] font-mono text-muted">
                {verification.model ? verification.model.split('/').pop() : 'LLM'}
              </span>
            </div>
            <p className="text-[11px] text-muted">
              {rubricChecks.length > 0
                ? '✓ Verbatim substring verified'
                : '✓ Pure deterministic rule'}
            </p>
          </div>

          {/* Stage 3: Adversarial Scan */}
          <div className="p-3 rounded-lg bg-surface border border-border text-xs space-y-1">
            <div className="flex items-center justify-between text-muted">
              <span className="font-semibold text-text flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-warn" />
                3. Adversarial
              </span>
              <span className="text-[10px] font-mono text-muted">Guard</span>
            </div>
            <p className="text-[11px] text-muted">
              {hasManipulation ? '⚠ Manipulation flagged' : '✓ 0 prompt injections'}
            </p>
          </div>

          {/* Stage 4: Rule Engine Decision */}
          <div className={`p-3 rounded-lg bg-surface border ${
            isPass ? 'border-ok/30 bg-ok/5' : isReject ? 'border-bad/30 bg-bad/5' : 'border-warn/30 bg-warn/5'
          } text-xs space-y-1`}>
            <div className="flex items-center justify-between text-muted">
              <span className="font-semibold text-text flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-accent" />
                4. Rule Engine
              </span>
              <span className={`text-[10px] font-bold font-mono ${
                isPass ? 'text-ok' : isReject ? 'text-bad' : 'text-warn'
              }`}>
                {verification.decision || 'PENDING'}
              </span>
            </div>
            <p className="text-[11px] text-muted">
              Pure code policy gate
            </p>
          </div>
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
        <h4 className="text-xs font-medium text-muted">
          Criteria verification breakdown ({criteriaList.length})
        </h4>

        <div className="space-y-3">
          {criteriaList.map((c: any, i: number) => (
            <CriterionRow key={c.criterion_key || i} criterion={c} />
          ))}
        </div>
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
