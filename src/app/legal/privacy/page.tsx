'use client'

import React from 'react'
import { PageShell } from '@/components/common/PageShell'
import { ShieldCheck, Lock, Database, Server, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default function PrivacyPolicyPage() {
  return (
    <PageShell
      title="Privacy Policy"
      subtitle="Version 2.2-sandbox • Effective November 9, 2026"
    >
      <div className="space-y-8 max-w-3xl text-sm text-text/80 leading-relaxed pb-16">
        {/* Notice Banner */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Sandbox Evaluation Notice &bull; Draft &bull; Not Legal Advice</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              This privacy disclosure outlines data collection, subprocessor engagements, and retention boundaries for the ProofPay prototype.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border/80 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-brand shrink-0" />
          <span className="text-xs text-muted">
            ProofPay respects data sovereignty. We collect only what is strictly required to run deterministic agreements and trigger PayPal payment holds.
          </span>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">1. Data Collected &amp; Purpose</h2>
          <p className="text-xs text-muted leading-relaxed">
            We collect account identification data (name, email address, Argon2id-hashed passwords, organization membership), contract specifications, deliverable payloads submitted for verification, and audit event logs. We do not store or collect credit card or bank login details; all payment authorization is executed on PayPal&apos;s hosted checkout.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">2. Authoritative Subprocessor List (Appendix A-4)</h2>
          <p className="text-xs text-muted leading-relaxed">
            ProofPay uses the following subprocessors to deliver core functionality:
          </p>
          <div className="border border-border rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-surface-2 border-b border-border text-muted">
                <tr>
                  <th className="p-2.5">Subprocessor</th>
                  <th className="p-2.5">Purpose</th>
                  <th className="p-2.5">Data Transferred</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr>
                  <td className="p-2.5 font-semibold text-text">PayPal, Inc.</td>
                  <td className="p-2.5 text-muted">Payment authorization holds &amp; captures</td>
                  <td className="p-2.5 text-muted">Authorization ID, capture amounts, currency</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold text-text">Groq, Inc.</td>
                  <td className="p-2.5 text-muted">LPU inference for contract compilation</td>
                  <td className="p-2.5 text-muted">Contract criteria text (zero retention)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold text-text">Anthropic PBC</td>
                  <td className="p-2.5 text-muted">Consensus verification &amp; red-teaming</td>
                  <td className="p-2.5 text-muted">Deliverable quotes (zero training)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold text-text">Render Services, Inc.</td>
                  <td className="p-2.5 text-muted">Cloud application &amp; database hosting</td>
                  <td className="p-2.5 text-muted">Encrypted database rows &amp; app runtime</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">3. AI Deliverable Privacy &amp; Zero Training</h2>
          <p className="text-xs text-muted leading-relaxed">
            Deliverable payloads sent for automated grading are evaluated using dedicated commercial API endpoints. We do not use customer deliverables, datasets, or contract drafts to train public foundation models.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">4. Data Retention &amp; Sandbox Purge Schedule (Appendix D-2)</h2>
          <p className="text-xs text-muted leading-relaxed">
            Deliverable text submissions are expired after 7 days post-verification (permanent SHA-256 hashes are preserved in the ledger). Sandbox demo agreements are scheduled for automatic purge on <strong>December 16, 2026</strong>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">5. Right to Data Export and Erasure (GDPR)</h2>
          <p className="text-xs text-muted leading-relaxed">
            You may request a complete JSON export of your personal data or delete your account at any time via Settings. When an account is deleted, personal identifying information is permanently removed, while cryptographic hashes necessary to maintain the integrity of historical ledger chains remain pseudonymous.
          </p>
        </section>
      </div>
    </PageShell>
  )
}
