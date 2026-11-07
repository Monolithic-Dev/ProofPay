'use client'

import React, { useState, useEffect } from 'react'
import { PageShell } from '@/components/common/PageShell'
import {
  Gavel,
  ShieldAlert,
  Scale,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Play,
  Pause,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Send,
  Zap,
  Code,
  Layers,
  Bot,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { SCENARIOS, type DisputeScenario, type TribunalTurn } from '@/app/api/v1/demo/tribunal/route'

export default function TribunalDemoPage() {
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0)
  const activeScenario: DisputeScenario = SCENARIOS[selectedScenarioIndex] ?? SCENARIOS[0]!

  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showVerdict, setShowVerdict] = useState(false)

  // Auto-run stepper when isPlaying
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isPlaying) {
      if (currentTurnIndex < activeScenario.turns.length - 1) {
        timer = setTimeout(() => {
          setCurrentTurnIndex((prev) => prev + 1)
        }, 3000)
      } else {
        timer = setTimeout(() => {
          setShowVerdict(true)
          setIsPlaying(false)
        }, 2000)
      }
    }
    return () => clearTimeout(timer)
  }, [isPlaying, currentTurnIndex, activeScenario.turns.length])

  const handleSelectScenario = (index: number) => {
    setSelectedScenarioIndex(index)
    setCurrentTurnIndex(0)
    setIsPlaying(false)
    setShowVerdict(false)
  }

  const handleNextTurn = () => {
    if (currentTurnIndex < activeScenario.turns.length - 1) {
      setCurrentTurnIndex((prev) => prev + 1)
    } else {
      setShowVerdict(true)
    }
  }

  const handleReset = () => {
    setCurrentTurnIndex(0)
    setIsPlaying(false)
    setShowVerdict(false)
  }

  const currentTurn: TribunalTurn = activeScenario.turns[currentTurnIndex] ?? activeScenario.turns[0]!

  return (
    <PageShell
      title="Multi-Agent AI Dispute Tribunal"
      subtitle="Autonomous LLM agents debate disputed deliverables and issue binding PayPal settlements on-chain"
    >
      <div className="space-y-8 max-w-6xl pb-24">
        {/* Top Feature Banner */}
        <div className="p-5 rounded-2xl bg-surface-2 border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Scale className="w-5 h-5 flex-shrink-0" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-text">ProofPay Autonomous Dispute Resolution Protocol (ADRP)</h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 font-semibold">
                  Zero Human Support Overhead
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed max-w-3xl">
                When deliverable scores fall into ambiguous territory, ProofPay convenes a 3-agent AI courtroom. 
                Agents cross-examine git diffs, benchmark evidence, and contract rubrics to issue deterministic PayPal v2 partial captures or hold voids.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/demo/agent-wallet"
              className="px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-semibold text-text hover:border-brand/40 transition-all flex items-center gap-1.5"
            >
              <Bot className="w-3.5 h-3.5 text-brand" />
              <span>Agent Wallet Guardrail</span>
            </Link>
            <Link
              href="/verify"
              className="px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-semibold text-text hover:border-brand/40 transition-all flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-brand" />
              <span>Cryptographic Verifier</span>
            </Link>
          </div>
        </div>

        {/* Scenario Switcher */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted uppercase tracking-wider">
            Select Active Dispute Scenario:
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SCENARIOS.map((sc, idx) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleSelectScenario(idx)}
                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
                  selectedScenarioIndex === idx
                    ? 'bg-purple-500/10 border-purple-500/50 shadow-md shadow-purple-500/5'
                    : 'bg-surface border-border hover:border-border-hover'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-text">{sc.title}</span>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-surface-2 text-brand border border-brand/20">
                    ${(sc.holdAmountMinor / 100).toFixed(2)} USD Hold
                  </span>
                </div>
                <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                  {sc.contractTitle}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Dispute Summary Card */}
        <div className="p-4 rounded-xl bg-surface border border-border grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 border-r-0 md:border-r border-border pr-0 md:pr-4">
            <span className="text-[10px] uppercase font-bold text-bad flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Buyer Claim (Prosecution)</span>
            </span>
            <p className="text-xs text-text leading-relaxed font-sans">{activeScenario.buyerClaim}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-ok flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Seller Defense (Respondent)</span>
            </span>
            <p className="text-xs text-text leading-relaxed font-sans">{activeScenario.sellerDefense}</p>
          </div>
        </div>

        {/* Three Agent Podiums */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Buyer Advocate */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              currentTurn.speaker === 'buyer_advocate'
                ? 'bg-red-500/10 border-red-500/50 ring-2 ring-red-500/20'
                : 'bg-surface border-border opacity-70'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🛡️</span>
              <div>
                <h4 className="text-xs font-bold text-text">SentinelBot</h4>
                <p className="text-[10px] text-muted">Buyer Advocate LLM</p>
              </div>
            </div>
            <p className="text-[11px] text-muted">
              Presents evidence of defective deliveries, schema non-compliance, and requests PayPal authorization voids.
            </p>
          </div>

          {/* Neutral Arbitrator */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              currentTurn.speaker === 'neutral_arbitrator'
                ? 'bg-purple-500/15 border-purple-500/60 ring-2 ring-purple-500/30'
                : 'bg-surface border-border opacity-70'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">⚖️</span>
              <div>
                <h4 className="text-xs font-bold text-text">JusticeBot</h4>
                <p className="text-[10px] text-muted">Chief AI Arbitrator</p>
              </div>
            </div>
            <p className="text-[11px] text-muted">
              Evaluates rubric thresholds impartially, determines delivery value, and emits binding PayPal settlement instructions.
            </p>
          </div>

          {/* Seller Defense */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              currentTurn.speaker === 'seller_defense'
                ? 'bg-blue-500/10 border-blue-500/50 ring-2 ring-blue-500/20'
                : 'bg-surface border-border opacity-70'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🛠️</span>
              <div>
                <h4 className="text-xs font-bold text-text">LexiBot</h4>
                <p className="text-[10px] text-muted">Seller Defense LLM</p>
              </div>
            </div>
            <p className="text-[11px] text-muted">
              Defends deliverable compliance against objective contract parameters, git commit logs, and validation hashes.
            </p>
          </div>
        </div>

        {/* Live Debate Courtroom Transcript */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-2">
              <Gavel className="w-4 h-4 text-purple-400" />
              <span>Tribunal Transcript (Argument {currentTurnIndex + 1} of {activeScenario.turns.length})</span>
            </h3>

            {/* Stepper Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isPlaying
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'bg-purple-600 text-white hover:bg-purple-500'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Auto Play'}</span>
              </button>

              <button
                type="button"
                onClick={handleNextTurn}
                disabled={isPlaying || (currentTurnIndex === activeScenario.turns.length - 1 && showVerdict)}
                className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-semibold text-text hover:border-brand/40 transition-all flex items-center gap-1.5 disabled:opacity-40"
              >
                <span>Next Argument</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="p-1.5 rounded-lg border border-border hover:bg-surface text-muted hover:text-text transition-all"
                title="Reset Debate"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Active Statement Box */}
          <div className="p-6 rounded-2xl bg-surface border border-border space-y-4 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{currentTurn.avatar}</span>
                <div>
                  <h4 className="text-sm font-bold text-text flex items-center gap-2">
                    <span>{currentTurn.speakerName}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 text-muted border border-border">
                      {currentTurn.roleTitle}
                    </span>
                  </h4>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-muted">Confidence: </span>
                <span className="text-xs font-mono font-bold text-brand">
                  {(currentTurn.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <p className="text-sm text-text leading-relaxed font-sans">
              "{currentTurn.statement}"
            </p>

            {currentTurn.citedEvidence && (
              <div className="p-3 rounded-xl bg-surface-2 border border-border flex items-start gap-2.5 text-xs text-muted">
                <Code className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5 font-mono text-[11px]">
                  <span className="text-text font-semibold block">Evidence In Evidence Log:</span>
                  <span>{currentTurn.citedEvidence}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Binding Verdict & PayPal Rail Action */}
        {(showVerdict || currentTurnIndex === activeScenario.turns.length - 1) && (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-500/10 via-brand/5 to-surface-2 border border-purple-500/30 space-y-5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                  <Gavel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">Binding AI Arbitration Ruling</h3>
                  <p className="text-xs text-muted font-mono">{activeScenario.verdict.summary}</p>
                </div>
              </div>

              <span className="text-xs font-bold font-mono px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {activeScenario.verdict.paypalAction}
              </span>
            </div>

            <p className="text-xs text-text leading-relaxed font-sans bg-surface/60 p-3.5 rounded-xl border border-border">
              ⚖️ <strong>Arbitrator Justification:</strong> {activeScenario.verdict.bindingJustification}
            </p>

            {/* Split Visual Meter */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono font-semibold">
                <span className="text-ok">
                  Seller Captured: ${(activeScenario.verdict.sellerCaptureMinor / 100).toFixed(2)} USD ({activeScenario.verdict.sellerCapturePercent}%)
                </span>
                <span className="text-bad">
                  Buyer Hold Voided: ${(activeScenario.verdict.buyerVoidMinor / 100).toFixed(2)} USD ({100 - activeScenario.verdict.sellerCapturePercent}%)
                </span>
              </div>
              <div className="w-full h-3 bg-surface-2 rounded-full overflow-hidden flex border border-border">
                <div
                  style={{ width: `${activeScenario.verdict.sellerCapturePercent}%` }}
                  className="bg-ok h-full transition-all duration-500"
                />
                <div
                  style={{ width: `${100 - activeScenario.verdict.sellerCapturePercent}%` }}
                  className="bg-bad h-full transition-all duration-500"
                />
              </div>
            </div>

            {/* PayPal v2 API Rail Execution Block */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-muted uppercase font-bold">
                  PayPal v2 Settlement Transaction Payload
                </span>
                <span className="text-[10px] font-mono text-ok flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Authorized on PayPal Rails</span>
                </span>
              </div>
              <pre className="p-4 rounded-xl bg-surface border border-border font-mono text-xs text-brand overflow-x-auto">
                {JSON.stringify(activeScenario.verdict.paypalPayload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
