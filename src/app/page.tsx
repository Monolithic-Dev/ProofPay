'use client'

import React, { useState } from 'react'
import Link from 'next/link'
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
      a: 'During our current Sandbox release, ProofPay is 100% free with zero fees. When real-money routing launches in R2 via PayPal Partner Referrals, competitive platform fees will be disclosed upfront on each milestone release.',
    },
    {
      q: 'Can my autonomous AI agent use ProofPay?',
      a: 'Yes. ProofPay provides dedicated Service Accounts with granular permission scopes (e.g., contracts:write, submissions:write) and strict financial budget caps. AI agents can negotiate contracts and submit work programmatically via our REST API or Model Context Protocol (MCP) server.',
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
        "PROOFPAY_API_KEY": "sk_live_your_agent_key",
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
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-border bg-gradient-to-b from-surface/40 via-surface/10 to-transparent">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2 border border-border text-text text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sandbox Test Environment • Real PayPal Rails</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-text leading-[1.1]">
            Get paid for work that’s proven.
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted leading-relaxed">
            ProofPay secures the payment on PayPal before work starts and releases it milestone by
            milestone when delivered work meets criteria both sides agreed. Humans and AI agents can
            use it.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              href="/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-sm shadow-md shadow-brand/20 transition-all"
            >
              <span>Create a free sandbox workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-xl bg-surface border border-border text-text font-medium hover:bg-surface-2 transition-colors text-sm shadow-sm"
            >
              See how it works
            </Link>
          </div>

          <p className="text-xs text-muted pt-1">
            PayPal authorization hold, not escrow. Sandbox only: no real money.
          </p>
        </div>
      </section>

      {/* Product Visual Showcase: Interactive Component Previews */}
      <section className="py-16 border-b border-border bg-surface/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xs uppercase font-bold tracking-wider text-brand">
              Built Like Real Financial Software
            </h2>
            <p className="text-2xl font-bold text-text">
              Real-time holds, cryptographic proof, and transparent releases
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual Component 1: Funds Bar Card */}
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-brand" />
                  <span className="font-semibold text-sm text-text">Funds Bar &amp; PayPal Hold</span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Authorized on PayPal
                </span>
              </div>

              {/* Funds Bar Visual Representation */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Total Authorized: <strong className="text-text">$1,200.00</strong></span>
                  <span className="text-emerald-400 font-semibold">$600.00 Released (50%)</span>
                </div>

                {/* Multi-segment progress bar */}
                <div className="h-3 w-full bg-surface-2 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: '50%' }} title="Released: $600.00" />
                  <div className="h-full bg-blue-500/80 transition-all duration-500" style={{ width: '50%' }} title="Held on PayPal: $600.00" />
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Captured to seller: $600.00</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Remaining in hold: $600.00</span>
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-2 border border-border/60 text-xs text-muted space-y-1">
                <p className="font-semibold text-text">Up to 29-day authorization window</p>
                <p className="text-[11px]">
                  Funds stay with the buyer&apos;s PayPal account until verified. If deliverables aren't approved within the agreed window, hold voids back automatically.
                </p>
              </div>
            </div>

            {/* Visual Component 2: Verification Report Preview */}
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-sm text-text">Milestone Verification Report</span>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  DECISION: PASS
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {/* Criterion 1: Deterministic check */}
                <div className="p-3 rounded-xl bg-surface-2 border border-border/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text">1. Schema Validation (ROW_COUNT_MIN)</span>
                    <span className="text-emerald-400 font-mono text-[11px]">Passed (124 ≥ 100)</span>
                  </div>
                  <p className="text-[11px] text-muted">Checked JSON schema headers, required keys, and record limits.</p>
                </div>

                {/* Criterion 2: Rubric with evidence citation */}
                <div className="p-3 rounded-xl bg-surface-2 border border-border/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text">2. Technical Accuracy &amp; Rubric</span>
                    <span className="text-emerald-400 font-mono text-[11px]">Score: 0.94 / 1.00</span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface border border-border font-mono text-[11px] text-text">
                    <span className="text-muted">Evidence quote: </span>
                    <span className="text-brand">&quot;Verified all 124 merchant records with active OAuth2 scopes.&quot;</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                  <span className="font-mono">Tamper-proof Proof Pack generated</span>
                  <span className="text-emerald-400 font-semibold">PayPal Capture Released $600.00</span>
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

      {/* Trust Section: 4 Pillars */}
      <section className="py-20 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs uppercase font-bold tracking-wider text-brand">Integrity</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
              The Trust Principles
            </h2>
            <p className="text-sm text-muted max-w-xl mx-auto leading-relaxed">
              We never cut corners on financial integrity, cryptographic proof, or honest claims.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-2">
              <div className="p-2.5 rounded-xl bg-brand/10 text-brand w-fit">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-text">AI advises, rules decide</h3>
              <p className="text-xs text-muted leading-relaxed">
                The AI cannot disburse payments; deterministic rules and threshold checks hold absolute decision authority.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-2">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-text">Evidence you can export</h3>
              <p className="text-xs text-muted leading-relaxed">
                Every decision is recorded in a tamper-evident SHA-256 hash-chained log for mediation and disputes.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-2">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 w-fit">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-text">PayPal moves the money</h3>
              <p className="text-xs text-muted leading-relaxed">
                ProofPay never holds your funds. Up to 29-day authorization holds remain securely managed on PayPal rails.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-2">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 w-fit">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-text">Honest about limits</h3>
              <p className="text-xs text-muted leading-relaxed">
                Sandbox today with test money. Not escrow. Not legal advice. Transparent roadmap toward partner referrals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Developers & Machine Agents Section */}
      <section className="py-20 border-b border-border bg-surface/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <span className="text-xs uppercase font-bold tracking-wider text-brand">Agentic Commerce</span>
              <h2 className="text-3xl font-bold tracking-tight text-text">
                Native Tooling for Autonomous AI Agents
              </h2>
              <p className="text-sm text-muted max-w-xl">
                Equip Claude Desktop, Cursor, LangChain, or custom agents with scoped credentials and Model Context Protocol (MCP) tools.
              </p>
            </div>
            <Link
              href="/app/developers"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
            >
              <span>Explore Developer Platform</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-brand" />
                <span className="text-xs font-mono font-medium text-text">claude_desktop_config.json</span>
              </div>
              <button
                onClick={handleCopyMcp}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface border border-border text-xs text-muted hover:text-text transition-colors"
              >
                {copiedMcp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMcp ? 'Copied' : 'Copy MCP Config'}</span>
              </button>
            </div>
            <pre className="p-5 font-mono text-xs text-muted overflow-x-auto leading-relaxed">
              {mcpSnippet}
            </pre>
          </div>
        </div>
      </section>

      {/* FAQ Section: 6 Questions from Spec */}
      <section className="py-20 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-3">
            <span className="text-xs uppercase font-bold tracking-wider text-brand">Questions</span>
            <h2 className="text-3xl font-bold tracking-tight text-text">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-muted">
              Clear, transparent answers on PayPal holds, verification policies, and sandbox limits.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-surface overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-text hover:bg-surface-2 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-muted flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-muted leading-relaxed border-t border-border/40 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-surface/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
            Ready to secure agreements on PayPal?
          </h2>
          <p className="text-sm text-muted max-w-xl mx-auto leading-relaxed">
            Create your sandbox workspace in seconds. Draft smart milestone agreements with AI criteria or test autonomous agent scenarios.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-sm shadow-md shadow-brand/20 transition-all"
            >
              <span>Get started with sandbox</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/demo"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-xl bg-surface border border-border text-text font-medium hover:bg-surface-2 transition-colors text-sm shadow-sm"
            >
              Open Sandbox Playground
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface/60 py-12 text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <h4 className="font-semibold text-text uppercase tracking-wider text-[11px]">Product</h4>
              <ul className="space-y-2 text-muted">
                <li><Link href="/app" className="hover:text-text transition-colors">Dashboard</Link></li>
                <li><Link href="/contracts" className="hover:text-text transition-colors">Agreements</Link></li>
                <li><Link href="/app/payments" className="hover:text-text transition-colors">Payments &amp; Holds</Link></li>
                <li><Link href="/app/templates" className="hover:text-text transition-colors">Templates Library</Link></li>
                <li><Link href="/demo" className="hover:text-text transition-colors">Sandbox Playground</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-text uppercase tracking-wider text-[11px]">Developers</h4>
              <ul className="space-y-2 text-muted">
                <li><Link href="/docs" className="hover:text-text transition-colors">API Documentation</Link></li>
                <li><Link href="/app/developers" className="hover:text-text transition-colors">Service Accounts &amp; MCP</Link></li>
                <li><Link href="/ledger" className="hover:text-text transition-colors">Audit Ledger (AG Grid)</Link></li>
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
              <h4 className="font-semibold text-text uppercase tracking-wider text-[11px]">Legal &amp; Trust</h4>
              <ul className="space-y-2 text-muted">
                <li><Link href="/legal/terms" className="hover:text-text transition-colors">Terms of Service</Link></li>
                <li><Link href="/legal/privacy" className="hover:text-text transition-colors">Privacy Policy</Link></li>
                <li><Link href="/help" className="hover:text-text transition-colors">Help &amp; Support</Link></li>
                <li><Link href="/trust" className="hover:text-text transition-colors text-brand font-medium">Trust Center &amp; Benchmarks</Link></li>
                <li><Link href="/verify" className="hover:text-text transition-colors">Offline Proof Pack Verifier</Link></li>
                <li><Link href="/pricing" className="hover:text-text transition-colors">Pricing &amp; Plans</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-text uppercase tracking-wider text-[11px]">System Status</h4>
              <div className="space-y-2 text-muted">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-text font-medium">PayPal Sandbox: Active</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Platform operates in sandbox test mode with simulated currency.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-muted text-[11px]">
            <p>© 2026 ProofPay. Pay when it is proven.</p>
            <p className="text-muted/80">
              Built for the PayPal AI Hackathon 2026. PayPal authorization hold, not escrow.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
