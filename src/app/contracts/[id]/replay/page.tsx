'use client'

/**
 * Contract Time-Travel Replay & Ledger Parity Screen — /contracts/[id]/replay
 * N2 Signature Feature:
 * Reconstructs contract & milestone states event-by-event from the append-only
 * SHA-256 ledger and verifies 1:1 parity with live PostgreSQL state.
 */
import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertOctagon,
  Layers,
  History,
  FileDown,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { PageShell } from '@/components/common/PageShell'
import { FundsBar } from '@/components/contract/FundsBar'
import { StatusChip } from '@/components/contract/StatusChip'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { formatMoney } from '@/components/common/Money'
import { useContract, useApiClient } from '@/lib/query'
import { replayUpToSeq, type LedgerEventInput } from '@/shared/ledger-reducer'
import type { LedgerEvent } from '@/shared/types'

interface ReplayPayload {
  contract_id: string
  chain_valid: boolean
  checked_events: number
  broken_at_seq: number | null
  events: LedgerEvent[]
}

interface StateCheckPayload {
  contract_id: string
  chain_valid: boolean
  checked_events: number
  broken_at_seq: number | null
  state_matches_ledger: boolean
  mismatches: Array<{
    scope: string
    field: string
    db_value: unknown
    ledger_value: unknown
  }>
}

