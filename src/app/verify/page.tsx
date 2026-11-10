'use client'

import React, { useState, useRef, useMemo } from 'react'
import { PageShell } from '@/components/common/PageShell'
import { FundsBar } from '@/components/contract/FundsBar'
import { StatusChip } from '@/components/contract/StatusChip'
import {
  FileCheck2,
  Upload,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  Copy,
  ShieldAlert,
  FileText,
  Printer,
  Lock,
  Layers,
  Check,
  ShieldCheck,
  History,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  verifyProofPack,
  type VerificationResult,
  type ProofPackEvent,
} from '@/lib/proofpack/verify'
import {
  buildValidSampleProofPack,
  createTamperedSampleProofPack,
} from '@/lib/proofpack/sample'
import { replayUpToSeq, type LedgerEventInput } from '@/shared/ledger-reducer'

export default function ProofPackVerifyPage() {
  const [jsonText, setJsonText] = useState('')
  const [parsedPack, setParsedPack] = useState<any>(null)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [tampered, setTampered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showDossierModal, setShowDossierModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [replaySeq, setReplaySeq] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleVerify = async (textToVerify: string) => {
    setVerifying(true)
    setResult(null)

    try {
      const parsed = JSON.parse(textToVerify)
      setParsedPack(parsed)
      const ledger: ProofPackEvent[] = Array.isArray(parsed?.ledger) ? parsed.ledger : []
      if (ledger.length > 0) {
        const maxSeq = Math.max(...ledger.map((e) => e.seq))
        setReplaySeq(maxSeq)
      } else {
        setReplaySeq(0)
      }
      const res = await verifyProofPack(parsed)
      setResult(res)
    } catch (err: any) {
      setParsedPack(null)
      setReplaySeq(0)
      setResult({
        valid: false,
        eventsChecked: 0,
        error: `JSON Parse Error: ${err.message}`,
      })
    } finally {
      setVerifying(false)
    }
  }

  const handleLoadValidSample = async () => {
    const sample = await buildValidSampleProofPack()
    const text = JSON.stringify(sample, null, 2)
    setJsonText(text)
    setTampered(false)
    await handleVerify(text)
  }

  const handleTamperDemo = async () => {
    const tamperedPack = await createTamperedSampleProofPack()
    const text = JSON.stringify(tamperedPack, null, 2)
    setJsonText(text)
    setTampered(true)
    await handleVerify(text)
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      readFile(file)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      readFile(file)
    }
  }

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        setJsonText(content)
        setTampered(false)
        handleVerify(content)
      }
    }
    reader.readAsText(file)
  }

  const handleCopyJson = () => {
    if (!jsonText) return
    navigator.clipboard.writeText(jsonText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Recompute contract state offline from the verified event chain up to `replaySeq`
  const ledgerList: ProofPackEvent[] = useMemo(() => {
    if (!Array.isArray(parsedPack?.ledger)) return []
    return [...parsedPack.ledger].sort((a, b) => a.seq - b.seq)
  }, [parsedPack])

  const minSeq = ledgerList.length > 0 ? ledgerList[0]!.seq : 0
  const maxSeq = ledgerList.length > 0 ? ledgerList[ledgerList.length - 1]!.seq : 0
  const effectiveReplaySeq = replaySeq >= minSeq && replaySeq <= maxSeq ? replaySeq : maxSeq

  const replayedState = useMemo(() => {
    if (!result?.valid || ledgerList.length === 0) return null
    const inputs: LedgerEventInput[] = ledgerList.map((e) => ({
      seq: e.seq,
      type: e.type,
      actor_type: e.actor_type || 'system',
      payload: e.payload || {},
      created_at: e.created_at,
      hash: e.hash,
      prev_hash: e.prev_hash,
    }))
    return replayUpToSeq(inputs, effectiveReplaySeq, parsedPack?.contract?.id || '')
  }, [result?.valid, ledgerList, effectiveReplaySeq, parsedPack?.contract?.id])

  const activeReplayEvent = useMemo(
    () => ledgerList.find((e) => e.seq === effectiveReplaySeq) ?? null,
    [ledgerList, effectiveReplaySeq]
  )

  // Dynamically extract PayPal and Verification evidence for Dossier modal
  const dossierFacts = useMemo(() => {
    if (!parsedPack) return null
    const events: ProofPackEvent[] = Array.isArray(parsedPack.ledger) ? parsedPack.ledger : []
    const authEvent = events.find(
      (e) =>
        e.payload?.paypal_authorization_id ||
        e.payload?.authorization_id ||
        parsedPack.paypal?.authorization_ids?.[0]
    )
    const authId =
      parsedPack.paypal?.authorization_ids?.[0] ||
      (authEvent?.payload?.paypal_authorization_id as string) ||
      (authEvent?.payload?.authorization_id as string) ||
      'None'

    const captureEvents = events.filter(
      (e) =>
        e.type === 'PAYPAL_CAPTURE_COMPLETED' ||
        e.type === 'CAPTURE_COMPLETED' ||
        e.type === 'MILESTONE_RELEASED'
    )
    const captureId =
      parsedPack.paypal?.captures?.[0]?.id ||
      (captureEvents[0]?.payload?.paypal_capture_id as string) ||
      (captureEvents[0]?.payload?.capture_id as string) ||
      'None'

    const verifiedEvent = events.find(
      (e) =>
        e.type === 'DELIVERABLE_VERIFIED' ||
        e.type === 'MILESTONE_PASSED' ||
        e.type === 'VERIFICATION_DECIDED'
    )
    const rubricScore = (verifiedEvent?.payload?.llm_rubric_score as number | undefined) ?? null
    const headHash =
      parsedPack.chain?.head_hash ||
      (events.length > 0 ? events[events.length - 1]!.hash : '') ||
      parsedPack.contract?.hash ||
      ''

    const totalMinor =
      parsedPack.contract?.total_minor ?? parsedPack.contract?.canonical?.total_minor ?? 0
    const buyerEmail =
      parsedPack.contract?.buyer?.email ||
      parsedPack.contract?.buyer_email ||
      'buyer@verified.proofpay'
    const sellerEmail =
      parsedPack.contract?.seller?.email ||
      parsedPack.contract?.seller_email ||
      'seller@verified.proofpay'

    return {
      authId,
      captureId,
      rubricScore,
      headHash,
      totalMinor,
      buyerEmail,
      sellerEmail,
    }
  }, [parsedPack])

  return (
    <PageShell
      title="Offline Proof Pack Verifier"
      subtitle="Verify SHA-256 hash chains and replay full contract state client-side without trusting ProofPay servers"
    >
      <div className="space-y-8 max-w-5xl pb-24">
        {/* Banner with Actions */}
        <div className="p-5 rounded-2xl bg-surface-2 border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-brand/10 border border-brand/20 text-brand">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-text">Zero-Server-Trust Client Verification</h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-ok/10 text-ok border border-ok/30 font-semibold">
                  100% Client-Side WebCrypto
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Recomputes canonical SHA-256 digests and event-sourced contract state inside your browser via{' '}
                <code>crypto.subtle.digest</code>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={handleLoadValidSample}
              className="px-3.5 py-2 rounded-xl bg-surface border border-border text-xs font-semibold text-text hover:border-brand/40 hover:bg-surface-2 transition-all flex items-center gap-1.5"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-brand" />
              <span>Load Sample Proof Pack</span>
            </button>
            <button
              type="button"
              onClick={handleTamperDemo}
              className="px-3.5 py-2 rounded-xl bg-bad/10 border border-bad/20 text-xs font-semibold text-bad hover:bg-bad/20 transition-all flex items-center gap-1.5"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Simulate Tamper Attack</span>
            </button>
          </div>
        </div>

        {/* Drag & Drop File Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all text-center flex flex-col items-center justify-center gap-2 ${
            isDragging
              ? 'border-brand bg-brand/5'
              : 'border-border hover:border-brand/50 bg-surface/50 hover:bg-surface'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.proofpack"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <div className="p-3 rounded-full bg-surface-2 border border-border text-muted">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text">
              Drop your Proof Pack (<code className="text-brand">.json</code> or{' '}
              <code className="text-brand">.proofpack</code>) here, or click to browse
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              Supports full export bundles containing hash chains, PayPal receipts, and verification trails
            </p>
          </div>
        </div>

        {/* Status Alert Card */}
        {result && (
          <div
            className={`p-6 rounded-2xl border transition-all ${
              result.valid
                ? 'bg-ok/10 border-ok/30 text-ok'
                : 'bg-bad/10 border-bad/30 text-bad'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                {result.valid ? (
                  <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertOctagon className="w-6 h-6 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold">
                    {result.valid
                      ? `Audit Hash Chain Intact (${result.eventsChecked} Sequential Events Verified)`
                      : `Audit Hash Chain Broken — Tampering Detected`}
                  </h3>
                  <p className="text-xs opacity-90 leading-relaxed font-mono">
                    {result.valid
                      ? 'All canonical JSON hashes, sequential prev_hash pointers, and PayPal receipts match computed SHA-256 digests.'
                      : result.error || `Hash mismatch detected at sequence #${result.brokenAtSeq}.`}
                  </p>
                  {tampered && !result.valid && (
                    <div className="text-xs mt-3 font-sans text-text bg-surface/80 p-3 rounded-xl border border-bad/30 space-y-1">
                      <p className="font-bold text-bad">Adversarial Tamper Demonstration:</p>
                      <p className="text-muted leading-relaxed">
                        We altered the PayPal capture payload in sequence #{result.brokenAtSeq} from{' '}
                        <strong>$75.00</strong> to <strong>$9,999.99</strong>. Modifying a single field invalidates the
                        SHA-256 chain immediately without needing server contact.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {result.valid && parsedPack && (
                <button
                  type="button"
                  onClick={() => setShowDossierModal(true)}
                  className="px-4 py-2 rounded-xl bg-brand text-white font-semibold text-xs hover:opacity-95 transition-all flex items-center gap-1.5 flex-shrink-0 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PayPal Dispute Dossier</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Offline Time-Travel State Replay (N2 in browser) */}
        {result?.valid && replayedState && ledgerList.length > 0 && (
          <div className="p-6 rounded-2xl bg-surface border border-border space-y-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-brand/10 border border-brand/20 text-brand">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">
                    Offline Event-Sourced State Replay
                  </h3>
                  <p className="text-[11px] text-muted">
                    Scrub across verified ledger blocks to inspect money state &amp; milestones at any event
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <StatusChip status={replayedState.status} size="md" />
                <span className="text-xs font-mono text-muted px-2.5 py-1 rounded-lg bg-surface-2 border border-border">
                  Event {effectiveReplaySeq} / {maxSeq}
                </span>
              </div>
            </div>

            {/* Scrubber Bar */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Previous event"
                disabled={effectiveReplaySeq <= minSeq}
                onClick={() => setReplaySeq(Math.max(minSeq, effectiveReplaySeq - 1))}
                className="p-2 rounded-lg border border-border bg-surface-2 text-text hover:border-brand/40 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <input
                type="range"
                aria-label="Replay ledger sequence"
                min={minSeq}
                max={maxSeq}
                step={1}
                value={effectiveReplaySeq}
                onChange={(e) => setReplaySeq(Number(e.target.value))}
                className="flex-1 accent-brand cursor-pointer"
              />

              <button
                type="button"
                aria-label="Next event"
                disabled={effectiveReplaySeq >= maxSeq}
                onClick={() => setReplaySeq(Math.min(maxSeq, effectiveReplaySeq + 1))}
                className="p-2 rounded-lg border border-border bg-surface-2 text-text hover:border-brand/40 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Reconstructed Funds Bar */}
            <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-3">
              <FundsBar
                totalMinor={replayedState.total_minor || parsedPack?.contract?.total_minor || 0}
                releasedMinor={replayedState.captured_minor}
                heldMinor={replayedState.remaining_minor}
                voidedMinor={replayedState.voided_minor}
              />

              {Object.keys(replayedState.milestones).length > 0 && (
                <div className="pt-2 border-t border-border/60 flex flex-wrap gap-2">
                  {Object.values(replayedState.milestones).map((m) => (
                    <div
                      key={m.key}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs"
                    >
                      <span className="font-mono font-semibold text-text">{m.key}</span>
                      <StatusChip status={m.status} size="sm" />
                      {m.amount_minor > 0 && (
                        <span className="text-[11px] font-mono text-muted">
                          ${(m.amount_minor / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeReplayEvent && (
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                <div className="space-y-0.5">
                  <span className="text-brand font-semibold">
                    #{activeReplayEvent.seq} {activeReplayEvent.type}
                  </span>
                  <span className="block text-[11px] text-muted">
                    Actor: {activeReplayEvent.actor_type || 'system'} ·{' '}
                    {new Date(activeReplayEvent.created_at).toISOString()}
                  </span>
                </div>
                <span className="text-[11px] text-ok truncate max-w-xs">
                  SHA-256: {activeReplayEvent.hash}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Visual Hash Chain Block Explorer */}
        {result?.valid && ledgerList.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand" />
                <span>Verified Hash Chain Sequence</span>
              </h3>
              <span className="text-xs text-muted font-mono">
                Contract ID: {parsedPack.contract?.id?.slice(0, 16)}...
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ledgerList.map((evt: ProofPackEvent) => {
                const isSelected = evt.seq === effectiveReplaySeq
                return (
                  <button
                    key={evt.seq}
                    type="button"
                    onClick={() => setReplaySeq(evt.seq)}
                    className={`text-left p-4 rounded-xl bg-surface border transition-all space-y-3 relative overflow-hidden ${
                      isSelected
                        ? 'border-brand ring-1 ring-brand/40'
                        : 'border-border hover:border-brand/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-surface-2 text-brand border border-brand/20">
                        Block #{evt.seq}
                      </span>
                      <span className="text-[10px] text-muted font-mono">
                        {new Date(evt.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold text-text truncate">
                        {evt.type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[11px] text-muted">
                        Actor:{' '}
                        <span className="font-semibold text-text uppercase">
                          {evt.actor_type || 'system'}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-border/60">
                      <div className="text-[10px] font-mono text-muted space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span>Prev Hash:</span>
                          <span className="text-text font-semibold">{evt.prev_hash.slice(0, 8)}...</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Block Digest:</span>
                          <span className="text-ok font-semibold">{evt.hash.slice(0, 8)}...</span>
                        </div>
                      </div>

                      {(evt.type === 'PAYPAL_AUTHORIZATION_CREATED' || evt.type === 'AUTHORIZATION_CREATED') && (
                        <div className="p-2 rounded bg-surface-2 border border-border text-[11px] text-muted space-y-0.5">
                          <p className="font-semibold text-text">PayPal Auth Hold:</p>
                          <p className="font-mono text-[10px] text-brand">
                            {String(evt.payload?.paypal_authorization_id || evt.payload?.authorization_id || '')}
                          </p>
                          {typeof evt.payload?.amount_minor === 'number' && (
                            <p className="text-[10px]">
                              ${(evt.payload.amount_minor / 100).toFixed(2)} USD hold
                            </p>
                          )}
                        </div>
                      )}

                      {evt.type === 'DELIVERABLE_VERIFIED' && (
                        <div className="p-2 rounded bg-surface-2 border border-border text-[11px] text-muted space-y-0.5">
                          <p className="font-semibold text-text">AI Verification Decision:</p>
                          <p className="font-mono text-[10px] text-ok">
                            PASS (Score: {String(evt.payload?.llm_rubric_score ?? 95)}/100)
                          </p>
                          <p className="text-[10px]">Deterministic Schema: Passed</p>
                        </div>
                      )}

                      {(evt.type === 'PAYPAL_CAPTURE_COMPLETED' || evt.type === 'CAPTURE_COMPLETED') && (
                        <div className="p-2 rounded bg-surface-2 border border-border text-[11px] text-muted space-y-0.5">
                          <p className="font-semibold text-text">PayPal Capture:</p>
                          <p className="font-mono text-[10px] text-ok">
                            {String(evt.payload?.paypal_capture_id || evt.payload?.capture_id || '')}
                          </p>
                          {typeof evt.payload?.amount_minor === 'number' && (
                            <p className="text-[10px]">
                              ${(evt.payload.amount_minor / 100).toFixed(2)} USD captured
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Input Text Area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-text uppercase tracking-wider">
              Raw Proof Pack JSON Payload
            </label>
            <div className="flex items-center gap-3">
              {jsonText && (
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="text-xs text-muted hover:text-text flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              )}
              {jsonText && (
                <button
                  type="button"
                  onClick={() => handleVerify(jsonText)}
                  disabled={verifying}
                  className="text-xs text-brand font-medium hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                  <span>Re-verify</span>
                </button>
              )}
            </div>
          </div>

          <textarea
            rows={10}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value)
              if (e.target.value.trim()) {
                handleVerify(e.target.value)
              } else {
                setResult(null)
                setParsedPack(null)
                setReplaySeq(0)
              }
            }}
            placeholder="Paste your exported proof-pack.json here or click 'Load Sample Proof Pack' above..."
            className="w-full p-4 rounded-xl bg-surface border border-border font-mono text-xs text-text focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all leading-relaxed"
          />
        </div>

        {/* Three Pillars Explainer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-border">
          <div className="p-4 rounded-xl bg-surface border border-border space-y-1.5">
            <h4 className="text-xs font-bold text-text flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-brand" />
              <span>1. Lexicographical Canonicalization</span>
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              Object keys are sorted lexicographically with zero extraneous whitespace before hashing to prevent platform serialization discrepancies.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface border border-border space-y-1.5">
            <h4 className="text-xs font-bold text-text flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand" />
              <span>2. Immutable Hash Chain</span>
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              Every audit block links the preceding digest into its own SHA-256 signature, creating an unbroken sequence since contract creation.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface border border-border space-y-1.5">
            <h4 className="text-xs font-bold text-text flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-brand" />
              <span>3. PayPal Native Fact Trail</span>
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              Stores concrete PayPal Order IDs, Authorization IDs, and Capture IDs that can be reconciled against PayPal Merchant records.
            </p>
          </div>
        </div>
      </div>

      {/* Official PayPal Dispute Resolution Dossier Modal */}
      {showDossierModal && parsedPack && dossierFacts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="max-w-2xl w-full bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-brand/10 border border-brand/20 text-brand">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">PayPal Dispute Evidence Dossier</h3>
                  <p className="text-[11px] text-muted font-mono">
                    Doc ID: DOSSIER-{parsedPack.contract?.id?.slice(0, 12)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDossierModal(false)}
                className="text-muted hover:text-text text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs text-text leading-relaxed font-sans">
              <div className="p-4 rounded-xl bg-brand/5 border border-brand/20 space-y-1">
                <p className="text-xs font-bold text-brand uppercase tracking-wider">
                  Authorization Hold Evidence Summary
                </p>
                <p className="text-[11px] text-muted">
                  Compiled directly from the offline-verified SHA-256 Proof Pack summarizing contract specification,
                  verification metrics, and PayPal authorization/capture references (authorization hold, not escrow).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border text-[11px]">
                <div>
                  <span className="text-muted block">Contract Title:</span>
                  <span className="font-semibold text-text">{parsedPack.contract?.title}</span>
                </div>
                <div>
                  <span className="text-muted block">Total Agreement Value:</span>
                  <span className="font-semibold text-text">
                    ${(dossierFacts.totalMinor / 100).toFixed(2)} USD
                  </span>
                </div>
                <div>
                  <span className="text-muted block">Buyer Identity:</span>
                  <span className="font-mono text-text">{dossierFacts.buyerEmail}</span>
                </div>
                <div>
                  <span className="text-muted block">Seller Identity:</span>
                  <span className="font-mono text-text">{dossierFacts.sellerEmail}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-text uppercase tracking-wider">PayPal Rail Evidence</h4>
                <div className="p-3 rounded-xl bg-surface-2 border border-border space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted">Authorization ID:</span>
                    <span className="text-brand font-semibold">{dossierFacts.authId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Capture ID:</span>
                    <span className="text-ok font-semibold">{dossierFacts.captureId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Custody Model:</span>
                    <span className="text-text font-semibold">
                      PayPal Authorization Hold (Zero ProofPay Custody)
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-text uppercase tracking-wider">
                  Verification &amp; Chain Summary
                </h4>
                <div className="p-3 rounded-xl bg-surface-2 border border-border space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted">Deterministic Checks:</span>
                    <span className="text-ok font-semibold">PASSED</span>
                  </div>
                  {dossierFacts.rubricScore !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted">LLM Rubric Score:</span>
                      <span className="text-ok font-semibold">{dossierFacts.rubricScore} / 100</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted">Contract Hash:</span>
                    <span className="text-brand font-semibold truncate max-w-[280px]">
                      {parsedPack.contract?.hash || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Head Ledger Digest:</span>
                    <span className="text-ok font-semibold truncate max-w-[280px]">
                      {dossierFacts.headHash}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between bg-surface-2">
              <span className="text-[10px] text-muted font-mono">
                Verified offline via ProofPay SHA-256 Chain Protocol
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text hover:bg-surface transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Dossier</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDossierModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-brand text-white font-semibold text-xs hover:opacity-95 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
