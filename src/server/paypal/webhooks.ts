/**
 * PayPal Webhook verification and event handling.
 * Implements phase-5-paypal-funding-and-release.md §5.7 & paypal-integration.md §6.
 */
import { env } from '@/server/config/env'
import { logger } from '@/server/util/logger'
import { paypalFetch } from './client'
import { getDb, lockContract, type Tx } from '@/server/db/client'
import { contracts, milestones, paypalEvents } from '@/server/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { appendLedgerEvent } from '@/server/ledger/append'
import { enqueueJob } from '@/server/jobs/queue'
import { now } from '@/server/util/time'

export interface PayPalWebhookEvent {
  id: string
  event_type: string
  resource_type?: string
  resource: Record<string, any>
  create_time?: string
  links?: Array<{ href: string; rel: string; method?: string }>
}

/**
 * Verify PayPal webhook signature via POST /v1/notifications/verify-webhook-signature.
 */
export async function verifyWebhookSignature(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string
): Promise<boolean> {
  const getHeader = (name: string): string | undefined => {
    const val = headers[name.toLowerCase()] ?? headers[name.toUpperCase()] ?? headers[name]
    if (Array.isArray(val)) return val[0]
    return val
  }

  const authAlgo = getHeader('paypal-auth-algo')
  const certUrl = getHeader('paypal-cert-url')
  const transmissionId = getHeader('paypal-transmission-id')
  const transmissionSig = getHeader('paypal-transmission-sig')
  const transmissionTime = getHeader('paypal-transmission-time')

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    logger.warn('PayPal webhook missing signature headers')
    return false
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    logger.warn('PayPal webhook raw body is not valid JSON')
    return false
  }

  try {
    const res = await paypalFetch<{ verification_status: string }>(
      'POST',
      '/v1/notifications/verify-webhook-signature',
      {
        body: {
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: env.PAYPAL_WEBHOOK_ID,
          webhook_event: parsedBody,
        },
      }
    )

    return res.verification_status === 'SUCCESS'
  } catch (err) {
    logger.error({ err: String(err) }, 'Failed to verify PayPal webhook signature via API')
    return false
  }
}

/**
 * Extract matched contract and milestone info from a webhook event resource.
 */
export async function resolveContractAndMilestone(event: PayPalWebhookEvent): Promise<{
  contractId?: string
  milestoneKey?: string
  milestoneId?: string
}> {
  const resource = event.resource ?? {}
  const db = getDb()

  // 1. Direct custom_id
  if (resource['custom_id']) {
    return { contractId: resource['custom_id'] }
  }

  // 2. Invoice ID formats:
  // PP-<contractId8>-<milestoneKey> or PP-<contractId8>
  const invoiceId = (resource['invoice_id'] as string | undefined) ?? ''
  if (invoiceId.startsWith('PP-')) {
    const parts = invoiceId.split('-')
    const shortContractId = parts[1]
    const milestoneKey = parts[2]

    if (shortContractId) {
      // Find contract starting with shortId
      const matches = await db
        .select({ id: contracts.id })
        .from(contracts)
        .where(sql`left(${contracts.id}::text, 8) = ${shortContractId}`)
        .limit(1)

      if (matches[0]) {
        const contractId = matches[0].id
        if (milestoneKey) {
          const mMatches = await db
            .select({ id: milestones.id, milestone_key: milestones.milestone_key })
            .from(milestones)
            .where(
              and(
                eq(milestones.contract_id, contractId),
                eq(milestones.milestone_key, milestoneKey)
              )
            )
            .limit(1)
          return {
            contractId,
            milestoneKey,
            milestoneId: mMatches[0]?.id,
          }
        }
        return { contractId }
      }
    }
  }

  // 3. Match by capture_id
  if (resource['id'] && event.event_type.startsWith('PAYMENT.CAPTURE.')) {
    const m = await db
      .select({ id: milestones.id, contract_id: milestones.contract_id, milestone_key: milestones.milestone_key })
      .from(milestones)
      .where(eq(milestones.capture_id, resource['id']))
      .limit(1)

    if (m[0]) {
      return {
        contractId: m[0].contract_id,
        milestoneKey: m[0].milestone_key,
        milestoneId: m[0].id,
      }
    }
  }

  // 4. Match by authorization_id
  const authId = resource['id'] ?? resource['authorization_id']
  if (authId) {
    const c = await db
      .select({ id: contracts.id })
      .from(contracts)
      .where(eq(contracts.authorization_id, authId))
      .limit(1)

    if (c[0]) {
      return { contractId: c[0].id }
    }
  }

  // 5. Match by paypal_order_id
  const orderId = resource['id']
  if (orderId && event.event_type === 'CHECKOUT.ORDER.APPROVED') {
    const c = await db
      .select({ id: contracts.id })
      .from(contracts)
      .where(eq(contracts.paypal_order_id, orderId))
      .limit(1)

    if (c[0]) {
      return { contractId: c[0].id }
    }
  }

  return {}
}

/**
 * Handle a verified PayPal webhook event.
 * Follows the state machine in paypal-integration.md §6.
 * CRITICAL RULE: Handlers never move milestone or contract status backwards.
 */
