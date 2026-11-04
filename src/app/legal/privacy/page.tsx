'use client'

import React from 'react'
import { PageShell } from '@/components/common/PageShell'
import { ShieldCheck, Lock } from 'lucide-react'

export default function PrivacyPolicyPage() {
  return (
    <PageShell
      title="Privacy Policy"
      subtitle="Version 2.1-sandbox • Effective November 3, 2026"
    >
      <div className="space-y-8 max-w-3xl text-sm text-text/80 leading-relaxed pb-16">
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Hackathon Prototype Notice &bull; Draft &bull; Not Legal Advice</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              This privacy disclosure is provided for hackathon evaluation and technical transparency purposes.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border/80 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-brand" />
          <span className="text-xs text-muted">
            ProofPay respects your data sovereignty. Deliverables and prompts are processed securely.
          </span>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">1. Data Collected</h2>
          <p className="text-xs text-muted leading-relaxed">
            We collect account identification data (name, email address, hashed passwords, organization membership), contract specifications, deliverable payloads submitted for verification, and audit event logs.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">2. AI Inference &amp; Deliverable Privacy</h2>
          <p className="text-xs text-muted leading-relaxed">
            Deliverable payloads sent for automated grading are evaluated using dedicated Groq LPU inference. We do not use customer deliverables, datasets, or contract drafts to train public foundation models.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-text">3. Right to Data Export and Erasure (GDPR)</h2>
          <p className="text-xs text-muted leading-relaxed">
            You may request a complete JSON export of your personal data or delete your account at any time via Settings. When an account is deleted, personal identifying information is permanently removed, while cryptographic hashes necessary to maintain the integrity of historical ledger chains remain pseudonymous.
          </p>
        </section>
      </div>
    </PageShell>
  )
}
