'use client'

/**
 * Interactive Loophole Finder Showcase — /demo/loophole (N1 Signature Feature)
 * Red-teams contract acceptance rules with real Stage 1 exploit artifacts,
 * proves mathematically which dummy submissions pass, and applies RFC 6902 patches
 * + re-tests in real time to verify the exploit is blocked.
 */
import React, { useEffect, useState } from 'react'
import { PageShell } from '@/components/common/PageShell'
import {
  ShieldAlert,
  CheckCircle2,
  Wand2,
  RefreshCw,
  Loader2,
  Code2,
  AlertTriangle,
  SearchCode,
} from 'lucide-react'

interface ConfirmedLoophole {
  strategy_tag: string
  milestone_key: string
  milestone_index: number
  title: string
  why_useless: string
  artifact_preview: string
  passed_criteria: string[]
  closing_fix_description: string
  patch_ops: unknown[]
  retest_result: {
    closed: boolean
    failed_check?: string
    reason: string
  }
}

interface ScanResult {
  contract_id: string
  contract_version: number
  attempts_tested: number
  loopholes_confirmed: number
  confirmed_loopholes: ConfirmedLoophole[]
  summary_badge: string
}

interface Preset {
  id: string
  name: string
  subtitle: string
  contract: Record<string, any>
}

