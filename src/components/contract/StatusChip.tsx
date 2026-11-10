'use client'

/**
 * StatusChip Component — exhaustive visual chip for Contract and Milestone statuses.
 * Never color-only: combines distinct icons, explicit labels, and WCAG AA contrast colors.
 * Implements phase-6-frontend.md §6.3 & ux-flows.md §2-§3.
 */
import React from 'react'
import {
  FileEdit,
  Clock,
  Check,
  CheckCircle2,
  ShieldCheck,
  Activity,
  XCircle,
  AlertTriangle,
  AlertOctagon,
  Eye,
  Slash,
  Loader2,
  Circle,
} from 'lucide-react'
import type { ContractStatus, MilestoneStatus } from '@/shared/types'

export type AnyStatus = ContractStatus | MilestoneStatus | string

interface StatusConfig {
  label: string
  icon: React.ComponentType<{ className?: string }>
  badgeClass: string
  spin?: boolean
}

export const STATUS_CONFIG_MAP: Record<string, StatusConfig> = {
  // Contract statuses
  DRAFT: {
    label: 'Draft',
    icon: FileEdit,
    badgeClass: 'bg-surface-2 text-muted border-border',
  },
  PROPOSED: {
    label: 'Proposed',
    icon: Clock,
    badgeClass: 'bg-brand/10 text-brand border-brand/20',
  },
  ACCEPTED: {
    label: 'Accepted',
    icon: Check,
    badgeClass: 'bg-ok/10 text-ok border-ok/20',
  },
  FUNDING: {
    label: 'Funding',
    icon: Loader2,
    badgeClass: 'bg-brand/10 text-brand border-brand/20',
    spin: true,
  },
  FUNDED: {
    label: 'Funded',
    icon: ShieldCheck,
    badgeClass: 'bg-ok/10 text-ok border-ok/20',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    icon: Activity,
    badgeClass: 'bg-brand/10 text-brand border-brand/20',
  },
  COMPLETED: {
    label: 'Completed',
    icon: CheckCircle2,
    badgeClass: 'bg-ok/10 text-ok border-ok/20',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: XCircle,
    badgeClass: 'bg-void/20 text-void border-void/30',
  },
  EXPIRED: {
    label: 'Expired',
    icon: AlertOctagon,
    badgeClass: 'bg-bad/10 text-bad border-bad/20',
  },
  FAILED: {
    label: 'Failed',
    icon: AlertTriangle,
    badgeClass: 'bg-bad/10 text-bad border-bad/20',
  },

  // Milestone statuses
  PENDING: {
    label: 'Pending',
    icon: Circle,
    badgeClass: 'bg-surface-2 text-muted border-border',
  },
  SUBMITTED: {
    label: 'Submitted',
    icon: Clock,
    badgeClass: 'bg-brand/10 text-brand border-brand/20',
  },
  VERIFYING: {
    label: 'Verifying',
    icon: Loader2,
    badgeClass: 'bg-brand/10 text-brand border-brand/30',
    spin: true,
  },
  PASSED: {
    label: 'Passed',
    icon: Check,
    badgeClass: 'bg-ok/10 text-ok border-ok/20',
  },
  RELEASED: {
    label: 'Released',
    icon: CheckCircle2,
    badgeClass: 'bg-ok/10 text-ok border-ok/20',
  },
  REJECTED: {
    label: 'Rejected',
    icon: XCircle,
    badgeClass: 'bg-bad/10 text-bad border-bad/20',
  },
  FAILED_FINAL: {
    label: 'Final Failure',
    icon: AlertOctagon,
    badgeClass: 'bg-bad/10 text-bad border-bad/30',
  },
  ESCALATED: {
    label: 'Needs Review',
    icon: Eye,
    badgeClass: 'bg-warn/10 text-warn border-warn/30',
  },
  RELEASING: {
    label: 'Releasing',
    icon: Loader2,
    badgeClass: 'bg-brand/10 text-brand border-brand/30',
    spin: true,
  },
  RELEASE_FAILED: {
    label: 'Release Failed',
    icon: AlertTriangle,
    badgeClass: 'bg-bad/10 text-bad border-bad/30',
  },
  VOIDED: {
    label: 'Voided',
    icon: Slash,
    badgeClass: 'bg-void/20 text-void border-void/30',
  },
}

export interface StatusChipProps {
  status: AnyStatus
  size?: 'sm' | 'md'
  className?: string
}

export function StatusChip({ status, size = 'sm', className = '' }: StatusChipProps) {
  const normalized = status ? status.toUpperCase() : 'PENDING'
  const config: StatusConfig = STATUS_CONFIG_MAP[normalized] || {
    label: normalized,
    icon: Circle,
    badgeClass: 'bg-surface-2 text-muted border-border',
    spin: false,
  }

  const IconComponent = config.icon

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-sm gap-1.5'

  return (
    <span
      role="status"
      aria-label={`Status: ${config.label}`}
      className={`inline-flex items-center font-medium rounded-full border ${config.badgeClass} ${sizeClass} ${className}`}
    >
      <IconComponent
        className={`w-3.5 h-3.5 flex-shrink-0 ${config.spin ? 'animate-spin' : ''}`}
      />
      <span>{config.label}</span>
    </span>
  )
}
