/**
 * Funding Service — manages PayPal order creation, buyer approval, and authorization hold.
 * Implements phase-5-paypal-funding-and-release.md §5.5 & paypal-integration.md §3.1, §3.2.
 */
import { getDb, withTx, lockContract, type Tx } from '@/server/db/client'
import { contracts, milestones } from '@/server/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { createOrder, authorizeOrder, extractApprovalUrl, getOrder } from '@/server/paypal/orders'
import { getAuthorization } from '@/server/paypal/authorizations'
import { appendLedgerEvent } from '@/server/ledger/append'
import { transitionContractStatus } from '@/server/db/repos/contracts.repo'
import { env } from '@/server/config/env'
import { logger } from '@/server/util/logger'
import { now } from '@/server/util/time'
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '@/server/util/errors'
import type { SessionUser } from '@/server/auth/guards'

export interface StartFundingParams {
  contractId: string
  user: SessionUser
  idempotencyKey?: string
}

export interface StartFundingResult {
  paypal_order_id: string
  approval_url: string
}

export interface HandlePayPalReturnParams {
  token: string
  contractId: string
  user: SessionUser
}

export interface HandlePayPalCancelParams {
  contractId: string
  user: SessionUser
}

// ---------------------------------------------------------------------------
// 30-second in-memory cache for live authorization status (C-7)
// ---------------------------------------------------------------------------
interface CachedFundingStatus {
  status: string
  checked_at: string
  authorized_minor: number
  expiresAt: number
}
const _fundingStatusCache = new Map<string, CachedFundingStatus>()

/**
 * Start funding flow by creating a PayPal order with intent=AUTHORIZE.
 * E-12: If contract is already in FUNDING and has a valid paypal_order_id,
 * returns the existing approval URL to avoid creating duplicate orders.
 */
export async function startFunding(params: StartFundingParams): Promise<StartFundingResult> {
  const { contractId, user } = params
  const db = getDb()

  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))

  if (!contract) {
    throw new NotFoundError(`Contract ${contractId} not found`)
  }

  // Security: only buyer may fund
  if (user.sub !== contract.buyer_id) {
    throw new ForbiddenError('Only the buyer can fund this contract')
  }

  // E-12: If already in FUNDING with an existing order, reuse order
  if (contract.status === 'FUNDING' && contract.paypal_order_id) {
    try {
      const existingOrder = await getOrder(contract.paypal_order_id)
      const approvalUrl = extractApprovalUrl(existingOrder.links)
      return {
        paypal_order_id: contract.paypal_order_id,
        approval_url: approvalUrl,
      }
    } catch (err) {
      logger.warn({ err: String(err), orderId: contract.paypal_order_id }, 'Failed to retrieve existing order, creating new one')
    }
  }

  if (contract.status !== 'ACCEPTED') {
    throw new ConflictError(
      `Cannot fund contract in status '${contract.status}'. Contract must be ACCEPTED.`
    )
  }

  // Check milestone due dates rule: due_in_days <= 28
  const mList = await db
    .select({ due_in_days: milestones.due_in_days })
    .from(milestones)
    .where(eq(milestones.contract_id, contractId))

  const maxDays = Math.max(...mList.map((m) => m.due_in_days), 0)
  if (maxDays > 28) {
    throw new ConflictError(`Milestone due_in_days (${maxDays}) exceeds maximum allowed (28 days)`)
  }

  const returnUrl = `${env.APP_BASE_URL}/api/v1/paypal/return?contract_id=${contractId}`
  const cancelUrl = `${env.APP_BASE_URL}/api/v1/paypal/cancel?contract_id=${contractId}`
  const requestId = `pp:${contractId}:fund:1`

  // Create order outside transaction
  const order = await createOrder({
    contractId,
    title: contract.title,
    totalMinor: contract.total_minor,
    returnUrl,
    cancelUrl,
    requestId,
  })

  const approvalUrl = extractApprovalUrl(order.links)

  // Commit order ID inside transaction
  await withTx(async (tx: Tx) => {
    await lockContract(tx, contractId)

    const [current] = await tx
      .select({ status: contracts.status })
      .from(contracts)
      .where(eq(contracts.id, contractId))

    if (current?.status === 'ACCEPTED') {
      await transitionContractStatus(tx, contractId, 'ACCEPTED', 'FUNDING')
    }

    await tx
      .update(contracts)
      .set({
        paypal_order_id: order.id,
        updated_at: now(),
      })
      .where(eq(contracts.id, contractId))

    await appendLedgerEvent(tx, {
      contractId,
      type: 'FUNDING_STARTED',
      actorType: 'buyer',
      actorId: user.sub,
      payload: {
        paypal_order_id: order.id,
        total_minor: contract.total_minor,
      },
    })
  })

  return {
    paypal_order_id: order.id,
    approval_url: approvalUrl,
  }
}

/**
 * Handle PayPal return callback after buyer approval.
 * Executes order authorization and transitions contract to FUNDED.
 */
