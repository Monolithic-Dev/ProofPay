'use client'

/**
 * ChainBadge Component — cryptographic proof status for the contract ledger.
 * Implements phase-6-frontend.md §6.3 & ux-flows.md §3.
 */
import React from 'react'
import { ShieldCheck, AlertOctagon, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/lib/query'

export interface ChainBadgeProps {
  contractId: string | undefined | null
  className?: string
}

export function ChainBadge({ contractId, className = '' }: ChainBadgeProps) {
  const api = useApiClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ledger-verify', contractId],
    queryFn: async () => {
      if (!contractId) throw new Error('Contract ID required')
      return api.verifyLedger(contractId)
    },
    enabled: Boolean(contractId),
    staleTime: 5000,
  })

  if (!contractId) return null

  if (isLoading) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-muted border border-border ${className}`}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
        <span>Verifying chain…</span>
      </span>
    )
  }

  if (isError || !data) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-bad/10 text-bad border border-bad/20 ${className}`}
      >
        <AlertOctagon className="w-3.5 h-3.5 text-bad" />
        <span>Verification failed</span>
      </span>
    )
  }

  if (!data.valid) {
    return (
      <span
        role="alert"
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-bad/10 text-bad border border-bad/30 ${className}`}
        title={`Hash mismatch detected at sequence #${data.broken_at_seq}`}
      >
        <AlertOctagon className="w-3.5 h-3.5 text-bad" />
        <span>Chain broken at seq #{data.broken_at_seq}</span>
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-ok/10 text-ok border border-ok/20 ${className}`}
      title="All events cryptographically verified against SHA-256 hash chain"
    >
      <ShieldCheck className="w-3.5 h-3.5 text-ok" />
      <span>Ledger intact ✓ ({data.checked} events)</span>
    </span>
  )
}
