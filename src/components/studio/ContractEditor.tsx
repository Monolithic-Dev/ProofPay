'use client'

/**
 * ContractEditor Component — structured visual preview of milestones and criteria,
 * plus a collapsible raw JSON editor with live validation.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S1).
 */
import React, { useState, useEffect } from 'react'
import { Code, ChevronDown, ChevronUp, Save, CheckCircle2, ShieldCheck, Bot, UserCheck, AlertCircle } from 'lucide-react'
import { Money } from '@/components/common/Money'
import type { ContractView } from '@/shared/types'

export interface ContractEditorProps {
  contract: ContractView
  onPatchJson?: (newJson: Record<string, unknown>) => Promise<void>
  isSaving?: boolean
  className?: string
}

export function ContractEditor({
  contract,
  onPatchJson,
  isSaving = false,
  className = '',
}: ContractEditorProps) {
  const [showJsonEditor, setShowJsonEditor] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  const contractData = (contract.contract_json as any) || {}
  const milestonesList = contractData.milestones || []

  useEffect(() => {
    setJsonText(JSON.stringify(contract.contract_json, null, 2))
  }, [contract.contract_json])

  const handleJsonChange = (val: string) => {
    setJsonText(val)
    try {
      JSON.parse(val)
      setJsonError(null)
    } catch (e: any) {
      setJsonError(e.message)
    }
  }

  const handleSaveJson = async () => {
    if (jsonError || !onPatchJson) return
    try {
      const parsed = JSON.parse(jsonText)
      await onPatchJson(parsed)
    } catch (e: any) {
      setJsonError(e.message)
    }
  }

  return (
    <div className={`p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-text">{contract.title || contractData.title || 'Untitled Agreement'}</h2>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>Version {contract.version}</span>
            <span>•</span>
            <span>Currency: USD</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-muted block">Total Authorized</span>
            <Money minor={contract.total_minor} className="text-lg font-bold text-brand" />
          </div>

          <button
            type="button"
            onClick={() => setShowJsonEditor(!showJsonEditor)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-2 text-xs font-medium text-text hover:bg-surface transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
            <span>{showJsonEditor ? 'Hide JSON' : 'Edit JSON'}</span>
            {showJsonEditor ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Collapsible Raw JSON Editor */}
      {showJsonEditor && (
        <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text">Raw Contract JSON</span>
            {jsonError ? (
              <span className="text-xs text-bad flex items-center gap-1 font-mono">
                <AlertCircle className="w-3.5 h-3.5" />
                Invalid JSON
              </span>
            ) : (
              <span className="text-xs text-ok flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valid JSON Syntax
              </span>
            )}
          </div>

          <textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            rows={12}
            className="w-full p-3 rounded-lg bg-surface border border-border font-mono text-xs text-text focus:outline-none focus:ring-2 focus:ring-brand"
          />

          {jsonError && <p className="text-xs text-bad font-mono">{jsonError}</p>}

          {onPatchJson && (
            <button
              type="button"
              disabled={Boolean(jsonError) || isSaving}
              onClick={handleSaveJson}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-white text-xs font-medium hover:opacity-95 transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving Changes…' : 'Save JSON Changes'}</span>
            </button>
          )}
        </div>
      )}

      {/* Structured Milestones View */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text uppercase tracking-wider text-xs">
          Contract Milestones ({milestonesList.length})
        </h3>

        <div className="space-y-4">
          {milestonesList.map((m: any, idx: number) => {
            const criteriaList = m.criteria || []

            return (
              <div
                key={m.key || idx}
                className="p-5 rounded-xl bg-surface-2/50 border border-border space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded bg-surface border border-border text-xs font-mono font-bold text-text">
                      {m.key || `m${idx + 1}`}
                    </span>
                    <h4 className="font-semibold text-sm text-text">{m.title}</h4>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted">Due in {m.due_in_days || 3} days</span>
                    <Money minor={m.amount_minor} className="text-sm font-bold text-text" />
                  </div>
                </div>

                {m.deliverable && (
                  <div className="text-xs space-y-1">
                    <span className="font-semibold text-muted uppercase text-[10px] tracking-wider">
                      Expected Deliverable
                    </span>
                    <p className="text-text font-mono bg-surface p-2.5 rounded-lg border border-border/60">
                      [{m.deliverable.content_type ?? m.deliverable.type ?? 'deliverable'}] {m.deliverable.description}
                    </p>
                  </div>
                )}

                {/* Criteria list */}
                <div className="space-y-2">
                  <span className="font-semibold text-muted uppercase text-[10px] tracking-wider">
                    Acceptance Criteria ({criteriaList.length})
                  </span>

                  <div className="space-y-2">
                    {criteriaList.map((crit: any, cIdx: number) => {
                      const isDet = crit.type === 'deterministic'
                      const isRubric = crit.type === 'rubric'

                      return (
                        <div
                          key={crit.key || cIdx}
                          className="p-3 rounded-lg bg-surface border border-border/80 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-muted text-[11px]">{crit.key}</span>
                              <span className="font-medium text-text">{crit.description || crit.statement}</span>
                            </div>
                            {crit.check && (
                              <p className="text-[11px] font-mono text-muted">
                                Check: {crit.check}
                                {crit.spec ? ` ${JSON.stringify(crit.spec)}` : ''}
                              </p>
                            )}
                            {crit.rule?.pattern && (
                              <p className="text-[11px] font-mono text-muted">
                                Pattern: {crit.rule.pattern}
                              </p>
                            )}
                            {crit.pass_threshold !== undefined && isRubric && (
                              <p className="text-[11px] text-muted italic">
                                Passing threshold: {Math.round(Number(crit.pass_threshold) * 100)}%
                              </p>
                            )}
                            {crit.rubric?.target && (
                              <p className="text-[11px] text-muted italic">
                                Target: {crit.rubric.target} (Passing: {crit.rubric.passing_score ?? 75}%)
                              </p>
                            )}
                          </div>

                          <div className="flex-shrink-0">
                            {isDet ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-ok/10 text-ok border border-ok/20">
                                <ShieldCheck className="w-3 h-3" />
                                Deterministic Check
                              </span>
                            ) : isRubric ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand/10 text-brand border border-brand/20">
                                <Bot className="w-3 h-3" />
                                AI-Checked Rubric
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warn/10 text-warn border border-warn/20">
                                <UserCheck className="w-3 h-3" />
                                Needs Human Review
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
