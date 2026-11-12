'use client'

import React from 'react'
import { PageShell } from '@/components/common/PageShell'
import { Scale, ShieldCheck, AlertCircle, ExternalLink, HelpCircle } from 'lucide-react'
import Link from 'next/link'

export default function TermsOfServicePage() {
  return (
    <PageShell
      title="Terms of Service"
      subtitle="Version 2.2-sandbox • Effective November 9, 2026"
    >
      <div className="space-y-8 max-w-3xl text-sm text-text/80 leading-relaxed pb-16">
        {/* Notice Banner */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
          <Scale className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Sandbox Evaluation Notice &bull; Draft &bull; Not Legal Advice</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              These terms are provided for sandbox evaluation and demonstration purposes only. ProofPay does not provide legal, financial, or tax counsel.
            </p>
          </div>
        </div>

        {/* Brand Disclaimers */}
        <div className="p-4 rounded-xl bg-surface border border-border/80 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-brand shrink-0" />
          <span className="text-xs text-muted">
            ProofPay operates on PayPal developer rails. <strong>ProofPay is an independent prototype and is not affiliated with, endorsed by, or sponsored by PayPal, Inc.</strong>
          </span>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">1. Sandbox Operations &amp; Payment Rails</h2>
          <p className="text-xs text-muted leading-relaxed">
            ProofPay operates on PayPal developer rails. In this sandbox environment, all funds, authorizations, and captures are simulated test transactions. No actual financial debit, credit, or legal debt obligation is created. Production deployments require official PayPal Partner Referrals onboarding.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">2. Zero-Custody Policy (Not an Escrow Service)</h2>
          <p className="text-xs text-muted leading-relaxed">
            ProofPay is explicitly not an escrow agent, fiduciary, bank, money services business (MSB), or depository institution. <strong>ProofPay never holds, pools, or takes custody of user funds.</strong> All client payment commitments remain in the buyer&apos;s PayPal account as an authorization hold under PayPal&apos;s 29-day authorization validity framework.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">3. Eligibility and Acceptable Use</h2>
          <p className="text-xs text-muted leading-relaxed">
            You must be at least 18 years of age or the legal age of majority in your jurisdiction to use ProofPay. Prohibited uses include: money laundering, fraud, transmission of malware, infringement of intellectual property, or contracting for illegal goods and services.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">4. AI Verification &amp; Deterministic Code Decisions</h2>
          <p className="text-xs text-muted leading-relaxed">
            ProofPay utilizes artificial intelligence to extract quoted evidence from digital deliverables and explain evaluation outcomes. However, <strong>code and deterministic rules make the final payment release decision</strong>. AI outputs never constitute automated legal decisions. Users may escalate any evaluation to human review.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">5. Subprocessors &amp; Data Map</h2>
          <p className="text-xs text-muted leading-relaxed">
            ProofPay contracts with enterprise infrastructure providers including PayPal Inc. (payment rails), Groq Inc. and Anthropic PBC (ephemeral AI inference), and Render Services Inc. (cloud hosting). For complete data lifecycle details, refer to our{' '}
            <Link href="/legal/privacy" className="text-brand hover:underline font-semibold">
              Privacy Policy
            </Link>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">6. Cryptographic Proof Packs &amp; Evidence Hash Chains</h2>
          <p className="text-xs text-muted leading-relaxed">
            ProofPay maintains an append-only, SHA-256 hash-chained financial and milestone ledger. The cryptographic ledger records immutable sequence events for dispute mediation and offline auditability at{' '}
            <Link href="/verify" className="text-brand hover:underline font-semibold">
              /verify
            </Link>.
          </p>
        </section>
      </div>
    </PageShell>
  )
}
