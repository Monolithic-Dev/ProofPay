/**
 * Release Service — THE ONLY gateway to money in ProofPay.
 * Implements phase-5-paypal-funding-and-release.md §5.6 & paypal-integration.md §5.
 *
 * Invariants:
 * 1. Two-phase release: TX-A (state->RELEASING) -> capture outside DB -> TX-B (state->RELEASED/RELEASE_FAILED).
 * 2. Sequential milestone releases (milestone n released only after milestone n-1 released).
 * 3. Total captured minor cannot exceed contract total minor.
 * 4. Only PASSED and RELEASE_FAILED milestones can be released.
 * 5. Deterministic idempotency keys: pp:{contractId}:{milestoneKey}:capture:{attempt}.
 * 6. One-shot chaos code consumed in TX-A.
 * 7. Ambiguous outcomes leave milestone in RELEASING for reconciliation.
 */
import { getDb, withTx, lockContract, type Tx } from '@/server/db/client'
import { contracts, milestones } from '@/server/db/schema'
import { eq, and, sql, asc } from 'drizzle-orm'
import { captureAuthorization } from '@/server/paypal/capture'
import { voidAuthorization } from '@/server/paypal/void'
import { refundCapture } from '@/server/paypal/refund'
import { appendLedgerEvent } from '@/server/ledger/append'
import { assertMilestoneTransition } from '@/server/contracts/transitions'
import { enqueueJob } from '@/server/jobs/queue'
import { PayPalError, isAmbiguous } from '@/server/paypal/errors'
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '@/server/util/errors'
import { forbidAgent, type SessionUser } from '@/server/auth/guards'
import { logger } from '@/server/util/logger'
import { now } from '@/server/util/time'

export type ReleaseOutcome =
  | { status: 'RELEASED'; captureId: string }
  | { status: 'PENDING' }
  | { status: 'RELEASE_FAILED'; error?: string }

export interface ReleaseMilestoneParams {
  contractId?: string
  milestoneKey?: string
  milestoneId?: string
}

export interface RefundMilestoneParams {
  contractId: string
  milestoneKey: string
  user: SessionUser
  amountMinor?: number
  reason?: string
}

/**
 * Release payment for a milestone.
 * Can be called with a milestoneId string or a params object.
 */
