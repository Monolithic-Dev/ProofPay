/**
 * PayPal Webhook endpoint — POST /api/v1/webhooks/paypal
 * Implements phase-5-paypal-funding-and-release.md §5.7 & paypal-integration.md §6.
 *
 * Rules:
 * - Reads RAW body before any JSON parsing.
 * - Verifies signature with PayPal API.
 * - Inserts into paypal_events with ON CONFLICT (event_id) DO NOTHING.
 * - Invalid signature returns 400.
 * - Valid signature returns 200, handles event in-line (fast), enqueues RECONCILE_PAYPAL on errors.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/server/db/client'
import { paypalEvents } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { verifyWebhookSignature, handlePayPalEvent, resolveContractAndMilestone, type PayPalWebhookEvent } from '@/server/paypal/webhooks'
import { enqueueJob } from '@/server/jobs/queue'
import { logger } from '@/server/util/logger'

export async function POST(req: NextRequest): Promise<Response> {
  const log = logger.child({ endpoint: 'webhook:paypal' })

  // 1. Read raw body
  const rawBody = await req.text()

  // 2. Extract headers
  const headers: Record<string, string> = {}
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value
  })

  // 3. Parse JSON event
  let event: PayPalWebhookEvent
  try {
    event = JSON.parse(rawBody) as PayPalWebhookEvent
  } catch (err) {
    log.warn('PayPal webhook raw body is not valid JSON')
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // 4. Verify signature
  const isValid = await verifyWebhookSignature(headers, rawBody)
  const db = getDb()

  const resolved = await resolveContractAndMilestone(event).catch(
    (): { contractId?: string; milestoneKey?: string; milestoneId?: string } => ({})
  )
  const contractId = resolved.contractId

  // 5. Deduplicate and record event in paypal_events
  let inserted = false
  try {
    const res = await db
      .insert(paypalEvents)
      .values({
        event_id: event.id,
        event_type: event.event_type,
        resource_id: (event.resource?.id as string) ?? null,
        contract_id: contractId ?? null,
        raw: event as any,
        signature_valid: isValid,
      })
      .onConflictDoNothing()
      .returning({ id: paypalEvents.id })

    inserted = res.length > 0
  } catch (err) {
    log.warn({ err: String(err), event_id: event.id }, 'Failed to insert into paypal_events')
  }

  // 6. If invalid signature, return 400
  if (!isValid) {
    log.warn({ event_id: event.id, event_type: event.event_type }, 'Invalid PayPal webhook signature')
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  // Duplicate event: already recorded previously, ignore to ensure idempotency
  if (!inserted) {
    log.info({ event_id: event.id }, 'Duplicate PayPal webhook event; ignored')
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
  }

  // 7. Process event
  try {
    await handlePayPalEvent(event)
    await db
      .update(paypalEvents)
      .set({ processed_at: new Date() })
      .where(eq(paypalEvents.event_id, event.id))
  } catch (err) {
    log.error({ err: String(err), event_id: event.id }, 'Error processing webhook event in-line; enqueuing reconcile')
    if (contractId) {
      try {
        await enqueueJob(
          db,
          'RECONCILE_PAYPAL',
          { contract_id: contractId },
          { dedupeKey: `reconcile:webhook:${contractId}` }
        )
      } catch (jobErr) {
        log.warn({ jobErr: String(jobErr) }, 'Failed to enqueue RECONCILE_PAYPAL fallback job')
      }
    }
  }

  // Always return 200 after valid receipt so PayPal doesn't flood retries
  return NextResponse.json({ received: true }, { status: 200 })
}