export default function DemoLoopholePage() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const [activeContract, setActiveContract] = useState<Record<string, any> | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [closedHistory, setClosedHistory] = useState<
    Array<{ tag: string; title: string; checkReason: string }>
  >([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPresets = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/demo/loophole')
      if (!res.ok) throw new Error('Failed to load Loophole Finder presets')
      const data = await res.json()
      setPresets(data.presets || [])
      if (data.presets?.length > 0) {
        const first = data.presets[0] as Preset
        setSelectedPresetId(first.id)
        setActiveContract(first.contract)
        setScanResult(data.initial_scan)
        setClosedHistory([])
      }
    } catch (err: any) {
      setError(err?.message || 'Error initializing demo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPresets()
  }, [])

  const handleSelectPreset = async (preset: Preset) => {
    setSelectedPresetId(preset.id)
    setActiveContract(preset.contract)
    setClosedHistory([])
    setWorking(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/demo/loophole', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan', contract: preset.contract }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'Scan failed')
      setScanResult(data.scan)
    } catch (err: any) {
      setError(err?.message || 'Scan failed')
    } finally {
      setWorking(false)
    }
  }

  const handleApplyPatchAndRetest = async (lh: ConfirmedLoophole) => {
    if (!activeContract) return
    setWorking(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/demo/loophole', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_and_retest',
          contract: activeContract,
          strategy_tag: lh.strategy_tag,
          patch_ops: lh.patch_ops,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'Patch failed schema validation')

      setActiveContract(data.contract)
      setScanResult(data.scan)
      setClosedHistory((prev) => [
        {
          tag: lh.strategy_tag,
          title: lh.title,
          checkReason: lh.retest_result?.reason || 'Confirmed blocked on re-test',
        },
        ...prev,
      ])
    } catch (err: any) {
      setError(err?.message || 'Failed to apply closing patch')
    } finally {
      setWorking(false)
    }
  }

  const criteriaList: any[] = activeContract?.milestones?.[0]?.criteria ?? []

  return (
    <PageShell
      title="Loophole Finder Sandbox"
      subtitle="Zero-hallucination red-team probe: generates exploit submissions, runs real Stage 1 checks, and closes holes with RFC 6902 patches"
      backHref="/demo"
      backLabel="Playground"
      actions={
        <button
          type="button"
          onClick={loadPresets}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text hover:bg-surface-2 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-muted" />
          <span>Reset Presets</span>
        </button>
      }
    >
      <div className="space-y-6 pb-20 max-w-6xl">
        {/* Preset Selector Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {presets.map((p) => {
            const active = p.id === selectedPresetId
            return (
              <button
                key={p.id}
                type="button"
                disabled={working}
                onClick={() => handleSelectPreset(p)}
                className={`text-left p-4 rounded-xl border transition-all space-y-1 ${
                  active
                    ? 'bg-brand/10 border-brand shadow-sm'
                    : 'bg-surface border-border hover:border-brand/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-text">{p.name}</span>
                  {active && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand text-white">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted leading-relaxed">{p.subtitle}</p>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-bad/10 border border-bad/30 text-xs text-bad flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading || !activeContract ? (
          <div className="p-12 rounded-2xl bg-surface border border-border flex items-center justify-center gap-2 text-xs text-muted">
            <Loader2 className="w-4 h-4 animate-spin text-brand" />
            <span>Running Stage 1 exploit probes against contract specifications…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left (2 cols): Live Contract Criteria Inspector */}
            <div className="lg:col-span-2 space-y-4">
              <div className="p-5 rounded-2xl bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-brand" />
                    <h2 className="text-sm font-bold text-text">
                      Active Milestone Criteria ({criteriaList.length})
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono text-muted">
                    Content: {activeContract.milestones?.[0]?.deliverable?.content_type}
                  </span>
                </div>

                <div className="space-y-2">
                  {criteriaList.map((crit: any) => (
                    <div
                      key={crit.key}
                      className="p-3 rounded-xl bg-surface-2 border border-border space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-bold text-brand">
                          {crit.key} · {crit.check}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-muted">
                          {crit.required ? 'REQUIRED' : 'OPTIONAL'}
                        </span>
                      </div>
                      <p className="text-xs text-text">{crit.description}</p>
                      <pre className="text-[10px] font-mono text-muted overflow-x-auto">
                        {JSON.stringify(crit.spec)}
                      </pre>
                    </div>
                  ))}
                </div>

                {closedHistory.length > 0 && (
                  <div className="pt-3 border-t border-border space-y-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-ok">
                      Verified Patched Exploits
                    </h3>
                    {closedHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-ok/10 border border-ok/20 text-[11px] space-y-0.5"
                      >
                        <div className="font-semibold text-ok flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{item.title}</span>
                        </div>
                        <p className="font-mono text-[10px] text-muted">{item.checkReason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right (3 cols): Exploit Scan Findings & RFC 6902 Patch Closures */}
            <div className="lg:col-span-3 space-y-4">
              {scanResult && (
                <div
                  className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    scanResult.loopholes_confirmed === 0
                      ? 'bg-ok/10 border-ok/30 text-ok'
                      : 'bg-warn/10 border-warn/30 text-warn'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {scanResult.loopholes_confirmed === 0 ? (
                      <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                    ) : (
                      <ShieldAlert className="w-6 h-6 flex-shrink-0" />
                    )}
                    <div>
                      <h2 className="text-sm font-bold">{scanResult.summary_badge}</h2>
                      <p className="text-xs opacity-90">
                        {scanResult.loopholes_confirmed === 0
                          ? `All ${scanResult.attempts_tested} adversarial exploit submissions were blocked by deterministic criteria.`
                          : `Click "Close Loophole & Re-test" below to patch ContractSchema rules via RFC 6902 and verify exploit failure.`}
                      </p>
                    </div>
                  </div>

                  {working && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
                </div>
              )}

              {scanResult?.confirmed_loopholes.length === 0 ? (
                <div className="p-8 rounded-2xl bg-surface border border-border text-center space-y-2">
                  <SearchCode className="w-8 h-8 text-ok mx-auto" />
                  <h3 className="text-sm font-bold text-text">
                    All Tested Exploit Probes Blocked
                  </h3>
                  <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                    Every adversarial payload (duplicate rows, placeholder fields, low-entropy padding, keyword stuffing, or loopback links) failed Stage 1 deterministic validation against this milestone specification.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scanResult?.confirmed_loopholes.map((lh) => (
                    <div
                      key={`${lh.milestone_key}:${lh.strategy_tag}`}
                      className="p-5 rounded-2xl bg-surface border border-warn/30 space-y-4 shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bad/10 text-bad border border-bad/20 uppercase">
                              CONFIRMED EXPLOIT · {lh.strategy_tag}
                            </span>
                            <span className="text-[10px] font-mono text-muted">
                              Milestone [{lh.milestone_key}]
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-text">{lh.title}</h3>
                          <p className="text-xs text-muted leading-relaxed">{lh.why_useless}</p>
                        </div>

                        <button
                          type="button"
                          disabled={working}
                          onClick={() => handleApplyPatchAndRetest(lh)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:opacity-95 transition-opacity disabled:opacity-50 flex-shrink-0"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>Close Loophole &amp; Re-test</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                        <span className="text-muted">Currently passes:</span>
                        {lh.passed_criteria.map((c, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-bad/10 text-bad border border-bad/20"
                          >
                            {c} ✓
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono uppercase text-muted block">
                            Adversarial Payload Preview
                          </span>
                          <pre className="p-3 rounded-xl bg-surface-2 border border-border text-[10px] font-mono text-muted overflow-x-auto max-h-28 whitespace-pre-wrap break-all">
                            {lh.artifact_preview}
                          </pre>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-mono uppercase text-muted block">
                            Proposed RFC 6902 Patch ({lh.patch_ops.length} op)
                          </span>
                          <pre className="p-3 rounded-xl bg-surface-2 border border-border text-[10px] font-mono text-text overflow-x-auto max-h-28">
                            {JSON.stringify(lh.patch_ops, null, 2)}
                          </pre>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-ok/5 border border-ok/20 text-[11px] font-mono text-ok">
                        Dry-run Retest Proof: {lh.retest_result.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}

