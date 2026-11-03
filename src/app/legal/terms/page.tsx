'use client'

import React from 'react'
import { PageShell } from '@/components/common/PageShell'
import { Scale, ShieldCheck } from 'lucide-react'

export default function TermsOfServicePage() {
  return (
    <PageShell
      title="Terms of Service"
      subtitle="Version 2.1-sandbox • Effective November 3, 2026"
    >
      <div className="space-y-8 max-w-3xl text-sm text-text/80 leading-relaxed pb-16">
        <div className="p-4 rounded-xl bg-surface border border-border/80 flex items-center gap-3">
          <Scale className="w-5 h-5 text-brand" />
          <span className="text-xs text-muted">
            These terms govern your use of the ProofPay SaaS platform and sandbox verification APIs.
          </span>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">1. Sandbox Operations &amp; Payment Rails</h2>
          <p className="text-xs text-muted leading-relaxed">
            ProofPay operates on PayPal developer rails. In this sandbox environment, all funds, authorizations, and captures are simulated test transactions. No actual financial debit, credit, or legal debt obligation is created.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">2. Not an Escrow Service</h2>
          <p className="text-xs text-muted leading-relaxed">
            ProofPay is explicitly not an escrow agent, fiduciary, bank, money services business (MSB), or depository institution. ProofPay never holds, stores, or takes custody of user funds. Client payment commitments are authorized directly via PayPal authorization holds.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">3. AI Synthesis &amp; Automated Verification</h2>
          <p className="text-xs text-muted leading-relaxed">
            ProofPay provides artificial intelligence tools to synthesize contractual specifications and evaluate deliverables against objective criteria. While the evaluation pipeline uses multi-stage deterministic schema checks and statistical bounds, users remain responsible for reviewing generated criteria and milestone definitions before agreement lock.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">4. Cryptographic Proof Packs &amp; Evidence Hash Chains</h2>
          <p className="text-xs text-muted leading-relaxed">
            ProofPay maintains an append-only, SHA-256 hash-chained financial and milestone ledger. The cryptographic ledger records immutable sequence events for dispute mediation and auditability.
          </p>
        </section>
      </div>
    </PageShell>
  )
}