export async function handlePayPalEvent(event: PayPalWebhookEvent): Promise<void> {
  const db = getDb()
  const resolved = await resolveContractAndMilestone(event)

  if (!resolved.contractId) {
    logger.info({ event_type: event.event_type, event_id: event.id }, 'PayPal event for unknown contract; stored and ignored')
    return
  }

  const contractId = resolved.contractId
  const resource = event.resource ?? {}

  await db.transaction(async (tx: Tx) => {
    await lockContract(tx, contractId)

    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))

    if (!contract) return

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const captureId = resource['id'] as string
        const amountMinor = resource['amount']?.value
          ? Math.round(parseFloat(resource['amount'].value) * 100)
          : undefined

        let targetMilestoneId = resolved.milestoneId
        let targetMilestoneKey = resolved.milestoneKey

        // If not resolved by invoice_id, search by capture_id or current RELEASING milestone
        if (!targetMilestoneId) {
          const mList = await tx
            .select()
            .from(milestones)
            .where(eq(milestones.contract_id, contractId))

          const matching = mList.find((m) => m.capture_id === captureId) ?? mList.find((m) => m.status === 'RELEASING')
          if (matching) {
            targetMilestoneId = matching.id
            targetMilestoneKey = matching.milestone_key
          }
        }

        if (targetMilestoneId) {
          const [m] = await tx
            .select()
            .from(milestones)
            .where(eq(milestones.id, targetMilestoneId))

          if (m) {
            // Never move backwards: only update if currently RELEASING
            if (m.status === 'RELEASING') {
              await tx
                .update(milestones)
                .set({
                  status: 'RELEASED',
                  capture_id: captureId,
                  captured_at: now(),
                })
                .where(eq(milestones.id, m.id))

              await appendLedgerEvent(tx, {
                contractId,
                type: 'CAPTURE_COMPLETED',
                actorType: 'paypal',
                payload: {
                  milestone_key: m.milestone_key,
                  capture_id: captureId,
                  amount_minor: amountMinor ?? m.amount_minor,
                },
              })

              // Check if all milestones are now RELEASED
              const allM = await tx
                .select({ status: milestones.status })
                .from(milestones)
                .where(eq(milestones.contract_id, contractId))

              const allReleased = allM.every((item) => (item.status === 'RELEASED' || item.status === 'VOIDED'))
              if (allReleased && contract.status !== 'COMPLETED') {
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
              }
            }
          }
        }

        await appendLedgerEvent(tx, {
          contractId,
          type: 'WEBHOOK_RECEIVED',
          actorType: 'paypal',
          payload: { event_id: event.id, event_type: event.event_type },
        })
        break
      }

      case 'PAYMENT.CAPTURE.PENDING': {
        // Keep RELEASING; enqueue reconcile job
        await enqueueJob(
          tx,
          'RECONCILE_PAYPAL',
          { contract_id: contractId },
          { runAt: new Date(Date.now() + 60_000), dedupeKey: `reconcile:${contractId}` }
        )
        await appendLedgerEvent(tx, {
          contractId,
          type: 'WEBHOOK_RECEIVED',
          actorType: 'paypal',
          payload: { event_id: event.id, event_type: event.event_type },
        })
        break
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        // RELEASING → RELEASE_FAILED
        if (resolved.milestoneId) {
          const [m] = await tx
            .select()
            .from(milestones)
            .where(eq(milestones.id, resolved.milestoneId))

          // Never move RELEASED backwards
          if (m && m.status === 'RELEASING') {
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
                paypal_error: 'Capture denied by PayPal webhook',
                mock: false,
              },
            })
          }
        }
        await appendLedgerEvent(tx, {
          contractId,
          type: 'WEBHOOK_RECEIVED',
          actorType: 'paypal',
          payload: { event_id: event.id, event_type: event.event_type },
        })
        break
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        await appendLedgerEvent(tx, {
          contractId,
          type: 'WEBHOOK_RECEIVED',
          actorType: 'paypal',
          payload: { event_id: event.id, event_type: event.event_type },
        })
        break
      }

      case 'PAYMENT.AUTHORIZATION.CREATED': {
        // Confirmation only
        await appendLedgerEvent(tx, {
          contractId,
          type: 'WEBHOOK_RECEIVED',
          actorType: 'paypal',
          payload: { event_id: event.id, event_type: event.event_type },
        })
        break
      }

      case 'PAYMENT.AUTHORIZATION.VOIDED': {
        // Check if self-initiated void
        const isSelfInitiated =
          contract.status === 'CANCELLED' ||
          contract.status === 'FAILED' ||
          contract.status === 'EXPIRED'

        if (!isSelfInitiated) {
          // Unexpected void → set funding_at_risk = true
          await tx
            .update(contracts)
            .set({ funding_at_risk: true })
            .where(eq(contracts.id, contractId))
        }

        await appendLedgerEvent(tx, {
          contractId,
          type: 'WEBHOOK_RECEIVED',
          actorType: 'paypal',
          payload: { event_id: event.id, event_type: event.event_type },
        })
        break
      }

      case 'CHECKOUT.ORDER.APPROVED': {
        // Confirmation only; if still FUNDING, enqueue reconcile to authorize
        if (contract.status === 'FUNDING') {
          await enqueueJob(
            tx,
            'RECONCILE_PAYPAL',
            { contract_id: contractId },
            { dedupeKey: `reconcile:order:${contractId}` }
          )
        }
        await appendLedgerEvent(tx, {
          contractId,
          type: 'WEBHOOK_RECEIVED',
          actorType: 'paypal',
          payload: { event_id: event.id, event_type: event.event_type },
        })
        break
      }

      default: {
        await appendLedgerEvent(tx, {
          contractId,
          type: 'WEBHOOK_RECEIVED',
          actorType: 'paypal',
          payload: { event_id: event.id, event_type: event.event_type },
        })
        break
      }
    }
  })
}
