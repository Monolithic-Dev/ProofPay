'use client'

/**
 * MilestoneCard Component — individual milestone status & role-based action triggers.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S4).
 */
import React from 'react'
import Link from 'next/link'
import { StatusChip } from './StatusChip'
import { Money } from '@/components/common/Money'
import { Countdown } from './Countdown'
import { ArrowRight, RotateCw, FileCheck2, Send, Eye } from 'lucide-react'
import type { MilestoneView, ContractStatus } from '@/shared/types'

export interface MilestoneCardProps {
  milestone: MilestoneView
  contractId: string
  contractStatus: ContractStatus
  userRole?: string
  isBuyer?: boolean
  isSeller?: boolean
  onRetryRelease?: (milestoneKey: string) => void
  isRetrying?: boolean
}

export function MilestoneCard({
  milestone,
  contractId,
  contractStatus,
  isBuyer = false,
  isSeller = false,
  onRetryRelease,
  isRetrying = false,
}: MilestoneCardProps) {
  const mKey = milestone.milestone_key || (milestone as any).key || 'm1'
  const isFundedContract = contractStatus === 'FUNDED' || contractStatus === 'IN_PROGRESS'
  const targetHref = `/contracts/${contractId}/milestones/${mKey}`

  return (
    <div className="p-6 rounded-xl bg-surface border border-border shadow-sm hover:border-brand/30 transition-all space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-2 border border-border font-semibold text-text">
            {mKey}
          </span>
          <h3 className="font-semibold text-text text-base">{milestone.title}</h3>
        </div>

        <div className="flex items-center gap-2.5">
          <Money minor={milestone.amount_minor} className="text-base font-bold text-text" />
          <StatusChip status={milestone.status} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-border/60 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {milestone.due_at && (
            <span>
              Due: <strong className="text-text">{new Date(milestone.due_at).toLocaleDateString()}</strong>
            </span>
          )}
          <span>
            Attempts:{' '}
            <strong className="text-text">
              {milestone.revisions_used} of {milestone.max_revisions}
            </strong>
          </span>
          {milestone.capture_id && (
            <span>
              Capture:{' '}
              <code className="text-text font-mono bg-surface-2 px-1 rounded">
                {milestone.capture_id}
              </code>
            </span>
          )}
          {milestone.auto_release_at && (
            <Countdown
              target={milestone.auto_release_at}
              label="Auto-release"
              warnBelowMs={12 * 3600 * 1000}
            />
          )}
        </div>

        {/* Primary Action Button based on Role & Status */}
        <div className="flex items-center gap-2">
          {/* Seller submit work */}
          {isSeller && isFundedContract && (milestone.status === 'PENDING' || milestone.status === 'REJECTED') && (
            <Link
              href={targetHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white font-medium hover:opacity-95 transition-opacity text-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Submit deliverable
            </Link>
          )}

          {/* Buyer review escalation */}
          {isBuyer && milestone.status === 'ESCALATED' && (
            <Link
              href={targetHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warn text-white font-medium hover:opacity-95 transition-opacity text-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              Review evidence
            </Link>
          )}

          {/* Buyer retry release on failure */}
          {isBuyer && milestone.status === 'RELEASE_FAILED' && onRetryRelease && (
            <button
              type="button"
              disabled={isRetrying}
              onClick={() => onRetryRelease(mKey)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bad text-white font-medium hover:opacity-95 transition-opacity text-xs disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying…' : 'Retry PayPal release'}
            </button>
          )}

          {/* Default details/report link */}
          <Link
            href={targetHref}
            className="inline-flex items-center text-xs font-medium text-brand hover:underline px-2 py-1"
          >
            {milestone.latest_verification ? 'View verification report' : 'View milestone details'}
          </Link>
        </div>
      </div>
    </div>
  )
}
