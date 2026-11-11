'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ScrollReveal } from '@/components/common/ScrollReveal'
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Database,
  Terminal,
  Zap,
  DollarSign,
  Scale,
  Briefcase,
  Users,
  Bot,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  ExternalLink,
  Layers,
  Sparkles,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react'

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [copiedMcp, setCopiedMcp] = useState(false)

  const faqs = [
    {
      q: 'What is an authorization hold and how long does it last?',
      a: 'A PayPal authorization hold reserves funds on the buyer’s chosen funding source without charging them upfront. PayPal holds the funds for up to 29 days. Money only leaves the buyer’s account when a milestone is verified and captured.',
    },
    {
      q: 'Is this escrow?',
      a: 'No. ProofPay is not an escrow agent and never custodies, pools, or touches user money. Funds remain entirely with PayPal inside an authorization hold on the buyer’s account, and PayPal moves money directly to the seller upon verified capture.',
    },
    {
      q: 'What if the AI makes a mistake or is manipulated?',
      a: 'AI does not have payment authority. ProofPay enforces a strict hierarchy: deterministic rules and schema validations run first, while the LLM acts solely as an advisory reviewer that must cite verbatim evidence quotes from the deliverable. If a check is borderline or contested, it escalates to human buyer review.',
    },
    {
      q: 'Who pays platform and transaction fees?',
      a: 'During our current Sandbox release, ProofPay charges no platform fees in Sandbox test mode. When real-money routing launches in R2 via PayPal Partner Referrals, platform fees will be disclosed upfront on each milestone release.',
    },
    {
      q: 'Can my autonomous AI agent use ProofPay?',
      a: 'Yes. ProofPay provides dedicated Service Accounts with granular permission scopes (e.g., contracts:write, submissions:write) and strict financial budget caps. AI agents can draft contracts and submit work programmatically via our REST API or Model Context Protocol (MCP) server.',
    },
    {
      q: 'Is my deliverable code and data safe?',
      a: 'Yes. Submitted artifacts are evaluated inside hardened, isolated execution environments. Full deliverable contents are never posted to public ledgers or shared externally; only cryptographic SHA-256 hashes and verified audit proofs are recorded.',
    },
  ]

  const mcpSnippet = `{
  "mcpServers": {
    "proofpay": {
      "command": "npx",
      "args": ["-y", "@proofpay/mcp-server"],
      "env": {
        "PROOFPAY_API_KEY": "pp_k_your_agent_key",
        "PROOFPAY_BASE_URL": "http://localhost:3000"
      }
    }
  }
}`

  const handleCopyMcp = () => {
    navigator.clipboard.writeText(mcpSnippet)
    setCopiedMcp(true)
    setTimeout(() => setCopiedMcp(false), 2000)
  }

  return (
    <div className="flex flex-col min-h-screen gradient-mesh">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-24 md:pt-32 md:pb-40 border-b border-border bg-grid-pattern">
        {/* Magic UI / RareUI Ambient Radial Glows & Concentric Rings */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[900px] h-[450px] bg-gradient-to-tr from-sky-500/20 via-blue-600/15 to-purple-600/20 blur-[140px] rounded-full pointer-events-none -z-10 animate-pulse-slow" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/80 to-bg pointer-events-none -z-10" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 relative z-10">
          {/* Glowing Animated Pill (21st.dev / Magic UI pattern) */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface-2/90 backdrop-blur-xl border border-sky-500/30 text-text text-xs font-semibold shadow-lg shadow-sky-500/10 hover:border-sky-500/50 transition-all cursor-default">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-muted">Zero-Custody Authorization Hold (Not Escrow) · Powered by</span>
            <span className="font-extrabold text-text flex items-center gap-1">
              <span className="text-sky-400">PayPal</span> Rails
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-text leading-[1.05]">
            Get paid for work that’s{' '}
            <span className="relative whitespace-nowrap">
              <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                proven.
              </span>
              <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 rounded-full blur-[1px]"></span>
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted leading-relaxed font-normal">
            ProofPay establishes a PayPal authorization hold before work starts, releasing payment milestone by
            milestone only after deliverables meet cryptographic criteria verified by deterministic analyzers
            and dual-LLM consensus.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/demo/express"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.03] active:scale-[0.98] group"
            >
              <span>Launch 90-Second Express Sandbox</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/auth/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl glass-card border border-border/80 text-text font-bold hover:bg-surface-2 transition-all text-sm shadow-md hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Enterprise Sign In</span>
            </Link>
          </div>

          {/* Social Proof / Trust Indicators with subtle glow */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 pt-4 text-xs text-muted font-medium">
            <span className="flex items-center gap-2 bg-surface/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-border/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Zero-Custody Protocol</span>
            </span>
            <span className="flex items-center gap-2 bg-surface/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-border/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Machine-Verifiable ProofPacks™</span>
            </span>
            <span className="flex items-center gap-2 bg-surface/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-border/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>RFC 3161 External TSA</span>
            </span>
          </div>
        </div>
      </section>

      {/* Infinite Logo / Capability Marquee Banner (RareUI / MagicUI Pattern) */}
      <section className="py-6 border-b border-border/60 bg-surface/40 overflow-hidden relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />
        
        <div className="flex w-max animate-marquee space-x-12 items-center text-xs font-bold uppercase tracking-wider text-muted/70">
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>PayPal Orders v2 API</span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>RFC 3161 Timestamping</span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>Claude & Gemini JSON-RPC MCP</span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>SHA-256 Merkle Audit Chain</span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Deterministic ProofPack™ Verification</span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>OpenTelemetry Enterprise Tracing</span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>PayPal Orders v2 API</span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>RFC 3161 Timestamping</span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>Claude & Gemini JSON-RPC MCP</span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>SHA-256 Merkle Audit Chain</span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Deterministic ProofPack™ Verification</span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>OpenTelemetry Enterprise Tracing</span>
        </div>
      </section>

      {/* Product Visual Showcase: Interactive Component Previews */}
      <section className="py-20 border-b border-border bg-surface/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <ScrollReveal animation="fade-up">
            <div className="text-center space-y-3">
              <span className="text-xs uppercase font-extrabold tracking-widest text-brand dark:text-sky-400">
                Built Like Real Financial Software
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text">
                Real-time holds, cryptographic proof, and transparent releases
              </h2>
              <p className="text-sm text-muted max-w-2xl mx-auto">
                Every deliverable is proven via deterministic analyzers and signed into a tamper-evident audit chain before PayPal capture.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Visual Component 1: Funds Bar Card */}
            <div className="p-7 rounded-2xl glass-card border border-border/80 shadow-xl space-y-6 hover:border-brand/40 transition-all duration-300">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-text block">Funds Bar &amp; PayPal Hold</span>
                    <span className="text-[11px] text-muted">Two-Phase Authorization Status</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                  Authorized on PayPal
                </span>
              </div>

              {/* Funds Bar Visual Representation */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Total Authorized: <strong className="text-text font-bold">$1,200.00</strong></span>
                  <span className="text-emerald-400 font-bold">$600.00 Released (50%)</span>
                </div>

                {/* Multi-segment progress bar */}
                <div className="h-3.5 w-full bg-surface-2 rounded-full overflow-hidden flex p-0.5 border border-border/60">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-l-full transition-all duration-500" style={{ width: '50%' }} title="Released: $600.00" />
                  <div className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-r-full transition-all duration-500" style={{ width: '50%' }} title="Held on PayPal: $600.00" />
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                    <span>Captured to seller: $600.00</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-sm" />
                    <span>Remaining in hold: $600.00</span>
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-2/80 border border-border/60 text-xs text-muted space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-text">
                  <ShieldCheck className="w-4 h-4 text-brand" />
                  <span>Up to 29-day authorization window</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Funds stay with the buyer&apos;s PayPal account until verified. If deliverables aren&apos;t approved within the agreed window, hold voids back automatically.
                </p>
              </div>
            </div>

            {/* Visual Component 2: Verification Report Preview */}
            <div className="p-7 rounded-2xl glass-card border border-border/80 shadow-xl space-y-6 hover:border-brand/40 transition-all duration-300">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-text block">Milestone Verification Report</span>
                    <span className="text-[11px] text-muted">Cryptographic Verdict Engine</span>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm font-mono">
                  DECISION: PASS
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Criterion 1: Deterministic check */}
                <div className="p-3.5 rounded-xl bg-surface-2/80 border border-border/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text">1. Schema Validation (ROW_COUNT_MIN)</span>
                    <span className="text-emerald-400 font-mono text-[11px] font-bold">Passed (124 ≥ 100)</span>
                  </div>
                  <p className="text-[11px] text-muted">Checked JSON schema headers, required keys, and record limits.</p>
                </div>

                {/* Criterion 2: Rubric with evidence citation */}
                <div className="p-3.5 rounded-xl bg-surface-2/80 border border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text">2. Technical Accuracy &amp; Rubric</span>
                    <span className="text-emerald-400 font-mono text-[11px] font-bold">Score: 0.94 / 1.00</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-border/80 font-mono text-[11px] text-text shadow-inner">
                    <span className="text-muted">Evidence quote: </span>
                    <span className="text-sky-400 font-semibold">&quot;Verified all 124 merchant records with active OAuth2 scopes.&quot;</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted pt-2 border-t border-border/60">
                  <span className="font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>ProofPack™ signed with RFC 3161</span>
                  </span>
                  <span className="text-emerald-400 font-bold">PayPal Captured: $600.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works: 3 Steps */}
      <section id="how-it-works" className="py-20 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs uppercase font-bold tracking-wider text-brand">Workflow</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
              How ProofPay Works
            </h2>
            <p className="text-sm text-muted max-w-xl mx-auto leading-relaxed">
              From contract agreement to instant milestone release in 3 transparent steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h3 className="text-lg font-bold text-text">Agree on measurable criteria</h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                Describe the job in plain English or start from a template. ProofPay turns it into checkable criteria and flags vague wording before anyone commits.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h3 className="text-lg font-bold text-text">Secure the payment</h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                The buyer approves a PayPal authorization for the total. It’s a hold on their funding source, not a charge. The seller can see the funds are secured before starting.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h3 className="text-lg font-bold text-text">Verify and release</h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                Each delivery runs through rule-based checks and an AI reviewer that must quote its evidence. If it passes, PayPal captures that milestone automatically. If not, the seller gets exact feedback.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who It's For: 3 Target Audiences */}
      <section className="py-20 border-b border-border bg-surface/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs uppercase font-bold tracking-wider text-brand">Audiences</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
              Who ProofPay is built for
            </h2>
            <p className="text-sm text-muted max-w-xl mx-auto leading-relaxed">
              Designed for companies, freelancers, and AI agent developers moving real money.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-text">Agencies and Freelancers</h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                Stop chasing payment. Know funds are authorized upfront on PayPal before you start work, with automatic captures the second your delivery meets agreed acceptance rules.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-text">Buyers and Clients</h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                Pay only for work that passes. Zero upfront debit; money stays safely in your PayPal authorization hold until deliverables demonstrably pass deterministic criteria.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-text">AI-Agent Builders</h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                A safe way for agents to buy and sell work. Equip autonomous agents with scoped API keys, strict budget caps, and Model Context Protocol (MCP) tooling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid: Trust Architecture (Magic UI / RareUI inspired) */}
      <section className="py-24 border-b border-border relative overflow-hidden">
        {/* Subtle dot matrix bg */}
        <div className="absolute inset-0 bg-dot-pattern opacity-30 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg via-transparent to-bg pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14 relative z-10">
          <ScrollReveal animation="fade-up">
            <div className="text-center space-y-4">
              <span className="inline-flex items-center gap-2 text-xs uppercase font-extrabold tracking-widest text-sky-400 bg-sky-500/10 border border-sky-500/20 px-4 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                Integrity
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-text">
                The Trust Principles
              </h2>
              <p className="text-sm text-muted max-w-xl mx-auto leading-relaxed">
                We never cut corners on financial integrity, cryptographic proof, or honest claims.
              </p>
            </div>
          </ScrollReveal>

          {/* Asymmetric Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Large card: AI safety */}
            <div className="md:col-span-2 group relative p-8 rounded-3xl glass-card border border-purple-500/20 shadow-xl hover:border-purple-500/40 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 group-hover:bg-purple-500/10 transition-colors duration-700" />
              <div className="relative z-10 space-y-5">
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <Scale className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-mono font-bold px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Non-Custodial
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-text">AI advises, deterministic rules decide</h3>
                  <p className="text-sm text-muted leading-relaxed">
                    The AI cannot disburse payments. Strict JSON schema validators, threshold gates, and dual-LLM consensus hold absolute authority over every PayPal authorization capture.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {['Schema Validation', 'Rubric Scoring', 'Consensus Check', 'Threshold Gates'].map(tag => (
                    <span key={tag} className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-2/80 border border-border/60 text-muted font-medium">{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Evidence card */}
            <div className="group relative p-8 rounded-3xl glass-card border border-emerald-500/20 shadow-xl hover:border-emerald-500/40 transition-all duration-300 overflow-hidden flex flex-col justify-between">
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 group-hover:bg-emerald-500/10 transition-colors duration-700" />
              <div className="relative z-10 space-y-4">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-fit">
                  <Database className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-text">Evidence you can export</h3>
                <p className="text-sm text-muted leading-relaxed">
                  Every decision recorded in a tamper-evident SHA-256 hash-chained log. Full ProofPack™ export for mediation.
                </p>
              </div>
              <div className="relative z-10 mt-5 p-3.5 rounded-xl bg-surface-2/90 border border-border/60 font-mono text-[11px] text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>SHA-256 hash chain · RFC 3161 TSA</span>
              </div>
            </div>

            {/* PayPal card */}
            <div className="group relative p-8 rounded-3xl glass-card border border-sky-500/20 shadow-xl hover:border-sky-500/40 transition-all duration-300 overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 group-hover:bg-sky-500/10 transition-colors duration-700" />
              <div className="relative z-10 space-y-4">
                <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 w-fit">
                  <DollarSign className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-text">PayPal moves the money</h3>
                <p className="text-sm text-muted leading-relaxed">
                  ProofPay never holds your funds. 29-day authorization holds stay securely on PayPal rails.
                </p>
              </div>
              <div className="relative z-10 mt-5 flex items-center gap-2 text-sky-400 text-xs font-semibold">
                <span>Direct PayPal REST API v2</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Honest limits wide card */}
            <div className="md:col-span-2 group relative p-8 rounded-3xl glass-card border border-amber-500/20 shadow-xl hover:border-amber-500/40 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 group-hover:bg-amber-500/8 transition-colors duration-700" />
              <div className="relative z-10 space-y-5">
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-mono font-bold px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Transparency
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-text">Radically honest about limits</h3>
                  <p className="text-sm text-muted leading-relaxed">
                    Sandbox today with test money. Authorization hold, not escrow. Not legal advice. Every milestone criterion, evaluation log, and audit chain is fully exportable as verifiable JSON.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Developers & Machine Agents Section — Premium Terminal Card */}
      <section className="py-24 border-b border-border bg-surface/20 relative overflow-hidden">
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 text-xs uppercase font-extrabold tracking-widest text-sky-400 bg-sky-500/10 border border-sky-500/20 px-4 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                Agentic Commerce
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-text">
                Native Tooling for Autonomous AI Agents
              </h2>
              <p className="text-sm text-muted max-w-xl leading-relaxed">
                Equip Claude Desktop, Cursor, LangChain, or custom agents with scoped credentials and Model Context Protocol (MCP) tools.
              </p>
            </div>
            <Link
              href="/app/developers"
              className="inline-flex items-center gap-2 text-sm font-bold text-sky-400 hover:text-sky-300 transition-colors whitespace-nowrap group"
            >
              <span>Explore Developer Platform</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="rounded-3xl border border-border/80 glass-card overflow-hidden shadow-2xl">
            {/* Terminal header with traffic lights */}
            <div className="p-4 border-b border-border/60 flex items-center justify-between bg-surface-2/60">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/70"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/70"></div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-mono font-semibold text-muted">claude_desktop_config.json</span>
                </div>
              </div>
              <button
                onClick={handleCopyMcp}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg glass-card border border-border/60 text-xs text-muted hover:text-text transition-all hover:border-sky-500/40"
              >
                {copiedMcp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMcp ? 'Copied!' : 'Copy MCP Config'}</span>
              </button>
            </div>
            <pre className="p-6 font-mono text-xs text-muted overflow-x-auto leading-relaxed bg-surface/30">
              {mcpSnippet}
            </pre>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <ScrollReveal animation="fade-up">
            <div className="text-center space-y-4">
              <span className="inline-flex items-center gap-2 text-xs uppercase font-extrabold tracking-widest text-sky-400 bg-sky-500/10 border border-sky-500/20 px-4 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                Questions
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-text">
                Frequently Asked Questions
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                Clear, transparent answers on PayPal holds, verification policies, and sandbox limits.
              </p>
            </div>
          </ScrollReveal>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div
                  key={idx}
                  className={`rounded-2xl border overflow-hidden transition-all duration-300 ${isOpen ? 'glass-card border-sky-500/30 shadow-lg shadow-sky-500/5' : 'bg-surface border-border/80 hover:border-border'}`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-text hover:bg-surface-2/50 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${isOpen ? 'bg-sky-500/20 border-sky-500/40 text-sky-400' : 'border-border text-muted'}`}>
                      {isOpen ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm text-muted leading-relaxed border-t border-border/40 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Section — Premium Gradient with glow */}
      <section className="py-28 relative overflow-hidden">
        {/* Concentric glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-sky-900/20 via-indigo-900/15 to-purple-900/20 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-sky-500/15 via-blue-500/15 to-indigo-500/15 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-dot-pattern opacity-20 pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 relative z-10">
          <ScrollReveal animation="scale-up">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 text-xs uppercase font-extrabold tracking-widest text-sky-400 bg-sky-500/10 border border-sky-500/30 px-4 py-1.5 rounded-full backdrop-blur-md">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Sandbox Live · Real PayPal Rails
              </span>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-text leading-tight">
                Ready to secure agreements{' '}
                <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  on PayPal?
                </span>
              </h2>
              <p className="text-base text-muted max-w-2xl mx-auto leading-relaxed">
                Create your sandbox workspace in seconds. Draft smart milestone agreements with AI criteria or test autonomous agent scenarios — all backed by real PayPal authorization holds.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/app"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.03] active:scale-[0.98] group"
              >
                <span>Get started with sandbox</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/demo"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl glass-card border border-border/80 text-text font-bold hover:bg-surface-2 transition-all text-sm shadow-md hover:scale-[1.02] active:scale-[0.98]"
              >
                Open Sandbox Playground
              </Link>
            </div>
            <p className="text-xs text-muted/60 pt-4">Authorization hold, not escrow · Sandbox test money only · No real charges</p>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer — Premium dark with brand gradient wordmark */}
      <footer className="border-t border-border/60 bg-surface/80 backdrop-blur-sm py-16 text-xs relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 relative z-10">
          {/* Brand row */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-border/40">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <span className="text-white font-black text-sm tracking-tighter">PP</span>
                </div>
                <span className="font-black text-lg tracking-tight text-text">Proof<span className="text-sky-400">Pay</span></span>
              </div>
              <p className="text-muted text-[11px] max-w-xs leading-relaxed">
                Pay-on-acceptance protocol powered by PayPal authorization holds and cryptographic milestone verification.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-[11px] text-muted bg-surface-2/80 border border-border/60 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sandbox Live
              </span>
              <a
                href="https://github.com/Monolithic-Dev/ProofPay"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-muted hover:text-text transition-colors bg-surface-2/80 border border-border/60 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <h4 className="font-extrabold text-text uppercase tracking-widest text-[10px]">Product</h4>
              <ul className="space-y-2 text-muted">
                <li><Link href="/app" className="hover:text-text transition-colors">Dashboard</Link></li>
                <li><Link href="/contracts" className="hover:text-text transition-colors">Agreements</Link></li>
                <li><Link href="/app/payments" className="hover:text-text transition-colors">Payments &amp; Holds</Link></li>
                <li><Link href="/app/templates" className="hover:text-text transition-colors">Templates Library</Link></li>
                <li><Link href="/demo" className="hover:text-text transition-colors">Sandbox Playground</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-extrabold text-text uppercase tracking-widest text-[10px]">Developers</h4>
              <ul className="space-y-2 text-muted">
                <li><Link href="/docs" className="hover:text-text transition-colors">API Documentation</Link></li>
                <li><Link href="/app/developers" className="hover:text-text transition-colors">Service Accounts &amp; MCP</Link></li>
                <li><Link href="/ledger" className="hover:text-text transition-colors">Audit Ledger</Link></li>
                <li>
                  <a
                    href="https://github.com/Monolithic-Dev/ProofPay"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-text transition-colors inline-flex items-center gap-1"
                  >
                    <span>Source on GitHub</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-extrabold text-text uppercase tracking-widest text-[10px]">Legal &amp; Trust</h4>
              <ul className="space-y-2 text-muted">
                <li><Link href="/legal/terms" className="hover:text-text transition-colors">Terms of Service</Link></li>
                <li><Link href="/legal/privacy" className="hover:text-text transition-colors">Privacy Policy</Link></li>
                <li><Link href="/help" className="hover:text-text transition-colors">Help &amp; Support</Link></li>
                <li><Link href="/trust" className="hover:text-sky-400 transition-colors font-medium">Trust Center &amp; Benchmarks</Link></li>
                <li><Link href="/verify" className="hover:text-text transition-colors">Proof Pack Verifier</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-extrabold text-text uppercase tracking-widest text-[10px]">System Status</h4>
              <div className="space-y-2 text-muted">
                <Link href="/status" className="flex items-center gap-2 hover:text-text transition-colors group">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 group-hover:scale-125 transition-transform" />
                  <span className="text-text font-semibold">Live Health Telemetry →</span>
                </Link>
                <p className="text-[11px] leading-relaxed">
                  Platform operates in sandbox test mode with simulated currency.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-muted text-[11px]">
            <p className="font-medium">© 2026 ProofPay. Pay when it is proven.</p>
            <p className="text-muted/60">
              Built for the PayPal AI Hackathon 2026 · Authorization hold, not escrow.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
