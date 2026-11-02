/**
 * PayPal Reconciliation and Stuck Contract Detection.
 * Implements phase-5-paypal-funding-and-release.md §5.8 & paypal-integration.md §8.
 */
import { getDb, withTx, lockContract, type Tx } from '@/server/db/client'
import { contracts, milestones } from '@/server/db/schema'
import { eq, and, sql, or, lt } from 'drizzle-orm'
import { getOrder, authorizeOrder } from '@/server/paypal/orders'
import { getAuthorization } from '@/server/paypal/authorizations'
import { appendLedgerEvent } from '@/server/ledger/append'
import { transitionContractStatus } from '@/server/db/repos/contracts.repo'
import { voidRemaining } from '@/server/release/service'
import { now } from '@/server/util/time'
import { logger } from '@/server/util/logger'

export interface ReconcileOutcome {
  contractId: string
  reconciled: boolean
  actions: string[]
}

/**
 * Reconcile a contract against PayPal's actual state.
 * Handles stuck RELEASING milestones, stuck FUNDING orders, and funding_at_risk checks.
 */
export async function reconcileContract(contractId: string): Promise<ReconcileOutcome> {
  const db = getDb()
  const log = logger.child({ op: 'reconcileContract', contractId })
  const actions: string[] = []

  const [initialContract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))

  if (!initialContract) {
    return { contractId, reconciled: false, actions: ['contract_not_found'] }
  }

  // ---------------------------------------------------------------------------
  // Case 1: Releasing Milestones (reconcile via GET /v2/checkout/orders/{orderId})
  // ---------------------------------------------------------------------------
  const releasingMilestones = await db
    .select()
    .from(milestones)
    .where(and(eq(milestones.contract_id, contractId), eq(milestones.status, 'RELEASING')))

  if (releasingMilestones.length > 0 && initialContract.paypal_order_id) {
    try {
      const order = await getOrder(initialContract.paypal_order_id)
      const shortId = contractId.slice(0, 8)

      for (const m of releasingMilestones) {
        const expectedInvoiceId = `PP-${shortId}-${m.milestone_key}`
        const matchedCapture = order.captures.find(
          (c) => c.invoice_id === expectedInvoiceId || (m.capture_id && c.id === m.capture_id)
        )

        await withTx(async (tx: Tx) => {
          await lockContract(tx, contractId)

          const [curM] = await tx
            .select()
            .from(milestones)
            .where(eq(milestones.id, m.id))

          if (!curM || curM.status !== 'RELEASING') return

          if (matchedCapture?.status === 'COMPLETED') {
            await tx
              .update(milestones)
              .set({
                status: 'RELEASED',
                capture_id: matchedCapture.id,
                captured_at: now(),
              })
              .where(eq(milestones.id, m.id))

            await appendLedgerEvent(tx, {
              contractId,
              type: 'CAPTURE_COMPLETED',
              actorType: 'paypal',
              payload: {
                milestone_key: m.milestone_key,
                capture_id: matchedCapture.id,
                amount_minor: m.amount_minor,
              },
            })

            actions.push(`milestone_${m.milestone_key}_marked_RELEASED`)

            // Check if all milestones completed
            const allM = await tx
              .select({ status: milestones.status })
              .from(milestones)
              .where(eq(milestones.contract_id, contractId))

            if (allM.every((item: any) => item.status === 'RELEASED' || item.status === 'VOIDED')) {
              await tx
                .update(contracts)
                .set({ status: 'COMPLETED', completed_at: now() })
                .where(eq(contracts.id, contractId))

              await appendLedgerEvent(tx, {
                contractId,
                type: 'CONTRACT_COMPLETED',
                actorType: 'system',
                payload: { reason: 'All milestones released' },
              })

              actions.push('contract_marked_COMPLETED')
            }
          } else if (matchedCapture?.status === 'DECLINED') {
            await tx
              .update(milestones)
              .set({ status: 'RELEASE_FAILED' })
              .where(eq(milestones.id, m.id))

            await appendLedgerEvent(tx, {
              contractId,
              type: 'CAPTURE_FAILED',
              actorType: 'paypal',
              payload: {
                milestone_key: m.milestone_key,
                paypal_error: 'Capture declined (reconciled from order)',
                mock: false,
              },
            })

            actions.push(`milestone_${m.milestone_key}_marked_RELEASE_FAILED`)
          } else if (matchedCapture?.status === 'PENDING') {
            // Keep RELEASING, check later
            actions.push(`milestone_${m.milestone_key}_kept_RELEASING_PENDING`)
          } else {
            // No capture record found; if attempts exhausted and > 2 minutes, mark RELEASE_FAILED
            const minutesSinceUpdate = (Date.now() - (curM.captured_at?.getTime() ?? Date.now())) / 60_000
            if (curM.release_attempts >= 3 || minutesSinceUpdate >= 2) {
              await tx
                .update(milestones)
                .set({ status: 'RELEASE_FAILED' })
                .where(eq(milestones.id, m.id))

              await appendLedgerEvent(tx, {
                contractId,
                type: 'CAPTURE_FAILED',
                actorType: 'paypal',
                payload: {
                  milestone_key: m.milestone_key,
                  paypal_error: 'Capture not found on PayPal order after retries',
                  mock: false,
                },
              })

              actions.push(`milestone_${m.milestone_key}_marked_RELEASE_FAILED_no_capture`)
            }
          }
        })
      }
    } catch (err) {
      log.warn({ err: String(err) }, 'Reconciliation failed to fetch order captures')
    }
  }

  // ---------------------------------------------------------------------------
  // Case 2: Stuck FUNDING state (reconcile via GET /v2/checkout/orders/{orderId})
  // ---------------------------------------------------------------------------
  if (initialContract.status === 'FUNDING' && initialContract.paypal_order_id) {
    try {
      const order = await getOrder(initialContract.paypal_order_id)

      if (order.status === 'APPROVED') {
        // Buyer approved in browser, but return callback was abandoned: authorize now
        const requestId = `pp:${contractId}:reconcile-auth:${Date.now()}`
        const auth = await authorizeOrder(order.id, requestId)

        await withTx(async (tx: Tx) => {
          await lockContract(tx, contractId)

          const fundedAt = now()
          const authCreatedAt = auth.createTime ? new Date(auth.createTime) : fundedAt
          const honorUntil = new Date(authCreatedAt.getTime() + 3 * 24 * 3600 * 1000)
          const authExpiresAt = auth.expirationTime
            ? new Date(auth.expirationTime)
            : new Date(authCreatedAt.getTime() + 29 * 24 * 3600 * 1000)

          const mList = await tx
            .select()
            .from(milestones)
            .where(eq(milestones.contract_id, contractId))

          for (const m of mList) {
            const dueAt = new Date(fundedAt.getTime() + m.due_in_days * 24 * 3600 * 1000)
            await tx.update(milestones).set({ due_at: dueAt }).where(eq(milestones.id, m.id))
          }

          await transitionContractStatus(tx, contractId, 'FUNDING', 'FUNDED')

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

        actions.push('funding_order_authorized_and_marked_FUNDED')
      } else if (order.status === 'CREATED' || order.status === 'PAYER_ACTION_REQUIRED') {
        // Order was abandoned before approval: return to ACCEPTED
        await withTx(async (tx: Tx) => {
          await lockContract(tx, contractId)

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
            actorType: 'system',
            payload: {
              paypal_order_id: order.id,
            },
          })
        })

        actions.push('abandoned_order_reverted_to_ACCEPTED')
      }
    } catch (err) {
      log.warn({ err: String(err) }, 'Reconciliation failed to inspect stuck order')
    }
  }

  // ---------------------------------------------------------------------------
  // Case 3: Contract has funding_at_risk=true (reconcile via GET authorization)
  // ---------------------------------------------------------------------------
  if (initialContract.funding_at_risk && initialContract.authorization_id) {
    try {
      const auth = await getAuthorization(initialContract.authorization_id)

      if (auth.status === 'VOIDED' || auth.status === 'EXPIRED') {
        await voidRemaining(contractId, auth.status === 'EXPIRED' ? 'expired' : 'final_failure')
        actions.push(`funding_at_risk_voided_as_${auth.status}`)
      } else if (auth.status === 'CREATED' || auth.status === 'PARTIALLY_CAPTURED') {
        // Hold is healthy again: clear the flag
        await withTx(async (tx: Tx) => {
          await lockContract(tx, contractId)
          await tx
            .update(contracts)
            .set({ funding_at_risk: false, updated_at: now() })
            .where(eq(contracts.id, contractId))
        })
        actions.push('funding_at_risk_cleared_healthy')
      }
    } catch (err) {
      log.warn({ err: String(err) }, 'Reconciliation failed to inspect authorization')
    }
  }

  return {
    contractId,
    reconciled: actions.length > 0,
    actions,
  }
}

/**
 * Find contracts stuck in RELEASING or FUNDING for longer than 2 minutes.
 */
export async function findStuckContracts(): Promise<string[]> {
  const db = getDb()
  const cutoff = new Date(Date.now() - 2 * 60_000)

  // 1. Contracts in FUNDING updated before cutoff
  const stuckFunding = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(and(eq(contracts.status, 'FUNDING'), lt(contracts.updated_at, cutoff)))

  // 2. Contracts with milestones in RELEASING
  const stuckReleasing = await db
    .selectDistinct({ id: milestones.contract_id })
    .from(milestones)
    .where(eq(milestones.status, 'RELEASING'))

  // 3. Contracts with funding_at_risk = true
  const atRisk = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(eq(contracts.funding_at_risk, true))

  const idSet = new Set<string>()
  for (const c of stuckFunding) idSet.add(c.id)
  for (const m of stuckReleasing) idSet.add(m.id)
  for (const r of atRisk) idSet.add(r.id)

  return Array.from(idSet)
}
