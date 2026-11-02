'use client'

/**
 * ProposeBar Component — seller assignment and contract proposal dispatch.
 * Disabled with tooltip whenever blocking errors are present.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S1).
 */
import React, { useState } from 'react'
import { Send, AlertCircle, Loader2 } from 'lucide-react'
import type { LintIssue } from '@/shared/types'

export interface ProposeBarProps {
  onPropose: (sellerEmail: string) => Promise<void>
  issues: LintIssue[]
  isProposing?: boolean
  className?: string
}

export function ProposeBar({
  onPropose,
  issues = [],
  isProposing = false,
  className = '',
}: ProposeBarProps) {
  const [sellerEmail, setSellerEmail] = useState('alex@demo.proofpay')
  const blockingErrors = issues.filter((i) => i.severity === 'error')
  const isBlocked = blockingErrors.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isBlocked || !sellerEmail.trim() || isProposing) return
    await onPropose(sellerEmail.trim())
  }

  return (
    <div
      className={`p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-3 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-text">Propose to Seller</h3>
          <p className="text-xs text-muted">
            Send this agreement for seller review and cryptographic acceptance.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="email"
            value={sellerEmail}
            onChange={(e) => setSellerEmail(e.target.value)}
            placeholder="seller@domain.com"
            disabled={isProposing}
            className="px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text placeholder-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
          />

          <button
            type="submit"
            disabled={isBlocked || !sellerEmail.trim() || isProposing}
            title={
              isBlocked
                ? `Blocked by errors: ${blockingErrors.map((e) => e.code).join(', ')}`
                : 'Send proposal to seller'
            }
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-95 transition-all shadow-sm focus:ring-2 focus:ring-brand focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {isProposing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Proposing…</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Propose Contract</span>
              </>
            )}
          </button>
        </form>
      </div>

      {isBlocked && (
        <div className="p-3 rounded-xl bg-bad/5 border border-bad/20 flex items-center gap-2 text-xs text-bad">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            Proposing disabled until blocking errors are resolved:{' '}
            <strong className="font-mono">{blockingErrors.map((e) => e.code).join(', ')}</strong>
          </span>
        </div>
      )}
    </div>
  )
}
