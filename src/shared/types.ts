import { z } from 'zod'

// ---------------------------------------------------------------------------
// Enums (exactly matching data-model.md §2)
// ---------------------------------------------------------------------------
export const ContractStatus = z.enum([
  'DRAFT',
  'PROPOSED',
  'ACCEPTED',
  'FUNDING',
  'FUNDED',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
])
export type ContractStatus = z.infer<typeof ContractStatus>

export const MilestoneStatus = z.enum([
  'PENDING',
  'SUBMITTED',
  'VERIFYING',
  'PASSED',
  'REJECTED',
  'ESCALATED',
  'RELEASING',
  'RELEASED',
  'RELEASE_FAILED',
  'FAILED_FINAL',
  'VOIDED',
])
export type MilestoneStatus = z.infer<typeof MilestoneStatus>

export const CriterionType = z.enum(['deterministic', 'rubric', 'human'])
export type CriterionType = z.infer<typeof CriterionType>

export const Decision = z.enum(['PASS', 'REJECT', 'ESCALATE'])
export type Decision = z.infer<typeof Decision>

export const UserRole = z.enum(['buyer', 'seller', 'admin'])
export type UserRole = z.infer<typeof UserRole>

// ---------------------------------------------------------------------------
// API response shapes (from api-spec.md §3 and §10)
// ---------------------------------------------------------------------------
export const LintIssue = z.object({
  id: z.string().optional(),
  code: z.string(),
  severity: z.enum(['error', 'warn', 'warning', 'info']),
  path: z.string(),
  message: z.string(),
  fix: z.string().optional(),
  suggested_fix: z
    .object({
      description: z.string(),
      patch: z.unknown().optional(),
    })
    .optional(),
})
export type LintIssue = z.infer<typeof LintIssue>

export const CriterionResult = z.object({
  criterion_key: z.string(),
  type: CriterionType,
  passed: z.boolean().optional(),
  status: z.string().optional(),
  score: z.number().min(0).max(1).optional(),
  evidence: z.any().optional(),
  reason: z.string().optional(),
  message: z.string().optional(),
  observed: z.unknown().optional(),
  expected: z.unknown().optional(),
  confidence: z.number().optional(),
})
export type CriterionResult = z.infer<typeof CriterionResult>

