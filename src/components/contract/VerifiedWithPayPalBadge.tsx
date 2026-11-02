'use client'

/**
 * VerifiedWithPayPalBadge Component — Live PayPal Authorization Status.
 * Calls /contracts/[id]/funding-status (30s poll interval) to display verified badge.
 * Implements phase-6-frontend.md §6.3 & ux-flows.md §3.
 */
import React from 'react'
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react'
import { useFundingStatus } from '@/lib/query'

export interface VerifiedWithPayPalBadgeProps {
  contractId: string | undefined | null
  className?: string
}

export function VerifiedWithPayPalBadge({
  contractId,
  className = '',
}: VerifiedWithPayPalBadgeProps) {
  const { data, isLoading, isError } = useFundingStatus(contractId)

  if (!contractId) return null

  if (isLoading) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-muted border border-border ${className}`}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
        <span>Checking PayPal…</span>
      </span>
    )
  }

  if (isError || !data || !data.verified) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-muted border border-border ${className}`}
        title="Authorization not yet placed or unavailable"
      >
        <AlertCircle className="w-3.5 h-3.5 text-muted" />
        <span>PayPal hold inactive</span>
      </span>
    )
  }

  const timeString = data.checked_at ? new Date(data.checked_at).toLocaleTimeString() : ''

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-ok/10 text-ok border border-ok/20 ${className}`}
      title={`Authorization ID: ${data.authorization_id || 'N/A'}${
        data.cached ? ' (cached)' : ''
      }`}
    >
      <ShieldCheck className="w-3.5 h-3.5 text-ok" />
      <span>Verified with PayPal {timeString}</span>
    </span>
  )
}