export default function ContractReplayPage() {
  const params = useParams()
  const contractId = params?.id as string
  const api = useApiClient()

  const { data: contract } = useContract(contractId)
  const [replayData, setReplayData] = useState<ReplayPayload | null>(null)
  const [stateCheck, setStateCheck] = useState<StateCheckPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentSeq, setCurrentSeq] = useState<number>(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<1 | 4>(1)

  const fetchReplayData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [rep, chk] = await Promise.all([
        api.getContractReplay(contractId),
        api.getStateCheck(contractId),
      ])
      setReplayData(rep)
      setStateCheck(chk)
      if (rep.events.length > 0) {
        const last = rep.events[rep.events.length - 1]!
        setCurrentSeq(last.seq)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load contract replay stream')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (contractId) {
      fetchReplayData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId])

  const events = useMemo(() => {
    if (!replayData?.events) return []
    return [...replayData.events].sort((a, b) => a.seq - b.seq)
  }, [replayData?.events])

  const minSeq = events.length > 0 ? events[0]!.seq : 1
  const maxSeq = events.length > 0 ? events[events.length - 1]!.seq : 1

  // Auto-playback interval
  useEffect(() => {
    if (!isPlaying || events.length === 0) return
    const delayMs = speed === 4 ? 300 : 1000
    const timer = setInterval(() => {
      setCurrentSeq((prev) => {
        if (prev >= maxSeq) {
          setIsPlaying(false)
          return maxSeq
        }
        return prev + 1
      })
    }, delayMs)
    return () => clearInterval(timer)
  }, [isPlaying, speed, maxSeq, events.length])

  // Keyboard navigation (ArrowLeft / ArrowRight / Space)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIsPlaying(false)
        setCurrentSeq((s) => Math.max(minSeq, s - 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setIsPlaying(false)
        setCurrentSeq((s) => Math.min(maxSeq, s + 1))
      } else if (e.key === ' ') {
        e.preventDefault()
        if (currentSeq >= maxSeq) {
          setCurrentSeq(minSeq)
          setIsPlaying(true)
        } else {
          setIsPlaying((p) => !p)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [minSeq, maxSeq, currentSeq])

  const replayedState = useMemo(() => {
    if (events.length === 0) return null
    const inputs: LedgerEventInput[] = events.map((e) => ({
      seq: e.seq,
      type: e.type,
      actor_type: e.actor_type,
      actor_id: e.actor_id,
      payload: (e.payload as Record<string, any>) || {},
      created_at: e.created_at,
      hash: e.hash,
      prev_hash: e.prev_hash,
    }))
    return replayUpToSeq(inputs, currentSeq, contractId)
  }, [events, currentSeq, contractId])

  const selectedEvent = useMemo(
    () => events.find((e) => e.seq === currentSeq) ?? null,
    [events, currentSeq]
  )

  if (loading) {
    return (
      <PageShell title="Time-Travel Replay" backHref={`/contracts/${contractId}`}>
        <LoadingBlock message="Recomputing state from SHA-256 ledger chain…" />
      </PageShell>
    )
  }

  if (error || !replayData || !replayedState) {
    return (
      <PageShell title="Time-Travel Replay Error" backHref={`/contracts/${contractId}`}>
        <ErrorState
          title="Unable to Reconstruct Contract Replay"
          message={error || 'No ledger events found for this contract.'}
          onRetry={fetchReplayData}
        />
      </PageShell>
    )
  }

  // Merge DB milestone metadata (titles, amounts) with replayed ledger statuses
  const dbMilestones = contract?.milestones ?? []
  const displayMilestones =
    dbMilestones.length > 0
      ? dbMilestones.map((m) => {
          const replayed = replayedState.milestones[m.milestone_key]
          return {
            key: m.milestone_key,
            title: m.title,
            amount_minor: m.amount_minor,
            status: replayed?.status ?? 'PENDING',
            submissions_count: replayed?.submissions_count ?? 0,
            revisions_used: replayed?.revisions_used ?? 0,
            captured_minor: replayed?.captured_minor ?? 0,
            paypal_capture_id: replayed?.paypal_capture_id,
          }
        })
      : Object.values(replayedState.milestones).map((m) => ({
          key: m.key,
          title: `Milestone ${m.key}`,
          amount_minor: m.amount_minor,
          status: m.status,
          submissions_count: m.submissions_count,
          revisions_used: m.revisions_used,
          captured_minor: m.captured_minor,
          paypal_capture_id: m.paypal_capture_id,
        }))

  return (
    <PageShell
      title="Time-Travel Ledger Replay"
      subtitle={`Event-sourced state reconstruction for ${contract?.title || contractId}`}
      backHref={`/contracts/${contractId}`}
      backLabel="Back to Timeline"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchReplayData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text hover:bg-surface-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted" />
            <span>Re-check Parity</span>
          </button>

          <Link
            href={`/contracts/${contractId}/ledger`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text hover:bg-surface-2 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-muted" />
            <span>Ledger Grid</span>
          </Link>

          <a
            href={`/api/v1/contracts/${contractId}/proof-pack?format=json`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-text hover:bg-surface-2 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5 text-brand" />
            <span>Proof Pack</span>
          </a>

          <Link
            href="/verify"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 border border-brand/20 text-xs font-semibold text-brand hover:bg-brand/20 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Verify Offline</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6 pb-16">
        {/* Top Parity & Chain Integrity Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              replayData.chain_valid
                ? 'bg-ok/10 border-ok/30 text-ok'
                : 'bg-bad/10 border-bad/30 text-bad'
            }`}
          >
            {replayData.chain_valid ? (
              <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertOctagon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <h2 className="text-xs font-bold uppercase tracking-wider">
                {replayData.chain_valid
                  ? `SHA-256 Chain Intact (${replayData.checked_events} Events)`
                  : `Hash Chain Broken at Seq #${replayData.broken_at_seq}`}
              </h2>
              <p className="text-xs opacity-90">
                {replayData.chain_valid
                  ? 'Every sequential event hash and prev_hash pointer passed server-side cryptographic recomputation.'
                  : 'One or more ledger records failed canonical hash validation.'}
              </p>
            </div>
          </div>

          {stateCheck && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                stateCheck.state_matches_ledger
                  ? 'bg-ok/10 border-ok/30 text-ok'
                  : 'bg-bad/10 border-bad/30 text-bad'
              }`}
            >
              {stateCheck.state_matches_ledger ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertOctagon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <h2 className="text-xs font-bold uppercase tracking-wider">
                  {stateCheck.state_matches_ledger
                    ? 'State Matches Ledger (0 Mismatches)'
                    : `DB / Ledger Drift Detected (${stateCheck.mismatches.length})`}
                </h2>
                {stateCheck.state_matches_ledger ? (
                  <p className="text-xs opacity-90">
                    PostgreSQL contract &amp; milestone rows match the pure event-sourced state reduced from seq #1..#{maxSeq}.
                  </p>
                ) : (
                  <ul className="text-[11px] font-mono space-y-0.5">
                    {stateCheck.mismatches.map((mm, i) => (
                      <li key={i}>
                        {mm.scope}.{mm.field}: db={JSON.stringify(mm.db_value)} vs ledger=
                        {JSON.stringify(mm.ledger_value)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Scrubber & Playback Controls */}
        <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <History className="w-4 h-4 text-brand" />
              <h3 className="text-sm font-bold text-text">
                Timeline Scrubber · Frame {currentSeq} of {maxSeq}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-label="Jump to start"
                onClick={() => {
                  setIsPlaying(false)
                  setCurrentSeq(minSeq)
                }}
                className="p-1.5 rounded-lg border border-border bg-surface-2 text-text hover:border-brand/40 transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Previous event"
                disabled={currentSeq <= minSeq}
                onClick={() => {
                  setIsPlaying(false)
                  setCurrentSeq(Math.max(minSeq, currentSeq - 1))
                }}
                className="p-1.5 rounded-lg border border-border bg-surface-2 text-text hover:border-brand/40 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isPlaying && currentSeq >= maxSeq) {
                    setCurrentSeq(minSeq)
                  }
                  setIsPlaying(!isPlaying)
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:opacity-95 transition-opacity"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>
              <button
                type="button"
                aria-label="Next event"
                disabled={currentSeq >= maxSeq}
                onClick={() => {
                  setIsPlaying(false)
                  setCurrentSeq(Math.min(maxSeq, currentSeq + 1))
                }}
                className="p-1.5 rounded-lg border border-border bg-surface-2 text-text hover:border-brand/40 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Jump to latest"
                onClick={() => {
                  setIsPlaying(false)
                  setCurrentSeq(maxSeq)
                }}
                className="p-1.5 rounded-lg border border-border bg-surface-2 text-text hover:border-brand/40 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSpeed(speed === 1 ? 4 : 1)}
                className="px-2.5 py-1 rounded-lg border border-border bg-surface-2 text-xs font-mono font-semibold text-text hover:border-brand/40 transition-colors"
              >
                {speed}x
              </button>
            </div>
          </div>

          <input
            type="range"
            aria-label="Event sequence scrubber"
            min={minSeq}
            max={maxSeq}
            step={1}
            value={currentSeq}
            onChange={(e) => {
              setIsPlaying(false)
              setCurrentSeq(Number(e.target.value))
            }}
            className="w-full accent-brand cursor-pointer"
          />

          {/* Event Quick-Select Rail */}
          <div className="flex flex-wrap gap-1.5">
            {events.map((ev) => {
              const active = ev.seq === currentSeq
              return (
                <button
                  key={ev.seq}
                  type="button"
                  onClick={() => {
                    setIsPlaying(false)
                    setCurrentSeq(ev.seq)
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                    active
                      ? 'bg-brand text-white border-brand font-semibold'
                      : ev.seq < currentSeq
                        ? 'bg-surface-2 text-text border-border hover:border-brand/40'
                        : 'bg-surface text-muted border-border/60 hover:border-brand/40'
                  }`}
                >
                  #{ev.seq} {ev.type}
                </button>
              )
            })}
          </div>
        </div>

        {/* Reconstructed Money & State Frame */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StatusChip status={replayedState.status} size="md" />
                  <span className="text-xs font-mono text-muted">
                    Auth ID:{' '}
                    <strong className="text-text">
                      {replayedState.authorization_id || 'Pending authorization'}
                    </strong>
                  </span>
                </div>
                <span className="text-xs font-mono text-muted">
                  Reauths: {replayedState.reauthorizations_count} · Flags:{' '}
                  {replayedState.injection_flags_count}
                </span>
              </div>

              <FundsBar
                totalMinor={replayedState.total_minor || contract?.total_minor || 0}
                releasedMinor={replayedState.captured_minor}
                heldMinor={replayedState.remaining_minor}
                voidedMinor={replayedState.voided_minor}
              />
            </div>

            {/* Milestone Snapshot Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Milestone States at Seq #{currentSeq}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayMilestones.map((m) => (
                  <div
                    key={m.key}
                    className="p-4 rounded-xl bg-surface border border-border space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-text truncate">
                        [{m.key}] {m.title}
                      </span>
                      <StatusChip status={m.status} size="sm" />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted font-mono">
                      <span>Amount: {formatMoney(m.amount_minor)}</span>
                      <span>
                        Subs: {m.submissions_count} · Rev: {m.revisions_used}
                      </span>
                    </div>
                    {m.paypal_capture_id && (
                      <div className="text-[10px] font-mono text-ok truncate">
                        Capture ID: {m.paypal_capture_id}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Rail: Current Event Payload & Hash Proof */}
          {selectedEvent && (
            <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-4 h-fit">
              <div className="space-y-1 pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-brand">
                    Event #{selectedEvent.seq}
                  </span>
                  <span className="text-[11px] font-mono uppercase text-muted">
                    {selectedEvent.actor_type}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-text break-words">
                  {selectedEvent.type}
                </h3>
                <p className="text-[11px] font-mono text-muted">
                  {new Date(selectedEvent.created_at).toISOString()}
                </p>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono">
                <div>
                  <span className="text-muted block">Previous Hash:</span>
                  <span className="text-text break-all">{selectedEvent.prev_hash}</span>
                </div>
                <div>
                  <span className="text-muted block">Block SHA-256 Digest:</span>
                  <span className="text-ok break-all">{selectedEvent.hash}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                  Canonical Event Payload
                </span>
                <pre className="p-3 rounded-xl bg-surface-2 border border-border text-[11px] font-mono text-text overflow-x-auto max-h-72 leading-relaxed">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}

