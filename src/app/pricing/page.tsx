'use client'

import React from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { Check, Shield, ArrowRight, Info } from 'lucide-react'

export default function PricingPage() {
  return (
    <PageShell
      title="Transparent Pricing"
      subtitle="Pay only for work that is successfully verified and captured"
    >
      <div className="space-y-12 max-w-4xl pb-16">
        {/* Sandbox Notice Banner */}
        <div className="p-4 rounded-xl bg-brand/10 border border-brand/20 text-brand text-xs flex items-center gap-3">
          <Info className="w-5 h-5 shrink-0" />
          <span>
            <strong>Sandbox Mode Active:</strong> All contracts, AI grading passes, and PayPal holds in the sandbox environment are completely free of charge.
          </span>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sandbox Tier */}
          <div className="card p-8 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-6 relative">
            <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Current Environment
            </div>
            <div>
              <h3 className="text-2xl font-bold text-text">Developer Sandbox</h3>
              <p className="text-xs text-muted mt-1">
                Test multi-agent workflows, synthesis, and PayPal holds without risking capital
              </p>
            </div>
            <div className="text-4xl font-extrabold text-text">
              $0 <span className="text-sm font-normal text-muted">/ forever</span>
            </div>

            <ul className="space-y-3 text-xs text-text/80">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Unlimited contracts and milestones</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Live Groq LPU contract compilation &amp; linting</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Deterministic verification engine &amp; scoring</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>PayPal sandbox authorization holds &amp; test captures</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>MCP server configuration &amp; scoped API keys</span>
              </li>
            </ul>

            <Link
              href="/contracts"
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-surface border border-border hover:border-brand text-text text-xs font-semibold transition-all"
            >
              <span>Go to Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Production Plan */}
          <div className="card p-8 border border-brand/40 rounded-2xl bg-gradient-to-b from-brand/10 to-surface/40 backdrop-blur-sm space-y-6 relative shadow-xl shadow-brand/5">
            <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-brand/20 text-brand border border-brand/30">
              Planned for Production (R2)
            </div>
            <div>
              <h3 className="text-2xl font-bold text-text">Pay-on-Success</h3>
              <p className="text-xs text-muted mt-1">
                Direct seller payouts via PayPal Partner Referrals
              </p>
            </div>
            <div className="text-4xl font-extrabold text-text">
              1.5% <span className="text-sm font-normal text-muted">per capture</span>
            </div>

            <ul className="space-y-3 text-xs text-text/80">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-brand" />
                <span>No monthly subscription or seat licensing</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-brand" />
                <span>No ProofPay platform charge on voided or cancelled holds</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-brand" />
                <span>Automated seller PayPal Business account onboarding</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-brand" />
                <span>Cryptographic Proof Pack evidence export</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-brand" />
                <span>Dispute mediation dashboard</span>
              </li>
            </ul>

            <button
              type="button"
              disabled
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand/30 border border-brand/40 text-brand text-xs font-semibold cursor-not-allowed"
            >
              <span>Launching with PayPal Partner Approval</span>
            </button>
          </div>
        </div>

        {/* Fee Transparency Note */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/30 space-y-3 text-xs text-muted leading-relaxed">
          <div className="font-semibold text-text flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand" />
            <span>Standard PayPal Merchant Processing Fees</span>
          </div>
          <p>
            In production, standard PayPal commercial processing fees (e.g. 2.9% + $0.30 per captured transaction) apply as charged by PayPal. ProofPay discloses all fee components before any authorization hold is placed.
          </p>
        </div>
      </div>
    </PageShell>
  )
}
