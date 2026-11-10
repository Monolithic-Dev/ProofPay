'use client'

/**
 * Contract Studio Inspection & Propose Page — /studio/[contractId]
 * Implements phase-6-frontend.md §6.4 & docs/v2/PROOFPAY-WINNING-PLAN.md B5.
 */
import React, { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageShell } from '@/components/common/PageShell'
import { ContractEditor } from '@/components/studio/ContractEditor'
import { LintPanel } from '@/components/studio/LintPanel'
import { LoopholeFinderPanel } from '@/components/studio/LoopholeFinderPanel'
import { ProposeBar } from '@/components/studio/ProposeBar'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { useContract, useApiClient } from '@/lib/query'
import { useQueryClient } from '@tanstack/react-query'
import { computeClarityScore } from '@/lib/clarity'

export default function StudioContractDetailPage() {
  const params = useParams()
  const contractId = params?.contractId as string
  const router = useRouter()
  const api = useApiClient()
  const queryClient = useQueryClient()

  const { data: contract, isLoading, error } = useContract(contractId)
  const [isFixing, setIsFixing] = useState(false)
  const [isProposing, setIsProposing] = useState(false)
  const [isSavingJson, setIsSavingJson] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const clarity = useMemo(() => {
    if (!contract) return null
    return computeClarityScore(contract.contract_json || contract)
  }, [contract])

  if (isLoading) {
    return (
      <PageShell title="Loading Contract…" backHref="/studio">
        <LoadingBlock message="Loading contract draft and ambiguity diagnostics…" />
      </PageShell>
    )
  }

  if (error || !contract) {
    return (
      <PageShell title="Contract Error" backHref="/studio">
        <ErrorState
          title="Contract Not Found"
          message={error?.message || 'The requested contract draft does not exist or has expired.'}
          onRetry={() => router.refresh()}
        />
      </PageShell>
    )
  }

  // If already proposed or accepted, redirect to contract timeline
  if (contract.status !== 'DRAFT') {
    router.replace(`/contracts/${contract.id}`)
    return null
  }

  const issues = contract.lint_json?.issues || []

  const handleApplyFix = async (codeOrId: string) => {
    setIsFixing(true)
    setActionError(null)
    try {
      await api.applyLintFix(contractId, codeOrId)
      await queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    } catch (err: any) {
      console.error('Failed to apply fix:', err)
      setActionError(err.message || 'Failed to apply lint fix')
    } finally {
      setIsFixing(false)
    }
  }

  const handlePatchJson = async (newJson: Record<string, unknown>) => {
    setIsSavingJson(true)
    setActionError(null)
    try {
      await api.patchContract(contractId, newJson)
      await queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    } catch (err: any) {
      console.error('Failed to update contract:', err)
      setActionError(err.message || 'Failed to update contract JSON')
    } finally {
      setIsSavingJson(false)
    }
  }

  const handlePropose = async (sellerEmail: string) => {
    setIsProposing(true)
    setActionError(null)
    try {
      await api.proposeContract(contractId, sellerEmail)
      await queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
      router.push(`/contracts/${contractId}`)
    } catch (err: any) {
      console.error('Failed to propose contract:', err)
      setActionError(err.message || 'Failed to propose contract to seller')
    } finally {
      setIsProposing(false)
    }
  }

  return (
    <PageShell
      title="Review &amp; Refine Draft"
      subtitle="Inspect acceptance criteria, fix ambiguities, close red-team loopholes, and propose to seller"
      backHref="/studio"
      backLabel="Back to Studio"
    >
      <div className="space-y-6">
        {actionError && (
          <ErrorState
            title="Operation Failed"
            message={actionError}
            onRetry={() => setActionError(null)}
          />
        )}

        {/* Criteria Clarity Score Header Banner */}
        {clarity && (
          <div className="p-5 rounded-2xl bg-surface border border-border/80 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg font-mono border ${
                    clarity.score >= 90
                      ? 'bg-ok/10 text-ok border-ok/30'
                      : clarity.score >= 75
                      ? 'bg-brand/10 text-brand border-brand/30'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                  }`}
                >
                  {clarity.score}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-text">Criteria Clarity Score</h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        clarity.rating === 'EXCELLENT'
                          ? 'bg-ok/10 text-ok border-ok/20'
                          : clarity.rating === 'GOOD'
                          ? 'bg-brand/10 text-brand border-brand/20'
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      }`}
                    >
                      {clarity.rating}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    Dispute Risk:{' '}
                    <span
                      className={`font-semibold ${
                        clarity.disputeRisk === 'LOW'
                          ? 'text-ok'
                          : clarity.disputeRisk === 'MEDIUM'
                          ? 'text-amber-500'
                          : 'text-bad'
                      }`}
                    >
                      {clarity.disputeRisk}
                    </span>{' '}
                    &bull; {clarity.metrics.deterministicPct}% deterministic checks
                  </p>
                </div>
              </div>

              {clarity.score < 100 && (
                <div className="text-xs text-muted max-w-sm sm:text-right">
                  <p className="font-medium text-text text-[11px]">Why not 100?</p>
                  <p className="text-[10px] text-muted line-clamp-2">{clarity.reasons[0]}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Contract Editor (2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            <ContractEditor
              contract={contract}
              onPatchJson={handlePatchJson}
              isSaving={isSavingJson}
            />

            <ProposeBar
              onPropose={handlePropose}
              issues={issues}
              isProposing={isProposing}
            />
          </div>

          {/* Right Rail: Ambiguity & Lint Panel + Red-Team Loophole Finder */}
          <div className="space-y-6">
            <LintPanel
              issues={issues}
              onApplyFix={handleApplyFix}
              isFixing={isFixing}
            />

            <LoopholeFinderPanel
              contractId={contractId}
              contractVersion={contract.version}
              onContractUpdated={async () => {
                await queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
              }}
            />
          </div>
        </div>
      </div>
    </PageShell>
  )
}