export async function releaseMilestone(
  input: string | ReleaseMilestoneParams
): Promise<ReleaseOutcome> {
  const db = getDb()
  let contractId: string | undefined
  let milestoneKey: string | undefined
  let milestoneId: string | undefined

  if (typeof input === 'string') {
    milestoneId = input
  } else {
    contractId = input.contractId
    milestoneKey = input.milestoneKey
    milestoneId = input.milestoneId
  }

  // Resolve milestone and contract
  if (milestoneId) {
    const [m] = await db
      .select({ contract_id: milestones.contract_id, milestone_key: milestones.milestone_key })
      .from(milestones)
      .where(eq(milestones.id, milestoneId))

    if (!m) throw new NotFoundError(`Milestone ${milestoneId} not found`)
    contractId = m.contract_id
    milestoneKey = m.milestone_key
  } else if (contractId && milestoneKey) {
    const [m] = await db
      .select({ id: milestones.id })
      .from(milestones)
      .where(and(eq(milestones.contract_id, contractId), eq(milestones.milestone_key, milestoneKey)))

    if (!m) throw new NotFoundError(`Milestone ${milestoneKey} not found on contract ${contractId}`)
    milestoneId = m.id
  } else {
    throw new AppError('INVALID_PARAMS', 'Must provide milestoneId or contractId + milestoneKey', 400)
  }

  const log = logger.child({ contract_id: contractId, milestone_id: milestoneId, milestone_key: milestoneKey })

  // ---------------------------------------------------------------------------
  // TX-A: Advisory lock, validate guards, set RELEASING, commit
  // ---------------------------------------------------------------------------
  const txAData = await withTx(async (tx: Tx) => {
    await lockContract(tx, contractId!)

    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId!))

    if (!contract) throw new NotFoundError(`Contract ${contractId} not found`)

    const allContractMilestones = await tx
      .select()
      .from(milestones)
      .where(eq(milestones.contract_id, contractId!))
      .orderBy(asc(milestones.idx))

    const targetMilestone = allContractMilestones.find((m: any) => m.id === milestoneId)
    if (!targetMilestone) throw new NotFoundError(`Milestone ${milestoneId} not found`)

    // Guard 1: Milestone status must be PASSED or RELEASE_FAILED
    if (targetMilestone.status !== 'PASSED' && targetMilestone.status !== 'RELEASE_FAILED') {
      throw new ConflictError(
        `Milestone ${targetMilestone.milestone_key} cannot be released from status '${targetMilestone.status}' (must be PASSED or RELEASE_FAILED)`
      )
    }

    // Guard 2: Contract status must be FUNDED or IN_PROGRESS
    if (contract.status !== 'FUNDED' && contract.status !== 'IN_PROGRESS') {
      throw new ConflictError(
        `Contract cannot release funds in status '${contract.status}' (must be FUNDED or IN_PROGRESS)`
      )
    }

    // Guard 3: Authorization hold must not be expired
    if (contract.auth_expires_at && now().getTime() >= contract.auth_expires_at.getTime()) {
      throw new ConflictError('Authorization hold has expired; cannot release milestone')
    }

    if (!contract.authorization_id) {
      throw new ConflictError('Contract has no active authorization ID')
    }

    // Guard 4: Sequential rule — all earlier milestones must be RELEASED
    const earlierUnreleased = allContractMilestones.filter(
      (m: any) => m.idx < targetMilestone.idx && m.status !== 'RELEASED'
    )
    if (earlierUnreleased.length > 0) {
      throw new ConflictError(
        `Cannot release milestone ${targetMilestone.milestone_key}: earlier milestone ${earlierUnreleased[0]?.milestone_key} is not RELEASED (current status: ${earlierUnreleased[0]?.status})`
      )
    }

    // Guard 5: Total captured minor cannot exceed total_minor
    const totalAlreadyCaptured = allContractMilestones
      .filter((m: any) => m.status === 'RELEASED')
      .reduce((sum: number, m: any) => sum + m.amount_minor, 0)

    if (totalAlreadyCaptured + targetMilestone.amount_minor > contract.total_minor) {
      throw new ConflictError(
        `Capture would exceed contract total: already captured ${totalAlreadyCaptured} + milestone ${targetMilestone.amount_minor} > total ${contract.total_minor}`
      )
    }

    // Calculate attempt number and final_capture flag
    const isRetry = targetMilestone.status === 'RELEASE_FAILED'
    const attempt = isRetry ? targetMilestone.release_attempts + 1 : (targetMilestone.release_attempts > 0 ? targetMilestone.release_attempts : 1)
    const maxIdx = Math.max(...allContractMilestones.map((m: any) => m.idx))
    const finalCapture = targetMilestone.idx === maxIdx

    // Consume chaos mock code (one-shot)
    const mockCode = contract.chaos_mock_code ?? undefined
    if (mockCode) {
      await tx
        .update(contracts)
        .set({ chaos_mock_code: null, updated_at: now() })
        .where(eq(contracts.id, contractId!))
    }

    // Update milestone → RELEASING
    assertMilestoneTransition(
      targetMilestone.status as 'PASSED' | 'RELEASE_FAILED',
      'RELEASING'
    )

    await tx
      .update(milestones)
      .set({ status: 'RELEASING', release_attempts: attempt })
      .where(eq(milestones.id, targetMilestone.id))

    const idempotencyKey = `pp:${contractId}:${targetMilestone.milestone_key}:capture:${attempt}`
    const invoiceId = `PP-${contractId!.slice(0, 8)}-${targetMilestone.milestone_key}`

    // Append CAPTURE_REQUESTED ledger event
    await appendLedgerEvent(tx, {
      contractId: contractId!,
      type: 'CAPTURE_REQUESTED',
      actorType: 'system',
      payload: {
        milestone_key: targetMilestone.milestone_key,
        amount_minor: targetMilestone.amount_minor,
        idempotency_key: idempotencyKey,
        final_capture: finalCapture,
      },
    })

    return {
      authorizationId: contract.authorization_id,
      amountMinor: targetMilestone.amount_minor,
      finalCapture,
      invoiceId,
      idempotencyKey,
      mockCode,
      milestoneKey: targetMilestone.milestone_key,
      milestoneId: targetMilestone.id,
      maxIdx,
    }
  })

  // ---------------------------------------------------------------------------
  // Step 2: PayPal API Call (OUTSIDE any DB transaction)
  // ---------------------------------------------------------------------------
  let captureResult: {
    status: 'COMPLETED' | 'PENDING' | 'DECLINED' | 'ERROR'
    captureId?: string
    error?: string
    isAmbiguous?: boolean
  }

  try {
    const res = await captureAuthorization({
      authorizationId: txAData.authorizationId,
      amountMinor: txAData.amountMinor,
      finalCapture: txAData.finalCapture,
      invoiceId: txAData.invoiceId,
      note: `ProofPay milestone ${txAData.milestoneKey} verified`,
      requestId: txAData.idempotencyKey,
      mockCode: txAData.mockCode,
    })

    if (res.status === 'COMPLETED') {
      captureResult = { status: 'COMPLETED', captureId: res.captureId }
    } else if (res.status === 'PENDING') {
      captureResult = { status: 'PENDING', captureId: res.captureId }
    } else {
      captureResult = { status: 'DECLINED', captureId: res.captureId }
    }
  } catch (err: any) {
    const ambiguous = isAmbiguous(err)
    if (ambiguous) {
      log.warn({ err: String(err) }, 'Ambiguous capture result; leaving RELEASING for reconciliation')
      captureResult = { status: 'ERROR', error: err.message, isAmbiguous: true }
    } else {
      log.info({ err: String(err) }, 'PayPal capture declined / business error')
      captureResult = { status: 'DECLINED', error: err.message }
    }
  }

  // ---------------------------------------------------------------------------
  // TX-B: Advisory lock, apply capture outcome
  // ---------------------------------------------------------------------------
  return await withTx(async (tx: Tx) => {
    await lockContract(tx, contractId!)

    const [currentMilestone] = await tx
      .select()
      .from(milestones)
      .where(eq(milestones.id, milestoneId!))

    if (!currentMilestone) throw new NotFoundError('Milestone vanished')

    // Idempotency: if already RELEASED by a concurrent webhook, return immediately
    if (currentMilestone.status === 'RELEASED') {
      return { status: 'RELEASED', captureId: currentMilestone.capture_id! }
    }

    if (captureResult.status === 'COMPLETED' && captureResult.captureId) {
      await tx
        .update(milestones)
        .set({
          status: 'RELEASED',
          capture_id: captureResult.captureId,
          captured_at: now(),
        })
        .where(eq(milestones.id, milestoneId!))

      await appendLedgerEvent(tx, {
        contractId: contractId!,
        type: 'CAPTURE_COMPLETED',
        actorType: 'paypal',
        payload: {
          milestone_key: txAData.milestoneKey,
          capture_id: captureResult.captureId,
          amount_minor: txAData.amountMinor,
        },
      })

      // If last milestone, complete the contract
      const remainingMilestones = await tx
        .select({ status: milestones.status })
        .from(milestones)
        .where(eq(milestones.contract_id, contractId!))

      const allCompleted = remainingMilestones.every(
        (m: any) => m.status === 'RELEASED' || m.status === 'VOIDED'
      )

      if (allCompleted) {
        await tx
          .update(contracts)
          .set({
            status: 'COMPLETED',
            completed_at: now(),
            updated_at: now(),
          })
          .where(eq(contracts.id, contractId!))

        await appendLedgerEvent(tx, {
          contractId: contractId!,
          type: 'CONTRACT_COMPLETED',
          actorType: 'system',
          payload: { reason: 'All milestones released' },
        })
      }

      return { status: 'RELEASED', captureId: captureResult.captureId }
    }

    if (captureResult.status === 'PENDING') {
      // Stay RELEASING, enqueue RECONCILE_PAYPAL in 60s
      await enqueueJob(
        tx,
        'RECONCILE_PAYPAL',
        { contract_id: contractId!, milestone_key: txAData.milestoneKey },
        { runAt: new Date(Date.now() + 60_000), dedupeKey: `reconcile:${contractId}:m:${txAData.milestoneKey}` }
      )
      return { status: 'PENDING' }
    }

    if (captureResult.status === 'DECLINED') {
      await tx
        .update(milestones)
        .set({ status: 'RELEASE_FAILED' })
        .where(eq(milestones.id, milestoneId!))

      await appendLedgerEvent(tx, {
        contractId: contractId!,
        type: 'CAPTURE_FAILED',
        actorType: 'paypal',
        payload: {
          milestone_key: txAData.milestoneKey,
          paypal_error: captureResult.error ?? 'Capture declined',
          mock: !!txAData.mockCode,
        },
      })

      return { status: 'RELEASE_FAILED', error: captureResult.error }
    }

    // Ambiguous outcome: leave in RELEASING and rethrow so the job handler retries
    throw new PayPalError(
      `Capture for milestone ${txAData.milestoneKey} timed out or failed ambiguously: ${captureResult.error}`,
      { isAmbiguous: true }
    )
  })
}

