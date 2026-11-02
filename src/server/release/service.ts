/**
 * Release service — THE ONLY module that calls PayPal capture, void, and refund.
 * Implements the PASSED→RELEASING→RELEASED state machine with crash-safe design.
 */
import { eq, and, sql } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { milestones, contracts } from '@/server/db/schema'
import { captureAuthorization } from '@/server/paypal/capture'
import { voidAuthorization } from '@/server/paypal/void'
import { appendLedgerEvent } from '@/server/ledger/append'
import { assertMilestoneTransition } from '@/server/contracts/transitions'
import { logger } from '@/server/util/logger'
import { now, isoMs } from '@/server/util/time'
import { ConflictError, PayPalError } from '@/server/util/errors'
import type { Db } from '@/server/db/client'

export interface ReleaseMilestoneParams {
  contractId: string
  milestoneKey: string
}

/**
 * Execute a milestone payment release (capture from PayPal authorization).
 * Called ONLY from the RELEASE_MILESTONE job handler.
 *
 * Safety: milestone must be in PASSED state. We move it to RELEASING first
 * (committed), then call PayPal, then move to RELEASED or RELEASE_FAILED.
 * A crash between steps leaves RELEASING, which the reconcile job handles.
 */
export async function releaseMilestone(params: ReleaseMilestoneParams): Promise<void> {
  const { contractId, milestoneKey } = params
  const db = getDb()
  const log = logger.child({ contract_id: contractId, milestone_key: milestoneKey })

  // --- TX3a: PASSED → RELEASING (guard) ---
  const milestone = await db.transaction(async (tx) => {
    // Advisory lock for this contract
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${contractId}::text, 0)::bigint)`
    )

    const [m] = await tx
      .select()
      .from(milestones)
      .where(
        and(
          eq(milestones.contract_id, contractId),
          eq(milestones.milestone_key, milestoneKey)
        )
      )
      .for('update')

    if (!m) throw new ConflictError(`Milestone ${milestoneKey} not found`)
    assertMilestoneTransition(m.status as 'PASSED', 'RELEASING')

    const [contract] = await tx
      .select({ authorization_id: contracts.authorization_id, chaos_mock_code: contracts.chaos_mock_code })
      .from(contracts)
      .where(eq(contracts.id, contractId))

    if (!contract?.authorization_id) {
      throw new ConflictError('No authorization ID on contract — cannot capture')
    }

    // Build idempotency key: pp:{contractId}:{milestoneKey}:capture:{n}
    const attempt = (m.release_attempts ?? 0) + 1
    const idempotencyKey = `pp:${contractId}:${milestoneKey}:capture:${attempt}`

    // Update milestone → RELEASING
    await tx
      .update(milestones)
      .set({
        status: 'RELEASING',
        release_attempts: attempt,
      })
      .where(eq(milestones.id, m.id))

    // Determine if this is the final capture (last milestone)
    await appendLedgerEvent(tx as unknown as Db, {
      contractId,
      type: 'CAPTURE_REQUESTED',
      actorType: 'system',
      payload: {
        milestone_key: milestoneKey,
        amount_minor: m.amount_minor,
        idempotency_key: idempotencyKey,
        final_capture: false, // set correctly below
      },
    })

    return { milestone: m, contract, idempotencyKey, attempt }
  })

  // --- PayPal call (OUTSIDE any transaction) ---
  // Determine final_capture: is this the last milestone?
  const allMilestones = await db
    .select({ milestone_key: milestones.milestone_key, status: milestones.status })
    .from(milestones)
    .where(eq(milestones.contract_id, contractId))

  const remainingAfter = allMilestones.filter(
    (m) => m.milestone_key !== milestoneKey && m.status !== 'RELEASED'
  )
  const isFinal = remainingAfter.length === 0

  let captureId: string | undefined
  let captureError: string | undefined

  try {
    const result = await captureAuthorization({
      authorizationId: milestone.contract.authorization_id!,
      amountMinor: milestone.milestone.amount_minor,
      isFinal,
      idempotencyKey: milestone.idempotencyKey,
      mockCode: milestone.contract.chaos_mock_code ?? undefined,
    })
    captureId = result.id
    log.info({ capture_id: captureId, final: isFinal }, 'Capture completed')
  } catch (err) {
    captureError = String(err)
    log.error({ err: captureError }, 'Capture failed')
  }

  // --- TX3b: RELEASING → RELEASED or RELEASE_FAILED ---
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${contractId}::text, 0)::bigint)`
    )

    if (captureId) {
      await tx
        .update(milestones)
        .set({ status: 'RELEASED', capture_id: captureId, captured_at: now() })
        .where(eq(milestones.id, milestone.milestone.id))

      await appendLedgerEvent(tx as unknown as Db, {
        contractId,
        type: 'CAPTURE_COMPLETED',
        actorType: 'paypal',
        payload: {
          milestone_key: milestoneKey,
          capture_id: captureId,
          amount_minor: milestone.milestone.amount_minor,
        },
      })
    } else {
      await tx
        .update(milestones)
        .set({ status: 'RELEASE_FAILED' })
        .where(eq(milestones.id, milestone.milestone.id))

      await appendLedgerEvent(tx as unknown as Db, {
        contractId,
        type: 'CAPTURE_FAILED',
        actorType: 'paypal',
        payload: {
          milestone_key: milestoneKey,
          paypal_error: captureError ?? 'unknown',
          mock: !!milestone.contract.chaos_mock_code,
        },
      })
    }
  })

  if (captureError) {
    throw new PayPalError(`Milestone ${milestoneKey} release failed: ${captureError}`)
  }
}

/**
 * Void the remaining authorization hold when a contract fails terminally.
 */
export async function voidRemaining(contractId: string, reason: string): Promise<void> {
  const db = getDb()
  const [contract] = await db
    .select({ authorization_id: contracts.authorization_id, total_minor: contracts.total_minor })
    .from(contracts)
    .where(eq(contracts.id, contractId))

  if (!contract?.authorization_id) return // nothing to void

  await voidAuthorization(contract.authorization_id)
  await db.transaction(async (tx) => {
    await appendLedgerEvent(tx as unknown as Db, {
      contractId,
      type: 'AUTHORIZATION_VOIDED',
      actorType: 'system',
      payload: {
        authorization_id: contract.authorization_id,
        remaining_minor: contract.total_minor,
        reason,
      },
    })
  })
}
