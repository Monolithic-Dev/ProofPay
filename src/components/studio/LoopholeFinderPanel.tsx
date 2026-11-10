'use client'

/**
 * LoopholeFinderPanel — Studio Right-Rail Red-Team Auditor (N1).
 * Scans draft contract criteria with adversarial candidate payloads, shows
 * exact checks the exploit bypassed, and applies schema-validated RFC 6902
 * closing patches with one click.
 */
import React, { useState } from 'react'
import {
  ShieldAlert,
  CheckCircle2,
  Wand2,
  Loader2,
  SearchCode,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useApiClient } from '@/lib/query'

export interface LoopholeFinderPanelProps {
  contractId: string
  contractVersion: number
  onContractUpdated: () => Promise<void> | void
}

interface ConfirmedLoopholeView {
  strategy_tag: string
  milestone_key: string
  milestone_index: number
  title: string
  why_useless: string
  artifact_preview: string
  passed_criteria: string[]
  closing_fix_description: string
  patch_ops: unknown[]
  retest_result?: {
    closed: boolean
    failed_check?: string
    reason: string
  }
}

interface ScanResponseView {
  contract_id: string
  contract_version: number
  attempts_tested: number
  loopholes_confirmed: number
  confirmed_loopholes: ConfirmedLoopholeView[]
  summary_badge: string
}

export function LoopholeFinderPanel({
  contractId,
  contractVersion,
  onContractUpdated,
}: LoopholeFinderPanelProps) {
  const api = useApiClient()

  const [scanning, setScanning] = useState(false)
  const [applyingTag, setApplyingTag] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<ScanResponseView | null>(null)
  const [expandedTag, setExpandedTag] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleScan = async () => {
    setScanning(true)
    setErrorMsg(null)
    try {
      const res = await api.scanLoopholes(contractId)
      setScanResult(res)
      if (res.confirmed_loopholes.length > 0) {
        setExpandedTag(res.confirmed_loopholes[0]!.strategy_tag)
      } else {
        setExpandedTag(null)
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Loophole scan failed')
    } finally {
      setScanning(false)
    }
  }

  const handleApplyPatch = async (loophole: ConfirmedLoopholeView) => {
    setApplyingTag(loophole.strategy_tag)
    setErrorMsg(null)
    try {
      const applyRes = await api.applyLoopholePatch(contractId, {
        strategy_tag: loophole.strategy_tag,
        patch_ops: loophole.patch_ops,
        description: loophole.closing_fix_description,
      })
      await onContractUpdated()
      if ((applyRes as any).rescan) {
        setScanResult((applyRes as any).rescan)
      } else {
        await handleScan()
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to apply closing patch')
    } finally {
      setApplyingTag(null)
    }
  }

  const isStale =
    scanResult !== null && scanResult.contract_version !== contractVersion

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-brand flex-shrink-0" />
            <h3 className="text-sm font-semibold text-text">Loophole Finder</h3>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Red-teams your draft criteria with adversarial deliverables and proves whether any dummy payload passes Stage 1 code.
          </p>
        </div>

        <button
          type="button"
          onClick={handleScan}
          disabled={scanning || applyingTag !== null}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:opacity-95 transition-opacity disabled:opacity-50 flex-shrink-0"
        >
          {scanning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Probing…</span>
            </>
          ) : (
            <>
              <SearchCode className="w-3.5 h-3.5" />
              <span>{scanResult ? 'Re-scan' : 'Scan Draft'}</span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-bad/10 border border-bad/20 text-xs text-bad">
          {errorMsg}
        </div>
      )}

      {scanResult && (
        <div className="space-y-3">
          <div
            className={`p-3 rounded-lg border flex items-center justify-between gap-2 text-xs font-medium ${
              scanResult.loopholes_confirmed === 0
                ? 'bg-ok/10 border-ok/20 text-ok'
                : 'bg-warn/10 border-warn/30 text-warn'
            }`}
          >
            <div className="flex items-center gap-2">
              {scanResult.loopholes_confirmed === 0 ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{scanResult.summary_badge}</span>
            </div>
            {isStale && (
              <span className="text-[10px] font-mono text-muted">
                Draft updated — re-scan
              </span>
            )}
          </div>

          {scanResult.confirmed_loopholes.map((lh) => {
            const key = `${lh.milestone_key}:${lh.strategy_tag}`
            const isExpanded = expandedTag === lh.strategy_tag
            const isApplying = applyingTag === lh.strategy_tag

            return (
              <div
                key={key}
                className="rounded-lg border border-warn/30 bg-surface-2 p-3.5 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-surface border border-border text-text">
                        [{lh.milestone_key}]
                      </span>
                      <span className="text-xs font-semibold text-text">
                        {lh.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed">
                      {lh.why_useless}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="Toggle exploit details"
                    onClick={() =>
                      setExpandedTag(isExpanded ? null : lh.strategy_tag)
                    }
                    className="p-1 text-muted hover:text-text flex-shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                  <span className="text-muted">Bypassed:</span>
                  {lh.passed_criteria.map((c, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-bad/10 text-bad border border-bad/20"
                    >
                      {c}
                    </span>
                  ))}
                </div>

                {isExpanded && (
                  <div className="space-y-2 pt-1 border-t border-border/60">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-muted block mb-1">
                        Adversarial Payload Preview
                      </span>
                      <pre className="p-2 rounded bg-surface border border-border text-[10px] font-mono text-muted overflow-x-auto max-h-24 whitespace-pre-wrap break-all">
                        {lh.artifact_preview}
                      </pre>
                    </div>

                    {lh.retest_result && (
                      <p className="text-[11px] text-ok font-mono">
                        Dry-run patch verified: {lh.retest_result.reason}
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-text font-medium truncate">
                    {lh.closing_fix_description}
                  </span>

                  <button
                    type="button"
                    disabled={applyingTag !== null}
                    onClick={() => handleApplyPatch(lh)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-brand text-white text-xs font-medium hover:opacity-95 transition-opacity disabled:opacity-50 flex-shrink-0"
                  >
                    {isApplying ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3" />
                    )}
                    <span>{isApplying ? 'Closing…' : 'Close Loophole'}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

