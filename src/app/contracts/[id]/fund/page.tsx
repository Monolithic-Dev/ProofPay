'use client'

/**
 * Contract Funding Screen — /contracts/[id]/fund
 * Authorizes a 29-day PayPal hold without upfront charging.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S3).
 */
import React, { useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, ArrowRight, Loader2, AlertCircle, Info, Lock } from 'lucide-react'
import { PageShell } from '@/components/common/PageShell'
import { Money } from '@/components/common/Money'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { useContract, useApiClient } from '@/lib/query'

export default function FundContractPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const api = useApiClient()

  const contractId = params?.id as string
  const { data: contract, isLoading, error } = useContract(contractId)

  const [isStartingFunding, setIsStartingFunding] = useState(false)
  const [fundingError, setFundingError] = useState<string | null>(null)

  const isCancelled = searchParams?.get('cancelled') === '1'
  const urlError = searchParams?.get('error')

  if (isLoading) {
    return (
      <PageShell title="Loading Payment Details…" backHref={`/contracts/${contractId}`}>
        <LoadingBlock message="Retrieving contract settlement details…" />
      </PageShell>
    )
  }

  if (error || !contract) {
    return (
      <PageShell title="Payment Error" backHref="/">
        <ErrorState
          title="Contract Unavailable"
          message={error?.message || 'Unable to load contract details for funding.'}
        />
      </PageShell>
    )
  }

  // If already funded or past funding
  if (['FUNDED', 'IN_PROGRESS', 'COMPLETED'].includes(contract.status)) {
    router.replace(`/contracts/${contractId}`)
    return null
  }

  const handleContinueToPayPal = async () => {
    setIsStartingFunding(true)
    setFundingError(null)
    try {
      const res = await api.startFunding(contractId)
      if (res?.approval_url) {
        window.location.assign(res.approval_url)
      } else {
        throw new Error('No approval URL returned from PayPal')
      }
    } catch (err: any) {
      console.error('Funding initiation failed:', err)
      setFundingError(err.message || 'Failed to initialize PayPal authorization')
      setIsStartingFunding(false)
    }
  }

  return (
    <PageShell
      title="Deposit Authorization Hold"
      subtitle="Funds are held safely on PayPal — never charged until deliverables are proven"
      backHref={`/contracts/${contractId}`}
      backLabel="Back to Contract"
      maxWidth="5xl"
    >
      <div className="max-w-xl mx-auto space-y-6 pt-4">
        {/* Cancelled Banner */}
        {isCancelled && (
          <div className="p-4 rounded-xl bg-surface-2 border border-border flex items-center gap-3 text-xs text-muted">
            <Info className="w-4 h-4 text-brand flex-shrink-0" />
            <span>Funding was cancelled on PayPal. Your agreement remains active and ready to fund.</span>
          </div>
        )}

        {/* URL Error Banner */}
        {urlError && (
          <div className="p-4 rounded-xl bg-bad/10 border border-bad/20 flex items-center gap-3 text-xs text-bad">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>PayPal Error: {decodeURIComponent(urlError)}</span>
          </div>
        )}

        {/* Runtime API Error */}
        {fundingError && (
          <ErrorState
            title="PayPal Authorization Failed"
            message={fundingError}
            onRetry={handleContinueToPayPal}
          />
        )}

        {/* Main Card */}
        <div className="p-8 rounded-2xl bg-surface border border-border shadow-sm space-y-6">
          <div className="text-center space-y-2 border-b border-border pb-6">
            <div className="w-12 h-12 rounded-full bg-brand/10 text-brand mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-text">Held, not charged.</h2>
            <p className="text-sm text-muted">
              You pay only for milestone work that passes its verified acceptance checks.
            </p>
          </div>

          {/* Amount Box */}
          <div className="p-4 rounded-xl bg-surface-2/60 border border-border flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs text-muted">Authorization Amount</span>
              <div className="text-sm font-semibold text-text">{contract.title}</div>
            </div>
            <Money minor={contract.total_minor} className="text-2xl font-bold text-brand" />
          </div>

          {/* 3 Guarantees */}
          <div className="space-y-3 text-xs text-muted">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-ok flex-shrink-0 mt-0.5" />
              <span>
                <strong>29-Day PayPal Hold:</strong> A temporary authorization secures funds without moving money upfront.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-ok flex-shrink-0 mt-0.5" />
              <span>
                <strong>Proven Release:</strong> Code triggers partial capture only after deliverables pass all criteria.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-ok flex-shrink-0 mt-0.5" />
              <span>
                <strong>Automated Void:</strong> Unused funds are released immediately upon contract completion or cancellation.
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 space-y-3">
            <button
              type="button"
              disabled={isStartingFunding}
              onClick={handleContinueToPayPal}
              className="w-full py-3 px-6 rounded-lg bg-brand text-white text-sm font-semibold hover:opacity-95 transition-opacity shadow-sm flex items-center justify-center gap-2 focus:ring-2 focus:ring-brand focus:outline-none disabled:opacity-50"
            >
              {isStartingFunding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to PayPal…</span>
                </>
              ) : (
                <span>Authorize hold on PayPal</span>
              )}
            </button>

            <div className="text-center">
              <Link
                href={`/contracts/${contractId}`}
                className="text-xs text-muted hover:text-text transition-colors"
              >
                Cancel and return to contract
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
