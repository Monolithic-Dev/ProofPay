'use client'

/**
 * Milestone Verification & Submission Screen — /contracts/[id]/milestones/[mid]
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S5).
 */
import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageShell } from '@/components/common/PageShell'
import { StatusChip } from '@/components/contract/StatusChip'
import { Money } from '@/components/common/Money'
import { SubmissionStepper } from '@/components/milestone/SubmissionStepper'
import { VerificationReport } from '@/components/milestone/VerificationReport'
import { ArtifactViewer } from '@/components/milestone/ArtifactViewer'
import { SubmitPanel } from '@/components/milestone/SubmitPanel'
import { EscalationActions } from '@/components/milestone/EscalationActions'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { useContract, useMilestone, useCurrentUser, useApiClient } from '@/lib/query'
import { useContractEvents } from '@/lib/sse'
import { useQueryClient } from '@tanstack/react-query'

export default function MilestoneDetailPage() {
  const params = useParams()
  const contractId = params?.id as string
  const mid = params?.mid as string
  const router = useRouter()
  const api = useApiClient()
  const queryClient = useQueryClient()

  // Real-time SSE updates
  useContractEvents(contractId)

  const { data: contract, isLoading: isLoadingContract } = useContract(contractId)
  const { data: milestone, isLoading: isLoadingMilestone, error } = useMilestone(contractId, mid)
  const { data: currentUser } = useCurrentUser()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeciding, setIsDeciding] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [submittedArtifact, setSubmittedArtifact] = useState<string | null>(null)

  if (isLoadingContract || isLoadingMilestone) {
    return (
      <PageShell title="Loading Milestone…" backHref={`/contracts/${contractId}`}>
        <LoadingBlock message="Connecting to milestone verification status…" />
      </PageShell>
    )
  }

  if (error || !milestone) {
    return (
      <PageShell title="Milestone Not Found" backHref={`/contracts/${contractId}`}>
        <ErrorState
          title="Milestone Unavailable"
          message={error?.message || 'Unable to load milestone details.'}
        />
      </PageShell>
    )
  }

  const isBuyer = currentUser?.role === 'buyer' || currentUser?.id === contract?.buyer_id
  const isSeller = currentUser?.role === 'seller' || currentUser?.id === contract?.seller_id

  const verification = milestone.latest_verification

  // Extract quotes from verification evidence for the ArtifactViewer
  const evidenceQuotes: string[] = []
  if (verification?.criteria) {
    for (const c of verification.criteria) {
      if (c.evidence) {
        for (const ev of c.evidence) {
          if (ev.quote) evidenceQuotes.push(ev.quote)
        }
      }
    }
  }

  const deliverableJson = (milestone as any)?.deliverable_json || {}
  const deliverableType = deliverableJson.type || 'text'
  const deliverableDesc = deliverableJson.description || ''

  const handleSubmitDeliverable = async (payload: {
    content_type: 'json_records' | 'text'
    content_text: string
    note?: string
    idempotency_key: string
  }) => {
    setIsSubmitting(true)
    setActionError(null)
    setSubmittedArtifact(payload.content_text)
    try {
      await api.submitDeliverable(contractId, mid, payload)
      await queryClient.invalidateQueries({ queryKey: ['milestone', contractId, mid] })
      await queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    } catch (err: any) {
      console.error('Submission failed:', err)
      setActionError(err.message || 'Deliverable submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEscalationDecision = async (decision: 'PASS' | 'REJECT', note?: string) => {
    setIsDeciding(true)
    setActionError(null)
    try {
      await api.decideEscalation(contractId, mid, decision, note)
      await queryClient.invalidateQueries({ queryKey: ['milestone', contractId, mid] })
      await queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    } catch (err: any) {
      console.error('Decision failed:', err)
      setActionError(err.message || 'Failed to submit escalation decision')
    } finally {
      setIsDeciding(false)
    }
  }

  return (
    <PageShell
      title={`Milestone [${milestone.milestone_key || (milestone as any).key || mid}]: ${milestone.title}`}
      subtitle={`Contract: ${contract?.title || contractId}`}
      backHref={`/contracts/${contractId}`}
      backLabel="Back to Timeline"
      actions={
        <div className="flex items-center gap-3">
          <Money minor={milestone.amount_minor} className="text-base font-bold text-text" />
          <StatusChip status={milestone.status} size="md" />
        </div>
      }
    >
      <div className="space-y-6">
        {actionError && (
          <ErrorState
            title="Operation Error"
            message={actionError}
            onRetry={() => setActionError(null)}
          />
        )}

        {/* Verification Stepper */}
        <SubmissionStepper
          milestoneStatus={milestone.status}
          verification={verification}
        />

        {/* Escalation Review Box for Buyer */}
        {milestone.status === 'ESCALATED' && (
          <EscalationActions
            autoReleaseAt={milestone.auto_release_at}
            onDecide={handleEscalationDecision}
            isDeciding={isDeciding}
          />
        )}

        {/* Deliverable Submission Panel (if PENDING or REJECTED) */}
        {(milestone.status === 'PENDING' || milestone.status === 'REJECTED') && (
          <SubmitPanel
            contractId={contractId}
            milestoneKey={milestone.milestone_key || (milestone as any).key || mid || 'm1'}
            deliverableType={deliverableType}
            deliverableDesc={deliverableDesc}
            onSubmit={handleSubmitDeliverable}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Verification Report */}
        {verification && (
          <VerificationReport verification={verification} />
        )}

        {/* Artifact Viewer (if artifact submitted or stored) */}
        {(submittedArtifact || (milestone as any)?.latest_artifact) && (
          <ArtifactViewer
            content={submittedArtifact || (milestone as any)?.latest_artifact}
            contentType={deliverableType}
            highlightQuotes={evidenceQuotes}
          />
        )}
      </div>
    </PageShell>
  )
}
