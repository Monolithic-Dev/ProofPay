'use client'

/**
 * Contract Funding Screen — /contracts/[id]/fund
 * Authorizes a 29-day PayPal hold without upfront charging.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S3).
 */
import React, { useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, ArrowRight, Loader2, AlertCircle, Info, Lock, QrCode, Copy, Check, Share2, CreditCard } from 'lucide-react'
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
  const [copiedLink, setCopiedLink] = useState(false)
  const [showQr, setShowQr] = useState(false)

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
          <div className="pt-4 space-y-4">
            <button
              type="button"
              disabled={isStartingFunding}
              onClick={handleContinueToPayPal}
              className="w-full py-3.5 px-6 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-95 transition-opacity shadow-lg shadow-brand/20 flex items-center justify-center gap-2 focus:ring-2 focus:ring-brand focus:outline-none disabled:opacity-50"
            >
              {isStartingFunding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to PayPal Authorization Gateway…</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Authorize 29-Day Hold with PayPal</span>
                </>
              )}
            </button>

            {/* Shareable Low-Code Payment Link & Mobile QR Section */}
            <div className="p-4 rounded-xl bg-surface-2/40 border border-border/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-brand" />
                  Shareable Funding Link (Low-Code)
                </span>
                <button
                  type="button"
                  onClick={() => setShowQr(!showQr)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-brand transition-colors font-medium"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{showQr ? 'Hide QR' : 'Scan Mobile QR'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/contracts/${contractId}/fund` : `/contracts/${contractId}/fund`}
                  className="w-full bg-surface-subtle border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-muted select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      navigator.clipboard.writeText(`${window.location.origin}/contracts/${contractId}/fund`)
                      setCopiedLink(true)
                      setTimeout(() => setCopiedLink(false), 2000)
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-brand/40 text-text text-xs font-semibold shrink-0 transition-all inline-flex items-center gap-1"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* QR Code Drawer */}
              {showQr && (
                <div className="pt-2 pb-1 flex flex-col items-center justify-center space-y-2 border-t border-border/60">
                  <div className="p-3 bg-white rounded-xl shadow-md">
                    {/* High-contrast QR pattern svg */}
                    <svg className="w-32 h-32" viewBox="0 0 100 100" fill="black">
                      <rect x="0" y="0" width="30" height="30" fill="none" stroke="black" strokeWidth="6" />
                      <rect x="8" y="8" width="14" height="14" />
                      <rect x="70" y="0" width="30" height="30" fill="none" stroke="black" strokeWidth="6" />
                      <rect x="78" y="8" width="14" height="14" />
                      <rect x="0" y="70" width="30" height="30" fill="none" stroke="black" strokeWidth="6" />
                      <rect x="8" y="78" width="14" height="14" />
                      <rect x="40" y="10" width="8" height="8" />
                      <rect x="52" y="20" width="8" height="8" />
                      <rect x="40" y="40" width="20" height="20" />
                      <rect x="70" y="45" width="10" height="10" />
                      <rect x="15" y="45" width="10" height="10" />
                      <rect x="45" y="75" width="15" height="10" />
                      <rect x="75" y="75" width="15" height="15" />
                    </svg>
                  </div>
                  <span className="text-[11px] text-muted">Scan with phone camera to approve via mobile PayPal</span>
                </div>
              )}

              <p className="text-[11px] text-muted leading-relaxed">
                Accepts PayPal Wallet, Linked Checking, Pay in 4 / Pay Later, and Debit/Credit cards without immediate withdrawal.
              </p>
            </div>

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