/**
 * Void remaining authorization hold on terminal failure, cancellation, or expiry.
 */
export async function voidRemaining(
  contractId: string,
  reason: 'final_failure' | 'buyer_cancel' | 'expired'
): Promise<void> {
  const db = getDb()

  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))

  if (!contract) throw new NotFoundError(`Contract ${contractId} not found`)

  const mList = await db
    .select({ amount_minor: milestones.amount_minor, status: milestones.status })
    .from(milestones)
    .where(eq(milestones.contract_id, contractId))

  const totalCaptured = mList
    .filter((m) => m.status === 'RELEASED')
    .reduce((sum, m) => sum + m.amount_minor, 0)

  const remainingMinor = Math.max(0, contract.total_minor - totalCaptured)

  // Call voidAuthorization outside transaction if hold exists
  if (contract.authorization_id && remainingMinor > 0) {
    try {
      await voidAuthorization(contract.authorization_id, `pp:${contractId}:void:1`)
    } catch (err: any) {
      if (reason === 'expired') {
        logger.info({ err: String(err) }, 'Void failed for expired contract; continuing')
      } else {
        logger.warn({ err: String(err), authId: contract.authorization_id }, 'Void authorization returned error')
      }
    }
  }

  // Update DB state within lock
  await withTx(async (tx: Tx) => {
    await lockContract(tx, contractId)

    // Milestone transitions:
    // FAILED_FINAL -> VOIDED
    // Pending/submitted/rejected -> VOIDED
    const targetMilestones = await tx
      .select()
      .from(milestones)
      .where(eq(milestones.contract_id, contractId))

    for (const m of targetMilestones) {
      if (m.status !== 'RELEASED' && m.status !== 'VOIDED') {
        await tx
          .update(milestones)
          .set({ status: 'VOIDED' })
          .where(eq(milestones.id, m.id))
      }
    }

    // Determine new contract status
    let newContractStatus: 'FAILED' | 'CANCELLED' | 'EXPIRED' = 'FAILED'
    if (reason === 'buyer_cancel') newContractStatus = 'CANCELLED'
    if (reason === 'expired') newContractStatus = 'EXPIRED'

    await tx
      .update(contracts)
      .set({
        status: newContractStatus,
        updated_at: now(),
      })
      .where(eq(contracts.id, contractId))

    await appendLedgerEvent(tx, {
      contractId,
      type: 'AUTHORIZATION_VOIDED',
      actorType: 'system',
      payload: {
        authorization_id: contract.authorization_id ?? '',
        remaining_minor: remainingMinor,
        reason,
      },
    })

    const terminalEventType =
      newContractStatus === 'FAILED'
        ? 'CONTRACT_FAILED'
        : newContractStatus === 'CANCELLED'
        ? 'CONTRACT_CANCELLED'
        : 'CONTRACT_EXPIRED'

    await appendLedgerEvent(tx, {
      contractId,
      type: terminalEventType,
      actorType: 'system',
      payload: { reason },
    })
  })
}

