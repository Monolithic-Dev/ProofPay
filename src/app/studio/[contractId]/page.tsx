'use client'

/**
 * Contract Studio Inspection & Propose Page — /studio/[contractId]
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S1).
 */
import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageShell } from '@/components/common/PageShell'
import { ContractEditor } from '@/components/studio/ContractEditor'
import { LintPanel } from '@/components/studio/LintPanel'
import { ProposeBar } from '@/components/studio/ProposeBar'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { useContract, useApiClient } from '@/lib/query'
import { useQueryClient } from '@tanstack/react-query'

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
      subtitle="Inspect acceptance criteria, fix ambiguities with one click, and propose to seller"
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

          {/* Right Rail: Ambiguity & Lint Panel */}
          <div className="space-y-6">
            <LintPanel
              issues={issues}
              onApplyFix={handleApplyFix}
              isFixing={isFixing}
            />
          </div>
        </div>
      </div>
    </PageShell>
  )
}
