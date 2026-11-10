/**
 * AUTO_RELEASE Job Handler.
 * Implements phase-4-verification-engine.md §4.8 and
 * docs/v2/PROOFPAY-FULL-AUDIT-AND-IMPROVEMENTS.md M-10 & AIP-12.
 *
 * Automatically releases milestone hold when a buyer remains silent during the review window,
 * with strict exploit guards preventing auto-release if manipulation, injection, or verifier
 * degradation was flagged.
 */
import { eq, desc } from 'drizzle-orm'
import { withTx, lockContract } from '@/server/db/client'
import { milestones, submissions, verifications } from '@/server/db/schema'
import { assertMilestoneTransition } from '@/server/contracts/transitions'
import { appendLedgerEvent } from '@/server/ledger/append'
import { enqueueJob } from '@/server/jobs/queue'
import { logger } from '@/server/util/logger'
import { AppError } from '@/server/util/errors'

export interface AutoReleasePayload {
  contract_id: string
  milestone_id: string
  verification_id?: string
}

const BLOCKING_REASON_CODES = new Set([
  'POSSIBLE_MANIPULATION',
  'MANIPULATION_DETECTED',
  'INJECTION_LOW',
  'INJECTION_HIGH',
  'VERIFIER_UNAVAILABLE',
  'DEGRADED',
])

export interface AutoReleaseVerificationCheckInput {
  manipulation_severity?: string | null
  degraded?: boolean | null
  reasons?: unknown
}

/**
 * Pure guard deciding whether an escalated verification must block silent auto-release.
 * Handles lowercase/uppercase severity values accurately ('none' vs 'low' | 'high').
 */
export function shouldBlockAutoRelease(verif: AutoReleaseVerificationCheckInput | null | undefined): {
  blocked: boolean
  reason?: string
} {
  if (!verif) {
    return { blocked: false }
  }

  const severity = String(verif.manipulation_severity ?? 'none').trim().toLowerCase()
  if (severity !== 'none' && severity !== '') {
    return {
      blocked: true,
      reason: `Manipulation severity '${severity}' flagged during verification; requires human adjudication`,
    }
  }

  if (verif.degraded === true) {
    return {
      blocked: true,
      reason: 'Verification ran in degraded mode; requires human adjudication instead of auto-release',
    }
  }

  if (Array.isArray(verif.reasons)) {
    for (const r of verif.reasons) {
      const code =
        typeof r === 'string'
          ? r.split(':')[0]?.trim()
          : r && typeof r === 'object' && 'code' in r
          ? String((r as { code: unknown }).code)
          : undefined

      if (code && BLOCKING_REASON_CODES.has(code)) {
        return {
          blocked: true,
          reason: `Blocking verification reason '${code}' requires explicit human resolution`,
        }
      }
    }
  }

  return { blocked: false }
}

export async function handleAutoRelease(payload: AutoReleasePayload): Promise<void> {
  const { contract_id, milestone_id, verification_id } = payload
  const log = logger.child({ contract_id, milestone_id, verification_id })

  await withTx(async (tx) => {
    await lockContract(tx, contract_id)

    const [milestone] = await tx
      .select()
      .from(milestones)
      .where(eq(milestones.id, milestone_id))

    if (!milestone) {
      throw new AppError('NOT_FOUND', `Milestone ${milestone_id} not found`, 404)
    }

    // If milestone is no longer in ESCALATED state, buyer resolved it: safe no-op
    if (milestone.status !== 'ESCALATED') {
      log.info(
        { status: milestone.status },
        'handleAutoRelease: milestone is no longer ESCALATED; skipping'
      )
      return
    }

    // Verify deadline has passed
    if (milestone.auto_release_at && new Date() < new Date(milestone.auto_release_at)) {
      log.warn(
        { auto_release_at: milestone.auto_release_at },
        'handleAutoRelease: triggered before auto_release_at deadline; skipping'
      )
      return
    }

    // Exploit Guard (M-10 / AIP-12): Check referenced verification or latest milestone verification
    let verif: {
      id: string
      manipulation_severity: string | null
      degraded: boolean
      reasons: unknown
    } | undefined

    if (verification_id) {
      const [found] = await tx
        .select({
          id: verifications.id,
          manipulation_severity: verifications.manipulation_severity,
          degraded: verifications.degraded,
          reasons: verifications.reasons,
        })
        .from(verifications)
        .where(eq(verifications.id, verification_id))
      verif = found
    } else {
      const [latestSub] = await tx
        .select({ id: submissions.id })
        .from(submissions)
        .where(eq(submissions.milestone_id, milestone_id))
        .orderBy(desc(submissions.attempt))
        .limit(1)

      if (latestSub) {
        const [found] = await tx
          .select({
            id: verifications.id,
            manipulation_severity: verifications.manipulation_severity,
            degraded: verifications.degraded,
            reasons: verifications.reasons,
          })
          .from(verifications)
          .where(eq(verifications.submission_id, latestSub.id))
        verif = found
      }
    }

    const blockCheck = shouldBlockAutoRelease(verif)
    if (blockCheck.blocked) {
      log.warn(
        { verification_id: verif?.id ?? verification_id, reason: blockCheck.reason },
        'handleAutoRelease: blocked due to security or degraded flag; routing to manual dispute'
      )
      await appendLedgerEvent(tx, {
        contractId: contract_id,
        type: 'AUTO_RELEASE_BLOCKED_SECURITY_RISK',
        actorType: 'system',
        payload: {
          milestone_id,
          milestone_key: milestone.milestone_key,
          verification_id: verif?.id ?? verification_id ?? null,
          reason: blockCheck.reason,
        },
      })
      return
    }

    // Transition ESCALATED → PASSED
    assertMilestoneTransition('ESCALATED', 'PASSED')

    await tx
      .update(milestones)
      .set({ status: 'PASSED' })
      .where(eq(milestones.id, milestone_id))

    await appendLedgerEvent(tx, {
      contractId: contract_id,
      type: 'AUTO_RELEASE_TRIGGERED',
      actorType: 'system',
      payload: {
        milestone_id,
        milestone_key: milestone.milestone_key,
        verification_id: verif?.id ?? verification_id ?? null,
        deadline: milestone.auto_release_at ? new Date(milestone.auto_release_at).toISOString() : null,
      },
    })

    // Enqueue release milestone job
    await enqueueJob(
      tx,
      'RELEASE_MILESTONE',
      {
        contract_id,
        milestone_id,
        verification_id: verif?.id ?? verification_id,
      },
      {
        dedupeKey: `release:${milestone_id}`,
      }
    )

    log.info({ milestone_id }, 'handleAutoRelease: milestone passed and release enqueued')
  })
}
