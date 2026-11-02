/**
 * Ledger event types and payload schemas.
 * Implements data-model.md §5 — strict schemas for immutable hash-chained events.
 */
import { z } from 'zod'

export const LEDGER_EVENT_TYPES = [
  'CONTRACT_CREATED',
  'CONTRACT_LINTED',
  'CONTRACT_PROPOSED',
  'CONTRACT_ACCEPTED',
  'FUNDING_STARTED',
  'FUNDING_CANCELLED',
  'AUTHORIZATION_CREATED',
  'SUBMISSION_RECEIVED',
  'VERIFICATION_COMPLETED',
  'INJECTION_FLAGGED',
  'MILESTONE_PASSED',
  'MILESTONE_REJECTED',
  'MILESTONE_ESCALATED',
  'BUYER_DECISION',
  'AUTO_RELEASE_APPLIED',
  'CAPTURE_REQUESTED',
  'CAPTURE_COMPLETED',
  'CAPTURE_FAILED',
  'REAUTHORIZED',
  'AUTHORIZATION_VOIDED',
  'REFUND_ISSUED',
  'WEBHOOK_RECEIVED',
  'DISPUTE_OPENED',
  'EVIDENCE_SUBMITTED',
  'CONTRACT_COMPLETED',
  'CONTRACT_FAILED',
  'CONTRACT_CANCELLED',
  'CONTRACT_EXPIRED',
] as const

export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number]

export const LedgerPayloadSchemas: Record<LedgerEventType, z.ZodObject<any>> = {
  CONTRACT_CREATED: z
    .object({
      title: z.string(),
      total_minor: z.number().int().positive(),
      prompt_sha256: z.string().optional(),
    })
    .strict(),

  CONTRACT_LINTED: z
    .object({
      issue_counts: z
        .object({
          error: z.number().int().nonnegative(),
          warn: z.number().int().nonnegative(),
          info: z.number().int().nonnegative(),
        })
        .strict(),
    })
    .strict(),

  CONTRACT_PROPOSED: z
    .object({
      version: z.number().int().positive(),
    })
    .strict(),

  CONTRACT_ACCEPTED: z
    .object({
      contract_hash: z.string(),
    })
    .strict(),

  FUNDING_STARTED: z
    .object({
      paypal_order_id: z.string(),
      total_minor: z.number().int().positive(),
    })
    .strict(),

  FUNDING_CANCELLED: z
    .object({
      paypal_order_id: z.string(),
    })
    .strict(),

  AUTHORIZATION_CREATED: z
    .object({
      authorization_id: z.string(),
      honor_until: z.string(),
      auth_expires_at: z.string(),
    })
    .strict(),

  SUBMISSION_RECEIVED: z
    .object({
      milestone_key: z.string(),
      attempt: z.number().int().positive(),
      sha256: z.string(),
      size_bytes: z.number().int().positive(),
    })
    .strict(),

  VERIFICATION_COMPLETED: z
    .object({
      milestone_key: z.string(),
      decision: z.enum(['PASS', 'REJECT', 'ESCALATE']),
      reasons: z.array(z.any()),
      degraded: z.boolean(),
      cache_hit: z.boolean(),
      input_hash: z.string(),
    })
    .strict(),

  INJECTION_FLAGGED: z
    .object({
      milestone_key: z.string(),
      severity: z.enum(['none', 'low', 'high']),
      spans: z.array(z.string()).optional(),
    })
    .strict(),

  MILESTONE_PASSED: z
    .object({
      milestone_key: z.string(),
      revisions_used: z.number().int().nonnegative(),
    })
    .strict(),

  MILESTONE_REJECTED: z
    .object({
      milestone_key: z.string(),
      revisions_used: z.number().int().nonnegative(),
    })
    .strict(),

  MILESTONE_ESCALATED: z
    .object({
      milestone_key: z.string(),
      revisions_used: z.number().int().nonnegative(),
    })
    .strict(),

  BUYER_DECISION: z
    .object({
      milestone_key: z.string(),
      decision: z.enum(['PASS', 'REJECT']),
      note: z.string().optional(),
    })
    .strict(),

  AUTO_RELEASE_APPLIED: z
    .object({
      milestone_key: z.string(),
      hours_waited: z.number().nonnegative(),
    })
    .strict(),

  CAPTURE_REQUESTED: z
    .object({
      milestone_key: z.string(),
      amount_minor: z.number().int().positive(),
      idempotency_key: z.string(),
      final_capture: z.boolean(),
    })
    .strict(),

  CAPTURE_COMPLETED: z
    .object({
      milestone_key: z.string(),
      capture_id: z.string(),
      amount_minor: z.number().int().positive(),
    })
    .strict(),

  CAPTURE_FAILED: z
    .object({
      milestone_key: z.string(),
      paypal_error: z.string().optional(),
      mock: z.boolean().optional(),
    })
    .strict(),

  REAUTHORIZED: z
    .object({
      old_authorization_id: z.string(),
      new_authorization_id: z.string(),
      honor_until: z.string(),
    })
    .strict(),

  AUTHORIZATION_VOIDED: z
    .object({
      authorization_id: z.string(),
      remaining_minor: z.number().int().nonnegative(),
      reason: z.string(),
    })
    .strict(),

  REFUND_ISSUED: z
    .object({
      milestone_key: z.string(),
      capture_id: z.string(),
      refund_id: z.string(),
      amount_minor: z.number().int().positive(),
    })
    .strict(),

  WEBHOOK_RECEIVED: z
    .object({
      event_id: z.string(),
      event_type: z.string(),
    })
    .strict(),

  DISPUTE_OPENED: z
    .object({
      paypal_dispute_id: z.string(),
    })
    .strict(),

  EVIDENCE_SUBMITTED: z
    .object({
      paypal_dispute_id: z.string(),
    })
    .strict(),

  CONTRACT_COMPLETED: z
    .object({
      reason: z.string(),
    })
    .strict(),

  CONTRACT_FAILED: z
    .object({
      reason: z.string(),
    })
    .strict(),

  CONTRACT_CANCELLED: z
    .object({
      reason: z.string(),
    })
    .strict(),

  CONTRACT_EXPIRED: z
    .object({
      reason: z.string(),
    })
    .strict(),
}
