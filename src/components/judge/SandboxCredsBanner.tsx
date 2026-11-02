'use client'

/**
 * SandboxCredsBanner Component — provides judges and testers with pre-configured PayPal credentials.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S0).
 */
import React from 'react'
import { KeyRound, ShieldAlert } from 'lucide-react'
import { MonoText } from '@/components/common/MonoText'

export interface SandboxCredsBannerProps {
  buyerEmail?: string
  buyerPassword?: string
  className?: string
}

export function SandboxCredsBanner({
  buyerEmail = 'buyer-sandbox@proofpay.test',
  buyerPassword = 'ProofPaySandbox2026!',
  className = '',
}: SandboxCredsBannerProps) {
  return (
    <div
      className={`p-4 rounded-xl bg-brand/5 border border-brand/20 flex flex-col md:flex-row md:items-center justify-between gap-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">
          <KeyRound className="w-5 h-5" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-text">PayPal Sandbox Credentials</h4>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-warn/15 text-warn border border-warn/30">
              <ShieldAlert className="w-3 h-3" />
              Sandbox only
            </span>
          </div>
          <p className="text-xs text-muted">
            Use these credentials when redirected to PayPal sandbox to authorize holds.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MonoText label="Email" value={buyerEmail} />
        <MonoText label="Password" value={buyerPassword} />
      </div>
    </div>
  )
}