export const VerificationView = z.object({
  id: z.string().uuid(),
  submission_id: z.string().uuid(),
  milestone_key: z.string().optional(),
  status: z.enum(['RUNNING', 'COMPLETE', 'FAILED']),
  decision: Decision.optional().nullable(),
  reasons: z.array(
    z.object({
      code: z.string(),
      criterion_key: z.string().optional(),
      message: z.string(),
    })
  ),
  criteria: z.array(z.any()).optional(),
  manipulation: z
    .object({
      severity: z.enum(['none', 'low', 'high']).or(z.string()),
      spans: z.array(z.any()).optional(),
    })
    .optional(),
  stage1: z.array(CriterionResult).optional(),
  stage2: z.array(CriterionResult).optional(),
  stage3: z.any().optional(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  manipulation_severity: z.enum(['none', 'low', 'high']).optional().nullable(),
  degraded: z.boolean(),
  cache_hit: z.boolean(),
  model: z.string().optional().nullable(),
  prompt_version: z.string().optional().nullable(),
  latency_ms: z.number().optional().nullable(),
  created_at: z.string(),
  completed_at: z.string().optional().nullable(),
})
export type VerificationView = z.infer<typeof VerificationView>

export const MilestoneView = z.object({
  id: z.string().uuid().optional(),
  contract_id: z.string().uuid().optional(),
  milestone_key: z.string(),
  key: z.string().optional(),
  idx: z.number().optional(),
  title: z.string(),
  amount_minor: z.number(),
  due_in_days: z.number().optional(),
  due_at: z.string().optional().nullable(),
  status: MilestoneStatus,
  revisions_used: z.number(),
  max_revisions: z.number(),
  deliverable: z
    .object({
      content_type: z.enum(['json_records', 'text']),
      max_bytes: z.number(),
      description: z.string(),
    })
    .optional(),
  deliverable_json: z.record(z.unknown()).optional(),
  capture_id: z.string().optional().nullable(),
  captured_at: z.string().optional().nullable(),
  escalated_at: z.string().optional().nullable(),
  auto_release_at: z.string().optional().nullable(),
  latest_verification: VerificationView.optional().nullable(),
})
export type MilestoneView = z.infer<typeof MilestoneView>

export const ContractView = z.object({
  id: z.string().uuid(),
  buyer_id: z.string().uuid(),
  seller_id: z.string().uuid().optional(),
  title: z.string(),
  status: ContractStatus,
  contract_json: z.record(z.unknown()),
  contract_hash: z.string().optional(),
  lint_json: z.object({
    issues: z.array(LintIssue),
  }),
  version: z.number(),
  currency: z.literal('USD'),
  total_minor: z.number(),
  paypal_order_id: z.string().optional(),
  authorization_id: z.string().optional(),
  honor_until: z.string().optional(),
  auth_expires_at: z.string().optional(),
  funded_at: z.string().optional(),
  funding_at_risk: z.boolean(),
  milestones: z.array(MilestoneView).optional(),
  created_at: z.string(),
  updated_at: z.string(),
  accepted_at: z.string().optional(),
  completed_at: z.string().optional(),
})
export type ContractView = z.infer<typeof ContractView>

export const LedgerEvent = z.object({
  id: z.string().uuid(),
  contract_id: z.string().uuid(),
  seq: z.number(),
  type: z.string(),
  actor_type: z.enum(['buyer', 'seller', 'system', 'paypal', 'verifier']),
  actor_id: z.string().uuid().optional(),
  payload: z.record(z.unknown()),
  prev_hash: z.string(),
  hash: z.string(),
  created_at: z.string(),
})
export type LedgerEvent = z.infer<typeof LedgerEvent>

export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    request_id: z.string(),
  }),
})
export type ApiError = z.infer<typeof ApiError>

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------
export const SubmissionView = z.object({
  id: z.string().uuid(),
  milestone_id: z.string().uuid(),
  attempt: z.number(),
  submitted_by: z.string().uuid(),
  content_type: z.enum(['json_records', 'text']),
  size_bytes: z.number(),
  sha256: z.string(),
  note: z.string().optional(),
  created_at: z.string(),
})
export type SubmissionView = z.infer<typeof SubmissionView>

// ---------------------------------------------------------------------------
// User / auth
// ---------------------------------------------------------------------------
export const UserView = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string(),
  role: UserRole,
  is_agent: z.boolean(),
  persona_key: z.string().optional(),
})
export type UserView = z.infer<typeof UserView>

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------
export const DemoRunView = z.object({
  id: z.string().uuid(),
  scenario: z.enum([
    'happy_path',
    'reject_then_pass',
    'injection_attack',
    'capture_declined',
    'silent_buyer_autorelease',
  ]),
  status: z.enum(['RUNNING', 'WAITING_FOR_BUYER', 'DONE', 'FAILED']),
  contract_id: z.string().uuid().optional(),
  events: z.array(
    z.object({
      t: z.string(),
      actor: z.string(),
      kind: z.string(),
      text: z.string(),
      data: z.unknown().optional(),
    })
  ),
  created_at: z.string(),
  finished_at: z.string().optional(),
})
export type DemoRunView = z.infer<typeof DemoRunView>

export const ApiKeyView = z.object({
  id: z.string(),
  label: z.string(),
  keyPrefix: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  lastUsedAt: z.union([z.string(), z.date()]).nullable().optional(),
  revokedAt: z.union([z.string(), z.date()]).nullable().optional(),
})
export type ApiKeyView = z.infer<typeof ApiKeyView>
