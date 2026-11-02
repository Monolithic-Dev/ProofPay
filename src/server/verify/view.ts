/**
 * Verification & Milestone View Mappers.
 * Implements api-spec.md §3 & phase-4-verification-engine.md §4.9.
 */
import type { MilestoneStatus } from '@/shared/types'
import type { verifications, milestones } from '@/server/db/schema'

export interface CriterionResult {
  criterion_key: string
  type: 'deterministic' | 'rubric' | 'human'
  status: 'pass' | 'fail' | 'cannot_verify' | 'needs_human'
  message: string
  observed?: unknown
  expected?: unknown
  score?: number
  confidence?: number
  evidence?: Array<{ quote: string; verified: boolean; hint?: string }>
}

export interface VerificationView {
  id: string
  submission_id: string
  milestone_key: string
  decision: 'PASS' | 'REJECT' | 'ESCALATE' | null
  status: 'RUNNING' | 'COMPLETE' | 'FAILED'
  reasons: Array<{ code: string; criterion_key?: string; message: string }>
  criteria: CriterionResult[]
  manipulation: {
    severity: 'none' | 'low' | 'high'
    spans: Array<{ quote: string; reason: string }>
  }
  degraded: boolean
  cache_hit: boolean
  model: string | null
  prompt_version: string | null
  created_at: string
  completed_at: string | null
}

export interface MilestoneView {
  key: string
  title: string
  amount_minor: number
  status: MilestoneStatus
  due_at: string | null
  revisions_used: number
  max_revisions: number
  capture_id: string | null
  auto_release_at: string | null
  latest_verification: VerificationView | null
}

type VerificationRow = typeof verifications.$inferSelect
type MilestoneRow = typeof milestones.$inferSelect

export function toVerificationView(
  row: VerificationRow,
  milestoneKey = ''
): VerificationView {
  // Aggregate Stage 1 and Stage 2 criteria into CriterionResult[]
  const criteriaList: CriterionResult[] = []

  const s1 = (row.stage1_json as any[]) || []
  for (const c of s1) {
    criteriaList.push({
      criterion_key: c.criterion_key,
      type: 'deterministic',
      status: c.passed || c.status === 'pass' ? 'pass' : 'fail',
      message: c.message || c.reason || '',
      observed: c.failing_rows,
    })
  }

  const s2 = (row.stage2_json as any[]) || []
  for (const c of s2) {
    criteriaList.push({
      criterion_key: c.criterion_key,
      type: 'rubric',
      status: c.verdict ?? 'cannot_verify',
      message: c.reasoning || c.reason || '',
      score: c.score,
      confidence: c.confidence,
      evidence: Array.isArray(c.evidence)
        ? c.evidence.map((e: any) => ({
            quote: typeof e === 'string' ? e : e.quote,
            verified: c.evidence_verified ?? true,
            hint: typeof e === 'object' ? e.hint : undefined,
          }))
        : [],
    })
  }

  const s3 = (row.stage3_json as any) || {}
  const manipulation = {
    severity: (row.manipulation_severity as 'none' | 'low' | 'high') || 'none',
    spans: Array.isArray(s3.spans)
      ? s3.spans.map((s: any) => ({
          quote: typeof s === 'string' ? s : s.quote ?? '',
          reason: typeof s === 'object' ? s.reason ?? '' : '',
        }))
      : [],
  }

  return {
    id: row.id,
    submission_id: row.submission_id,
    milestone_key: milestoneKey,
    decision: row.decision,
    status: row.status as 'RUNNING' | 'COMPLETE' | 'FAILED',
    reasons: (row.reasons as any[]) || [],
    criteria: criteriaList,
    manipulation,
    degraded: row.degraded,
    cache_hit: row.cache_hit,
    model: row.model,
    prompt_version: row.prompt_version,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
    completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  }
}

export function toMilestoneView(
  row: MilestoneRow,
  latestVerification: VerificationView | null = null
): MilestoneView {
  return {
    key: row.milestone_key,
    title: row.title,
    amount_minor: row.amount_minor,
    status: row.status as MilestoneStatus,
    due_at: row.due_at ? new Date(row.due_at).toISOString() : null,
    revisions_used: row.revisions_used,
    max_revisions: row.max_revisions,
    capture_id: row.capture_id,
    auto_release_at: row.auto_release_at ? new Date(row.auto_release_at).toISOString() : null,
    latest_verification: latestVerification,
  }
}
