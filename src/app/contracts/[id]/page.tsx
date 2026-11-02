'use client'

/**
 * Contract Timeline Screen — /contracts/[id]
 * Main contract dashboard with live SSE, Funds Bar, milestone actions, and audit feed.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S2/S4).
 */
import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldAlert,
  Check,
  CreditCard,
  FileCheck2,
  FileDown,
  Loader2,
  Lock,
  Layers,
  FlaskConical,
} from 'lucide-react'
import { PageShell } from '@/components/common/PageShell'
import { FundsBar } from '@/components/contract/FundsBar'
import { Countdown } from '@/components/contract/Countdown'
import { StatusChip } from '@/components/contract/StatusChip'
import { VerifiedWithPayPalBadge } from '@/components/contract/VerifiedWithPayPalBadge'
import { MilestoneCard } from '@/components/contract/MilestoneCard'
import { RecentEvents } from '@/components/contract/RecentEvents'
import { ChainBadge } from '@/components/ledger/ChainBadge'
import { MonoText } from '@/components/common/MonoText'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { useContract, useLedger, useCurrentUser, useApiClient } from '@/lib/query'
import { useContractEvents } from '@/lib/sse'
import { useQueryClient } from '@tanstack/react-query'

export default function ContractTimelinePage() {
  const params = useParams()
  const contractId = params?.id as string
  const router = useRouter()
  const api = useApiClient()
  const queryClient = useQueryClient()

  // Real-time updates via SSE (falls back to 5s polling automatically)
  useContractEvents(contractId)

  const { data: contract, isLoading, error } = useContract(contractId)
  const { data: ledgerData } = useLedger(contractId)
  const { data: currentUser } = useCurrentUser()

  const [isAccepting, setIsAccepting] = useState(false)
  const [isRetryingRelease, setIsRetryingRelease] = useState(false)
  const [showChaos, setShowChaos] = useState(false)
  const [chaosLoading, setChaosLoading] = useState(false)
  const [bannerError, setBannerError] = useState<string | null>(null)

  if (isLoading) {
    return (
      <PageShell title="Loading Agreement…" backHref="/studio">
        <LoadingBlock message="Connecting to contract timeline and PayPal status…" />
      </PageShell>
    )
  }

  if (error || !contract) {
    return (
      <PageShell title="Contract Error" backHref="/studio">
        <ErrorState
          title="Contract Not Found"
          message={error?.message || 'Unable to access the requested contract.'}
        />
      </PageShell>
    )
  }

  const milestones = contract.milestones || []
  const isBuyer = currentUser?.role === 'buyer' || currentUser?.id === contract.buyer_id
  const isSeller = currentUser?.role === 'seller' || currentUser?.id === contract.seller_id

  // Calculate Funds Bar segments
  let releasedMinor = 0
  let voidedMinor = 0
  for (const m of milestones) {
    if (m.status === 'RELEASED') {
      releasedMinor += m.amount_minor
    } else if (m.status === 'VOIDED') {
      voidedMinor += m.amount_minor
    }
  }

  const isFunded = ['FUNDED', 'IN_PROGRESS', 'COMPLETED'].includes(contract.status)
  const heldMinor = isFunded
    ? Math.max(0, contract.total_minor - releasedMinor - voidedMinor)
    : 0

  const handleAcceptContract = async () => {
    setIsAccepting(true)
    setBannerError(null)
    try {
      await api.acceptContract(contractId)
      await queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    } catch (err: any) {
      console.error('Accept failed:', err)
      setBannerError(err.message || 'Failed to accept contract terms')
    } finally {
      setIsAccepting(false)
    }
  }

  const handleRetryRelease = async (mid: string) => {
    setIsRetryingRelease(true)
    setBannerError(null)
    try {
      await api.retryRelease(contractId, mid)
      await queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    } catch (err: any) {
      console.error('Retry release failed:', err)
      setBannerError(err.message || 'Retry release failed')
    } finally {
      setIsRetryingRelease(false)
    }
  }

  const handleSetChaos = async (mockCode?: string) => {
    setChaosLoading(true)
    try {
      await api.setChaos(contractId, mockCode)
      await queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    } catch (err: any) {
      console.error('Chaos toggle failed:', err)
    } finally {
      setChaosLoading(false)
    }
  }

  return (
    <PageShell
      title={contract.title}
      subtitle={`Contract ID: ${contract.id}`}
      backHref="/studio"
      backLabel="Studio"
      actions={
        <div className="flex flex-wrap items-center gap-2.5">
          <ChainBadge contractId={contractId} />
          <VerifiedWithPayPalBadge contractId={contractId} />
          <Link
            href={`/contracts/${contractId}/ledger`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text hover:bg-surface-2 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-muted" />
            Ledger
          </Link>
          <a
            href={`/api/v1/contracts/${contractId}/proof-pack?format=pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-text hover:bg-surface-2 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5 text-brand" />
            Proof Pack (PDF)
          </a>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Banner Error */}
        {bannerError && (
          <ErrorState
            title="Action Error"
            message={bannerError}
            onRetry={() => setBannerError(null)}
          />
        )}

        {/* Funding At Risk Alert Banner */}
        {contract.funding_at_risk && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-warn/10 border border-warn/30 flex items-center gap-3 text-xs text-warn"
          >
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <div>
              <strong className="font-semibold block">Funding At Risk: PayPal Authorization Nearing Expiry</strong>
              <span>
                Reauthorization is active or required to maintain safe payment rails. Automated scheduler runs every 10 minutes.
              </span>
            </div>
          </div>
        )}

        {/* Seller Accept Banner (when PROPOSED) */}
        {contract.status === 'PROPOSED' && (
          <div className="p-6 rounded-2xl bg-brand/5 border border-brand/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-brand">
                  Review contract (not yet binding)
                </span>
                <h3 className="text-base font-semibold text-text">
                  Seller acceptance required
                </h3>
                <p className="text-xs text-muted">
                  Review the milestone criteria below. Accepting locks the canonical SHA-256 agreement hash cryptographically.
                </p>
                <div className="pt-1 flex items-center gap-2 text-xs">
                  <span className="text-muted">Will lock as:</span>
                  <MonoText value={contract.contract_hash} short />
                </div>
              </div>

              <button
                type="button"
                disabled={isAccepting}
                onClick={handleAcceptContract}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:opacity-95 transition-opacity shadow-sm focus:ring-2 focus:ring-brand focus:outline-none disabled:opacity-50 flex-shrink-0"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Locking terms…</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Accept and lock terms</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Buyer Fund Banner (when ACCEPTED) */}
        {contract.status === 'ACCEPTED' && (
          <div className="p-6 rounded-2xl bg-ok/5 border border-ok/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-ok">
                  Terms locked
                </span>
                <h3 className="text-base font-semibold text-text">
                  Ready for PayPal authorization hold
                </h3>
                <p className="text-xs text-muted">
                  The seller has agreed to the acceptance criteria. Deposit the authorization hold to activate the contract.
                </p>
              </div>

              <Link
                href={`/contracts/${contractId}/fund`}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-ok text-white text-sm font-semibold hover:opacity-95 transition-opacity shadow-sm flex-shrink-0"
              >
                <CreditCard className="w-4 h-4" />
                <span>Deposit PayPal hold</span>
              </Link>
            </div>
          </div>
        )}

        {/* Money Bar & Status Header */}
        <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatusChip status={contract.status} size="md" />
              <div className="flex flex-wrap items-center gap-2">
                {contract.honor_until && (
                  <Countdown
                    target={contract.honor_until}
                    label="Capture window"
                    warnBelowMs={24 * 3600 * 1000}
                  />
                )}
                {contract.auth_expires_at && (
                  <Countdown
                    target={contract.auth_expires_at}
                    label="Hold expires"
                    warnBelowMs={72 * 3600 * 1000}
                  />
                )}
              </div>
            </div>

            {/* Seller prominent safety indicator */}
            {isFunded && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-ok/10 text-ok border border-ok/20">
                <Lock className="w-3.5 h-3.5" />
                ✓ ${(contract.total_minor / 100).toFixed(2)} authorized. Safe to work.
              </span>
            )}
          </div>

          <FundsBar
            totalMinor={contract.total_minor}
            releasedMinor={releasedMinor}
            heldMinor={heldMinor}
            voidedMinor={voidedMinor}
          />
        </div>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Milestones Timeline (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">
                Milestone deliverables ({milestones.length})
              </h2>
              <span className="text-xs text-muted">Click any milestone to submit or review</span>
            </div>

            <div className="space-y-4">
              {milestones.map((m) => (
                <MilestoneCard
                  key={m.milestone_key || (m as any).key || m.id}
                  milestone={m}
                  contractId={contractId}
                  contractStatus={contract.status}
                  isBuyer={isBuyer}
                  isSeller={isSeller}
                  onRetryRelease={handleRetryRelease}
                  isRetrying={isRetryingRelease}
                />
              ))}
            </div>

            {/* Developer Chaos Testing Box */}
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setShowChaos(!showChaos)}
                className="text-xs text-muted hover:text-brand inline-flex items-center gap-1 font-mono"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>{showChaos ? 'Hide Chaos Testing Tools' : 'Show Chaos Testing Tools'}</span>
              </button>

              {showChaos && (
                <div className="mt-2 p-4 rounded-xl bg-surface-2 border border-border text-xs space-y-3">
                  <div className="font-semibold text-text">Chaos Mode Mock Injections (Sandbox)</div>
                  <p className="text-muted text-[11px]">
                    Inject simulated PayPal decline or timeout mock codes to test retry logic and resilience.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={chaosLoading}
                      onClick={() => handleSetChaos('422_CAPTURE_DECLINED')}
                      className="px-2.5 py-1 rounded bg-surface border border-border hover:bg-surface-2 font-mono"
                    >
                      Inject 422_CAPTURE_DECLINED
                    </button>
                    <button
                      type="button"
                      disabled={chaosLoading}
                      onClick={() => handleSetChaos('500_INTERNAL_SERVER_ERROR')}
                      className="px-2.5 py-1 rounded bg-surface border border-border hover:bg-surface-2 font-mono"
                    >
                      Inject 500_INTERNAL_SERVER_ERROR
                    </button>
                    <button
                      type="button"
                      disabled={chaosLoading}
                      onClick={() => handleSetChaos(undefined)}
                      className="px-2.5 py-1 rounded bg-brand text-white font-mono"
                    >
                      Clear Chaos Code
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Rail: Recent Audit Activity */}
          <div className="space-y-6">
            <RecentEvents
              events={ledgerData?.events}
              contractId={contractId}
            />
          </div>
        </div>
      </div>
    </PageShell>
  )
}
