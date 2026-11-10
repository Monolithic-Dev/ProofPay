'use client'

/**
 * Contract Ledger Screen — /contracts/[id]/ledger
 * Comprehensive cryptographic audit trail with AG Grid and Proof Pack export.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S6).
 */
import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { History } from 'lucide-react'
import { PageShell } from '@/components/common/PageShell'
import { LedgerGrid } from '@/components/ledger/LedgerGrid'
import { LedgerDrawer } from '@/components/ledger/LedgerDrawer'
import { ChainBadge } from '@/components/ledger/ChainBadge'
import { ProofPackButtons } from '@/components/ledger/ProofPackButtons'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { useContract, useLedger } from '@/lib/query'
import { useContractEvents } from '@/lib/sse'
import type { LedgerEvent } from '@/shared/types'

export default function ContractLedgerPage() {
  const params = useParams()
  const contractId = params?.id as string

  // SSE subscription to auto-refresh ledger events
  useContractEvents(contractId)

  const { data: contract, isLoading: isLoadingContract } = useContract(contractId)
  const { data: ledgerData, isLoading: isLoadingLedger, error } = useLedger(contractId)

  const [selectedEvent, setSelectedEvent] = useState<LedgerEvent | null>(null)

  if (isLoadingContract || isLoadingLedger) {
    return (
      <PageShell title="Loading Ledger…" backHref={`/contracts/${contractId}`}>
        <LoadingBlock message="Loading cryptographic event chain…" />
      </PageShell>
    )
  }

  if (error || !ledgerData) {
    return (
      <PageShell title="Ledger Error" backHref={`/contracts/${contractId}`}>
        <ErrorState
          title="Audit Ledger Unavailable"
          message={error?.message || 'Failed to load ledger events.'}
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Cryptographic Audit Ledger"
      subtitle={`Append-only SHA-256 hash chain for: ${contract?.title || contractId}`}
      backHref={`/contracts/${contractId}`}
      backLabel="Back to Timeline"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <ChainBadge contractId={contractId} />
          <Link
            href={`/contracts/${contractId}/replay`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand/30 bg-brand/5 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            <span>Time-Travel Replay</span>
          </Link>
          <ProofPackButtons contractId={contractId} />
        </div>
      }
    >
      <div className="space-y-6">
        <LedgerGrid
          events={ledgerData.events}
          onSelectEvent={(ev) => setSelectedEvent(ev)}
        />

        {/* Payload Drawer */}
        <LedgerDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      </div>
    </PageShell>
  )
}
