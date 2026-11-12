'use client'

import React from 'react'
import { PageShell } from '@/components/common/PageShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { CreditCard, CheckCircle2, Shield, Info, ExternalLink, Zap } from 'lucide-react'

export default function PaymentsSettingsPage() {
  return (
    <PageShell
      title="Settings"
      subtitle="Manage your profile, team members, financial policies, and credentials"
    >
      <SettingsNav />

      <div className="space-y-8 max-w-4xl">
        {/* Sandbox Status Banner */}
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-sm flex items-start gap-4">
          <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-900 dark:text-amber-200">Sandbox Authorization Hold Environment</div>
            <div className="text-xs text-amber-800 dark:text-amber-300/80 leading-relaxed">
              ProofPay operates in PayPal Sandbox mode. Buyer authorization holds reserve test funds on PayPal; captured funds land in the platform test merchant account. No real credit cards or bank accounts are debited.
            </div>
          </div>
        </div>

        {/* PayPal Gateway Connection Card */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text">PayPal Payment Rails</h3>
                <p className="text-xs text-muted">Platform Gateway Mode (v2 R1)</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Sandbox Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-border/60 bg-surface/30 space-y-1">
              <div className="text-xs font-medium text-muted">Gateway Mode</div>
              <div className="text-sm font-semibold text-text">Platform Managed Sandbox Account</div>
            </div>
            <div className="p-4 rounded-xl border border-border/60 bg-surface/30 space-y-1">
              <div className="text-xs font-medium text-muted">Supported Currencies</div>
              <div className="text-sm font-semibold text-text">USD (United States Dollar)</div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/60 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">Direct Seller Payouts (R2 Roadmap)</div>
            <p className="text-xs text-muted leading-relaxed">
              Multi-seller direct routing via PayPal Partner Referrals onboarding is scheduled for Release 2. Once connected, client milestone captures will route automatically to the provider’s individual PayPal Business account, less transparent platform fees.
            </p>
            <div className="pt-2">
              <button
                type="button"
                disabled
                className="px-4 py-2 rounded-xl bg-surface border border-border/60 text-muted text-xs font-medium cursor-not-allowed inline-flex items-center gap-2"
              >
                <span>Connect Custom PayPal Business Account</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand">Coming in R2</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing & Fee Transparency */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text">Fee & Rate Transparency</h3>
              <p className="text-xs text-muted">No hidden deductions or monthly platform surcharges</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border/60 bg-surface/30 text-center space-y-1">
              <div className="text-2xl font-bold text-text">No Fee</div>
              <div className="text-xs text-muted font-medium">Platform Fee in Sandbox</div>
            </div>
            <div className="p-4 rounded-xl border border-border/60 bg-surface/30 text-center space-y-1">
              <div className="text-2xl font-bold text-text">$0</div>
              <div className="text-xs text-muted font-medium">Monthly Workspace Cost</div>
            </div>
            <div className="p-4 rounded-xl border border-border/60 bg-surface/30 text-center space-y-1">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">0 ms</div>
              <div className="text-xs text-muted font-medium">Hold Release Delay</div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