export async function handlePayPalReturn(params: HandlePayPalReturnParams): Promise<{
  success: boolean
  contractId: string
  status: string
}> {
  const { token, contractId } = params
  const db = getDb()

  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))

  if (!contract) {
    throw new NotFoundError(`Contract ${contractId} not found`)
  }

  // Verify token matches recorded paypal_order_id
  if (contract.paypal_order_id && contract.paypal_order_id !== token) {
    throw new AppError(
      'ORDER_TOKEN_MISMATCH',
      'The PayPal order token does not match this contract',
      400
    )
  }

  // Idempotency: if already FUNDED, return immediately
  if (contract.status === 'FUNDED' || contract.status === 'IN_PROGRESS' || contract.status === 'COMPLETED') {
    return {
      success: true,
      contractId,
      status: contract.status,
    }
  }

  // Execute order authorization outside transaction
  const requestId = `pp:${contractId}:authorize:1`
  const auth = await authorizeOrder(token, requestId)

  // Commit authorization details inside transaction
  await withTx(async (tx: Tx) => {
    await lockContract(tx, contractId)

    const [current] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))

    if (!current || current.status === 'FUNDED') return

    const fundedAt = now()
    const authCreatedAt = auth.createTime ? new Date(auth.createTime) : fundedAt
    const honorUntil = new Date(authCreatedAt.getTime() + 3 * 24 * 3600 * 1000)
    const authExpiresAt = auth.expirationTime
      ? new Date(auth.expirationTime)
      : new Date(authCreatedAt.getTime() + 29 * 24 * 3600 * 1000)

    // Update milestone due dates based on fundedAt + due_in_days
    const contractMilestones = await tx
      .select()
      .from(milestones)
      .where(eq(milestones.contract_id, contractId))

    for (const m of contractMilestones) {
      const dueAt = new Date(fundedAt.getTime() + m.due_in_days * 24 * 3600 * 1000)
      await tx
        .update(milestones)
        .set({ due_at: dueAt })
        .where(eq(milestones.id, m.id))
    }

    // Transition contract to FUNDED
    await transitionContractStatus(
      tx,
      contractId,
      current.status as 'FUNDING' | 'ACCEPTED',
      'FUNDED'
    )

    await tx
      .update(contracts)
      .set({
        authorization_id: auth.authorizationId,
        auth_created_at: authCreatedAt,
        honor_until: honorUntil,
        auth_expires_at: authExpiresAt,
        funded_at: fundedAt,
        updated_at: fundedAt,
      })
      .where(eq(contracts.id, contractId))

    await appendLedgerEvent(tx, {
      contractId,
      type: 'AUTHORIZATION_CREATED',
      actorType: 'paypal',
      payload: {
        authorization_id: auth.authorizationId,
        honor_until: honorUntil.toISOString(),
        auth_expires_at: authExpiresAt.toISOString(),
      },
    })
  })

  return {
    success: true,
    contractId,
    status: 'FUNDED',
  }
}

/**
 * Handle PayPal cancel callback when buyer cancels during checkout.
 * Transitions contract from FUNDING back to ACCEPTED and clears order ID.
 */
export async function handlePayPalCancel(params: HandlePayPalCancelParams): Promise<{
  success: boolean
  contractId: string
  status: string
}> {
  const { contractId } = params

  await withTx(async (tx: Tx) => {
    await lockContract(tx, contractId)

    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))

    if (!contract) throw new NotFoundError(`Contract ${contractId} not found`)

    if (contract.status === 'FUNDING') {
      const orderId = contract.paypal_order_id ?? ''
      await transitionContractStatus(tx, contractId, 'FUNDING', 'ACCEPTED')

      await tx
        .update(contracts)
        .set({
          paypal_order_id: null,
          updated_at: now(),
        })
        .where(eq(contracts.id, contractId))

      await appendLedgerEvent(tx, {
        contractId,
        type: 'FUNDING_CANCELLED',
        actorType: 'buyer',
        payload: {
          paypal_order_id: orderId,
        },
      })
    }
  })

  return {
    success: true,
    contractId,
    status: 'ACCEPTED',
  }
}

/**
 * Get live authorization status with 30-second in-memory cache (C-7).
 */
export async function getFundingStatus(contractId: string): Promise<{
  status: string
  checked_at: string
  authorized_minor: number
}> {
  const cached = _fundingStatusCache.get(contractId)
  if (cached && cached.expiresAt > Date.now()) {
    return {
      status: cached.status,
      checked_at: cached.checked_at,
      authorized_minor: cached.authorized_minor,
    }
  }

  const db = getDb()
  const [contract] = await db
    .select({
      authorization_id: contracts.authorization_id,
      total_minor: contracts.total_minor,
      status: contracts.status,
    })
    .from(contracts)
    .where(eq(contracts.id, contractId))

  if (!contract?.authorization_id) {
    return {
      status: contract?.status === 'FUNDED' ? 'AUTHORIZED' : 'NONE',
      checked_at: new Date().toISOString(),
      authorized_minor: contract?.status === 'FUNDED' ? contract.total_minor : 0,
    }
  }

  try {
    const auth = await getAuthorization(contract.authorization_id)
    const authMinor = auth.amount?.value ? Math.round(parseFloat(auth.amount.value) * 100) : contract.total_minor
    const result: CachedFundingStatus = {
      status: auth.status,
      checked_at: new Date().toISOString(),
      authorized_minor: authMinor,
      expiresAt: Date.now() + 30_000,
    }
    _fundingStatusCache.set(contractId, result)
    return {
      status: result.status,
      checked_at: result.checked_at,
      authorized_minor: result.authorized_minor,
    }
  } catch (err) {
    return {
      status: 'UNKNOWN',
      checked_at: new Date().toISOString(),
      authorized_minor: contract.total_minor,
    }
  }
}