/**
 * Refund a released milestone payment (seller only, forbidAgent).
 */
export async function refundMilestone(params: RefundMilestoneParams): Promise<{
  refundId: string
  amountMinor: number
}> {
  const { contractId, milestoneKey, user, amountMinor, reason } = params
  forbidAgent(user)

  const db = getDb()
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))

  if (!contract) throw new NotFoundError(`Contract ${contractId} not found`)

  // Guard: Seller only
  if (user.sub !== contract.seller_id) {
    throw new ForbiddenError('Only the seller can issue a refund')
  }

  const [milestone] = await db
    .select()
    .from(milestones)
    .where(and(eq(milestones.contract_id, contractId), eq(milestones.milestone_key, milestoneKey)))

  if (!milestone) throw new NotFoundError(`Milestone ${milestoneKey} not found`)

  if (milestone.status !== 'RELEASED') {
    throw new ConflictError(
      `Cannot refund milestone ${milestoneKey} with status '${milestone.status}' (must be RELEASED)`
    )
  }

  if (!milestone.capture_id) {
    throw new ConflictError(`Milestone ${milestoneKey} has no capture ID to refund`)
  }

  const refundAmount = amountMinor ?? milestone.amount_minor
  if (refundAmount <= 0 || refundAmount > milestone.amount_minor) {
    throw new ConflictError(
      `Refund amount (${refundAmount}) must be positive and cannot exceed captured amount (${milestone.amount_minor})`
    )
  }

  const requestId = `pp:${contractId}:${milestoneKey}:refund:${Date.now()}`
  const result = await refundCapture({
    captureId: milestone.capture_id,
    amountMinor: refundAmount,
    note: reason,
    requestId,
  })

  await withTx(async (tx: Tx) => {
    await lockContract(tx, contractId)

    await appendLedgerEvent(tx, {
      contractId,
      type: 'REFUND_ISSUED',
      actorType: 'seller',
      actorId: user.sub,
      payload: {
        milestone_key: milestoneKey,
        capture_id: milestone.capture_id!,
        refund_id: result.id,
        amount_minor: refundAmount,
      },
    })
  })

  return {
    refundId: result.id,
    amountMinor: refundAmount,
  }
}
