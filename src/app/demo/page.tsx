'use client'

import React from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { ScrollReveal } from '@/components/common/ScrollReveal'
import { JudgePanel } from '@/components/judge/JudgePanel'
import {
  ArrowLeft,
  Zap,
  ArrowRight,
  Cpu,
  Scale,
  Wallet,
  SearchCode,
  ShieldAlert,
} from 'lucide-react'

export default function DemoPlaygroundPage() {
  return (
    <PageShell
      title="Sandbox Playground"
      subtitle="Test multi-agent transactions, adversarial prompt injections, contract loophole red-teaming, and PayPal sandbox holds without manual setup."
      backHref="/"
      backLabel="Back to Home"
      maxWidth="6xl"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/demo/express"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-500/20"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>90s Express Lane</span>
          </Link>
          <Link
            href="/contracts"
            className="px-3.5 py-1.5 rounded-xl bg-surface-2 border border-border text-text text-xs font-semibold hover:bg-surface-2/80 transition-colors"
          >
            Workspace &rarr;
          </Link>
        </div>
      }
    >
      <div className="space-y-8">

      {/* Feature Callouts 6-Grid: Express Lane, Loophole Finder, MCP Simulator, AI Tribunal, Agent Wallet, Resilience Lab */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Callout 1: 90s Express Judge Lane */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-brand/10 via-surface to-surface border border-brand/30 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-brand/10 text-brand flex-shrink-0 mt-0.5">
              <Zap className="w-5 h-5 fill-brand text-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm font-bold text-text">
                  90-Second Express Judge Sandbox
                </strong>
                <span className="px-1.5 py-0.2 rounded bg-brand/10 text-brand text-[10px] font-mono font-bold">
                  PRE-AUTHORIZED
                </span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Experience the full PayPal payment lifecycle: authorization hold &rarr; AI verify &rarr; partial capture in &lt; 90 seconds without logging into PayPal.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/demo/express"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover transition-all shadow-sm"
            >
              <span>Launch 90s Express Lane</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Callout 2: N1 Loophole Finder */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-500/10 via-surface to-surface border border-orange-500/30 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 flex-shrink-0 mt-0.5">
              <SearchCode className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm font-bold text-text">
                  N1 Adversarial Loophole Finder
                </strong>
                <span className="px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-400 text-[10px] font-mono font-bold">
                  RED-TEAM &amp; PATCH
                </span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Attack your own contract rules with schema-valid exploit payloads (Lorem Ipsum spam, duplicate SKUs, banned copy), prove the bypass in code, and seal it via RFC 6902 in one click.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/demo/loophole"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-all shadow-sm"
            >
              <span>Launch Loophole Finder</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Callout 3: In-Browser MCP Agent Simulator */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 via-surface to-surface border border-purple-500/30 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 flex-shrink-0 mt-0.5">
              <Cpu className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm font-bold text-text">
                  In-Browser MCP Agent Simulator
                </strong>
                <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 text-[10px] font-mono font-bold">
                  AUTONOMOUS
                </span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Watch Claude and Gemini execute the 6 ProofPay MCP tools via JSON-RPC: create contracts, inspect status, and submit deliverables under bounded human funding policies.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/demo/mcp"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-all shadow-sm"
            >
              <span>Open MCP Simulator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Callout 4: Multi-Agent AI Dispute Tribunal */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-surface to-surface border border-indigo-500/30 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 flex-shrink-0 mt-0.5">
              <Scale className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm font-bold text-text">
                  Multi-Agent AI Dispute Tribunal
                </strong>
                <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 text-[10px] font-mono font-bold">
                  ARBITRATION
                </span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Three autonomous LLM agents (Buyer Advocate, Seller Defense, and Chief Arbitrator) debate ambiguous deliverables with grounded evidence recommendations before human sign-off.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/demo/tribunal"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
            >
              <span>Enter AI Tribunal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Callout 5: PayPal Agent Spend Policy Guardrail */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-surface to-surface border border-emerald-500/30 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 flex-shrink-0 mt-0.5">
              <Wallet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm font-bold text-text">
                  PayPal Agent Spend Policy Guardrail
                </strong>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 text-[10px] font-mono font-bold">
                  AGENTIC COMMERCE
                </span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Safely delegate bounded workflow scopes to autonomous AI agents with milestone caps, human approval requirements, and prompt injection filters.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/demo/agent-wallet"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
            >
              <span>Explore Agent Wallet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Callout 6: Chaos Resilience Lab */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-red-500/10 via-surface to-surface border border-red-500/30 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 flex-shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm font-bold text-text">
                  N3 Chaos Resilience Lab
                </strong>
                <span className="px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 text-[10px] font-mono font-bold">
                  MONEY INVARIANT
                </span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Inject synthetic PayPal 504 timeouts, duplicate webhook replays, worker pauses, and LLM outages while preserving zero double captures.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/demo/lab"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all shadow-sm"
            >
              <span>Open Resilience Lab</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Scenarios and Persona Switcher */}
      <JudgePanel />
      </div>
    </PageShell>
  )
}
