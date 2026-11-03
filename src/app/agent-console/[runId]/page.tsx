'use client'

/**
 * Agent Console Screen (S7) — Real-time autonomous agent transaction monitor.
 * Implements phase-7-agents-judge-mode-mcp.md §7.4 & ux-flows.md S7.
 */
import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  Radio,
  Lock,
  User,
  Bot,
  Copy,
  Check,
} from 'lucide-react'
import { useApiClient, useContract } from '@/lib/query'
import { useDemoRunEvents, type DemoRunEventItem } from '@/lib/sse'
import { FundsBar } from '@/components/contract/FundsBar'
import { StatusChip } from '@/components/contract/StatusChip'
import { formatMoney } from '@/components/common/Money'

export default function AgentConsolePage() {
  const params = useParams()
  const router = useRouter()
  const runId = params?.runId as string
  const api = useApiClient()

  const { events: streamEvents, status: streamStatus, contractId: streamContractId, isConnected } = useDemoRunEvents(runId)
  const [initialDataLoaded, setInitialDataLoaded] = useState(false)
  const [dbEvents, setDbEvents] = useState<DemoRunEventItem[]>([])
  const [scenarioName, setScenarioName] = useState<string>('')
  const [contractId, setContractId] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<string>('RUNNING')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [expandedPayloads, setExpandedPayloads] = useState<Record<number, boolean>>({})

  const transcriptBottomRef = useRef<HTMLDivElement | null>(null)

  // 1. Initial REST fetch for run status and events
  useEffect(() => {
    if (!runId) return

    api.getDemoRun(runId)
      .then((res: any) => {
        const run = res.run || res
        if (run) {
          setScenarioName(run.scenario || '')
          setRunStatus(run.status || 'RUNNING')
          if (run.contract_id) setContractId(run.contract_id)
          if (Array.isArray(run.events)) {
            setDbEvents(run.events)
          }
          setInitialDataLoaded(true)
        }
      })
      .catch(() => {
        setInitialDataLoaded(true)
      })
  }, [runId, api])

  // Sync stream updates
  useEffect(() => {
    if (streamStatus) setRunStatus(streamStatus)
    if (streamContractId) setContractId(streamContractId)
  }, [streamStatus, streamContractId])

  // Merge events (avoiding duplicates)
  const allEvents = streamEvents.length > dbEvents.length ? streamEvents : dbEvents

  // Elapsed timer
  useEffect(() => {
    if (runStatus === 'DONE' || runStatus === 'FAILED') return
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [runStatus])

  // Auto-scroll transcript on new events
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [allEvents.length])

  // Fetch contract data for right-side telemetry
  const { data: contract } = useContract(contractId)

  // Find waiting data if present
  const waitingEvent = allEvents.find((e) => e.kind === 'waiting' && e.data?.approval_url)
  const approvalUrl = (waitingEvent?.data?.approval_url as string) || null

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const togglePayload = (idx: number) => {
    setExpandedPayloads((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  const formatElapsedTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const getActorBadge = (actor: string) => {
    switch (actor) {
      case 'buyer_agent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Bot className="w-3 h-3" />
            ProcureBot (Buyer Agent)
          </span>
        )
      case 'worker_agent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Bot className="w-3 h-3" />
            SynthetixBot (Worker Agent)
          </span>
        )
      case 'protocol':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border border-zinc-500/20">
            <Lock className="w-3 h-3" />
            ProofPay Protocol
          </span>
        )
      case 'human':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <User className="w-3 h-3" />
            You (Human Payer)
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-2 text-muted border border-border">
            {actor}
          </span>
        )
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text pb-16">
      {/* Top Navigation Bar */}
      <header className="border-b border-border bg-surface sticky top-0 z-20 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/studio"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Studio Dashboard
            </Link>
            <span className="text-border">/</span>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-text">Agent Console</h1>
              <span className="text-xs text-muted font-mono">({scenarioName || 'Autonomous Run'})</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted font-mono bg-surface-2 px-2.5 py-1 rounded border border-border">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatElapsedTime(elapsedSeconds)}</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border font-mono">
              <Radio
                className={`w-3 h-3 ${
                  isConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'
                }`}
              />
              <span className="text-muted">{isConnected ? 'Live Telemetry' : 'Syncing'}</span>
            </div>

            <div
              className={`text-xs font-semibold px-2.5 py-1 rounded border ${
                runStatus === 'DONE'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : runStatus === 'WAITING_FOR_BUYER'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse'
                  : runStatus === 'FAILED'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
              }`}
            >
              {runStatus === 'WAITING_FOR_BUYER' ? 'WAITING FOR PAYER' : runStatus}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Agent Transcript & Human Intervention */}
          <section className="lg:col-span-7 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-text">Transaction Transcript</h2>
                <p className="text-xs text-muted mt-0.5">
                  Autonomous communication between buyer agent, worker agent, and ProofPay escrow.
                </p>
              </div>
              <span className="text-xs text-muted font-mono">{allEvents.length} events logged</span>
            </div>

            {/* Pinned Waiting Card for PayPal Sandbox Approval */}
            {runStatus === 'WAITING_FOR_BUYER' && approvalUrl && (
              <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 text-text shadow-sm space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      Human Escrow Approval Required
                    </h3>
                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                      Autonomous agents agreed on the contract terms. To authorize the PayPal hold ($100.00 USD), please approve the hold in the sandbox window. Funds remain locked in escrow until verification passes.
                    </p>
                  </div>
                </div>

                {/* Sandbox Credentials Banner */}
                <div className="p-2.5 rounded-lg bg-surface border border-border text-xs space-y-1.5 font-mono">
                  <div className="text-[11px] font-sans font-semibold text-muted">
                    Sandbox Buyer Credentials:
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Email:</span>
                    <div className="flex items-center gap-1.5 font-medium">
                      <span>buyer-sandbox@demo.proofpay</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('email', 'buyer-sandbox@demo.proofpay')}
                        className="text-muted hover:text-text"
                        title="Copy email"
                      >
                        {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Password:</span>
                    <span className="font-medium">Sandbox123!</span>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-3">
                  <a
                    href={approvalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open PayPal Sandbox Window
                  </a>
                  <span className="text-[11px] text-muted italic">
                    ProofPay will automatically resume once the hold is confirmed.
                  </span>
                </div>
              </div>
            )}

            {/* End State Card */}
            {runStatus === 'DONE' && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-text shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                      Autonomous Scenario Execution Complete
                    </h3>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                      All criteria verified. Escrow releases were processed and recorded on the immutable ledger.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {contractId && (
                    <>
                      <Link
                        href={`/contracts/${contractId}/ledger`}
                        className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-surface border border-border text-xs font-medium hover:border-text transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                        Inspect Cryptographic Ledger
                      </Link>

                      <a
                        href={`/api/v1/contracts/${contractId}/proof-pack?format=pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-surface border border-border text-xs font-medium hover:border-text transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-muted" />
                        Download Audit Proof Pack (PDF)
                      </a>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Event Stream Container */}
            <div className="space-y-3">
              {allEvents.length === 0 && (
                <div className="p-8 rounded-xl bg-surface border border-border text-center text-xs text-muted">
                  Initializing scenario context and provisioning agent credentials...
                </div>
              )}

              {allEvents.map((ev, idx) => {
                const isExpanded = Boolean(expandedPayloads[idx])
                const hasData = ev.data && Object.keys(ev.data).length > 0
                const timeStr = ev.t ? new Date(ev.t).toLocaleTimeString() : ''

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-surface border border-border shadow-sm space-y-2 hover:border-border/80 transition-all text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getActorBadge(ev.actor)}
                        <span className="text-[11px] text-muted font-mono">{timeStr}</span>
                      </div>

                      {hasData && (
                        <button
                          type="button"
                          onClick={() => togglePayload(idx)}
                          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text"
                        >
                          {isExpanded ? (
                            <>
                              Hide details <ChevronUp className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              Inspect payload <ChevronDown className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-text leading-relaxed font-sans">{ev.text}</p>

                    {isExpanded && hasData && (
                      <div className="mt-2 p-2.5 rounded bg-surface-2 border border-border font-mono text-[11px] overflow-x-auto text-muted max-h-48">
                        <pre>{JSON.stringify(ev.data, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={transcriptBottomRef} />
            </div>
          </section>

          {/* Right Column: Live Contract Telemetry */}
          <aside className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-text">Contract State</h2>
                <p className="text-xs text-muted mt-0.5">Live PayPal escrow hold and milestone status.</p>
              </div>
              {contractId && (
                <Link
                  href={`/contracts/${contractId}`}
                  className="text-xs text-brand hover:underline inline-flex items-center gap-1"
                >
                  View Contract <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>

            {contract ? (
              <div className="space-y-4">
                {/* Funds Bar */}
                <div className="p-4 rounded-xl bg-surface border border-border shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text">Escrow Balance</span>
                    <span className="text-xs font-mono font-bold text-text">
                      {formatMoney(contract.total_minor || 10000)}
                    </span>
                  </div>

                  {(() => {
                    const totalMinor = contract.total_minor || 10000
                    const releasedMinor =
                      contract.milestones
                        ?.filter((m) => m.status === 'RELEASED')
                        .reduce((sum, m) => sum + m.amount_minor, 0) || 0
                    const heldMinor = Math.max(0, totalMinor - releasedMinor)

                    return (
                      <FundsBar
                        totalMinor={totalMinor}
                        releasedMinor={releasedMinor}
                        heldMinor={heldMinor}
                        voidedMinor={0}
                      />
                    )
                  })()}

                  {contract.authorization_id && (
                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted font-mono">
                      <span>Auth ID:</span>
                      <span className="truncate max-w-[200px] text-text font-medium">
                        {contract.authorization_id}
                      </span>
                    </div>
                  )}
                </div>

                {/* Contract Summary Card */}
                <div className="p-4 rounded-xl bg-surface border border-border shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-text">{contract.title}</h3>
                      <p className="text-[11px] text-muted font-mono mt-0.5 truncate max-w-[260px]">
                        ID: {contract.id}
                      </p>
                    </div>
                    <StatusChip status={contract.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
                    <div>
                      <span className="text-muted block text-[11px]">Buyer:</span>
                      <span className="font-medium text-text">ProcureBot</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[11px]">Worker:</span>
                      <span className="font-medium text-text">SynthetixBot</span>
                    </div>
                  </div>
                </div>

                {/* Milestones Breakdown */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Milestones ({contract.milestones?.length || 0})
                  </h4>

                  {contract.milestones?.map((m) => (
                    <div
                      key={m.milestone_key}
                      className="p-3.5 rounded-xl bg-surface border border-border shadow-sm space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-text">
                            {m.milestone_key.toUpperCase()}
                          </span>
                          <span className="text-muted font-medium truncate max-w-[180px]">
                            {m.title}
                          </span>
                        </div>
                        <StatusChip status={m.status} />
                      </div>

                      <div className="flex items-center justify-between text-muted text-[11px] pt-1 border-t border-border/60">
                        <span>Allocation:</span>
                        <span className="font-mono font-semibold text-text">
                          {formatMoney(m.amount_minor)}
                        </span>
                      </div>

                      {m.latest_verification && (
                        <div className="pt-1 text-[11px] text-muted flex items-center justify-between">
                          <span>Verification:</span>
                          <span
                            className={
                              m.latest_verification.status === 'COMPLETE'
                                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                : 'text-amber-600 dark:text-amber-400 font-medium'
                            }
                          >
                            {m.latest_verification.status}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-surface border border-border text-center text-xs text-muted">
                Contract is being compiled and proposed by autonomous agents...
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  )
}
