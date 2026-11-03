'use client'

import React from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import {
  Shield,
  CreditCard,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  Layers,
  Terminal,
  FileText,
  AlertTriangle,
  Scale,
} from 'lucide-react'

export default function HowItWorksPage() {
  return (
    <PageShell
      title="How ProofPay Works"
      subtitle="Pay-on-acceptance protocol for digital deliverables using PayPal authorization holds"
    >
      <div className="space-y-16 max-w-4xl pb-16">
        {/* Core Principles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="text-base font-bold text-text">Lock Before Starting</h3>
            <p className="text-xs text-muted leading-relaxed">
              Client approves an authorization hold via PayPal up front. The provider knows funds are guaranteed without the client releasing upfront cash.
            </p>
          </div>

          <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="text-base font-bold text-text">Verify by Objective Criteria</h3>
            <p className="text-xs text-muted leading-relaxed">
              When work is submitted, 3-stage deterministic checks (schema, regex, statistical bounds, Groq AI) grade the artifact against mutually agreed requirements.
            </p>
          </div>

          <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="text-base font-bold text-text">Capture on Proof</h3>
            <p className="text-xs text-muted leading-relaxed">
              Only a verified <span className="font-semibold text-emerald-400">PASSED</span> result unlocks the single release gateway to execute a PayPal partial capture. Unused balance is voided.
            </p>
          </div>
        </div>

        {/* Detailed Lifecycle */}
        <div className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-text">The 4-Step Protocol Lifecycle</h2>
            <p className="text-sm text-muted">
              From natural-language agreement to PayPal settlement and append-only cryptographic audit trail
            </p>
          </div>

          <div className="space-y-4">
            <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm flex gap-5">
              <div className="p-3 rounded-2xl bg-brand/10 border border-brand/20 text-brand h-fit shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-text">Step 1 — Contract Synthesis &amp; Criteria Lock</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Both parties agree on measurable requirements in plain English. The AI Contract Studio compiles milestones with strict schema checks, regex validators, and minimum accuracy thresholds. Both parties review the SHA-256 agreement hash and lock the contract.
                </p>
              </div>
            </div>

            <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm flex gap-5">
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 h-fit shrink-0">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-text">Step 2 — PayPal Authorization Hold</h3>
                <p className="text-xs text-muted leading-relaxed">
                  The client authenticates with PayPal to approve an authorization hold for the total contract value. Funds are secured on the client’s payment source. ProofPay never takes custody of funds: money remains securely on PayPal rails under strict 29-day authorization limits.
                </p>
              </div>
            </div>

            <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm flex gap-5">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 h-fit shrink-0">
                <Shield className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-text">Step 3 — Delivery &amp; Automated Verification</h3>
                <p className="text-xs text-muted leading-relaxed">
                  The provider submits deliverables (JSON datasets, cleaned CSVs, translation batches, code reports). ProofPay executes deterministic evaluation passes. If all acceptance criteria meet the threshold, a tamper-proof verification report is generated and hash-chained to the ledger.
                </p>
              </div>
            </div>

            <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm flex gap-5">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 h-fit shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-text">Step 4 — Milestone Capture &amp; Void</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Upon passing, the backend release gateway triggers a PayPal partial capture for that specific milestone amount. If work is rejected or remaining milestones are cancelled, remaining authorization holds are voided immediately back to the client.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Honest Trust Section */}
        <div className="card p-8 border border-border/80 rounded-2xl bg-surface/50 backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6 text-brand" />
            <h3 className="text-lg font-bold text-text">Honest Architecture: Authorization Hold vs Escrow</h3>
          </div>
          <div className="text-xs text-muted leading-relaxed space-y-3">
            <p>
              ProofPay is <strong className="text-text">not a traditional escrow service</strong>, bank, or licensed money transmitter. ProofPay never holds, stores, or pools customer funds.
            </p>
            <p>
              All money movements are executed directly through PayPal's authorization and capture APIs. PayPal holds the customer commitment, PayPal verifies buyer identity, and PayPal processes the capture or void transaction.
            </p>
          </div>
          <div className="pt-4 flex gap-4">
            <Link
              href="/contracts"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-lg shadow-brand/20 transition-all"
            >
              <span>Explore Contracts</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface border border-border hover:border-border-hover text-text text-xs font-semibold transition-all"
            >
              <span>Read API Docs</span>
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
