'use client'

/**
 * SandboxCredsBanner Component — provides judges and testers with pre-configured PayPal credentials.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S0).
 * Updated per docs/v2/08-current-build-review.md A6: collapsible by default, labeled sandbox-only.
 */
import React, { useState } from 'react'
import { KeyRound, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'
import { MonoText } from '@/components/common/MonoText'

export interface SandboxCredsBannerProps {
  buyerEmail?: string
  buyerPassword?: string
  className?: string
  defaultOpen?: boolean
}

export function SandboxCredsBanner({
  buyerEmail = 'buyer-sandbox@proofpay.test',
  buyerPassword = 'ProofPaySandbox2026!',
  className = '',
  defaultOpen = false,
}: SandboxCredsBannerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div
      className={`rounded-xl bg-brand/5 border border-brand/20 transition-all ${className}`}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-semibold text-text">PayPal Sandbox Test Credentials</h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-warn/15 text-warn border border-warn/30">
                <ShieldAlert className="w-2.5 h-2.5" />
                Sandbox only
              </span>
            </div>
            <p className="text-[11px] text-muted">
              Pre-configured test buyer account for authorizing holds in the PayPal sandbox popup.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="p-1 rounded text-muted hover:text-text transition-colors"
          aria-label={isOpen ? 'Hide credentials' : 'Show credentials'}
        >
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-brand/15 flex flex-wrap items-center gap-3 animate-in fade-in-50 duration-150">
          <MonoText label="Email" value={buyerEmail} />
          <MonoText label="Password" value={buyerPassword} />
          <span className="text-[10px] text-muted italic ml-auto">
            (Never enter real PayPal credentials in sandbox testing)
          </span>
        </div>
      )}
    </div>
  )
}
