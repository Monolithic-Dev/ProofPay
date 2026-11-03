import crypto from 'node:crypto'
import { getDb } from '@/server/db/client'
import { kv } from '@/server/db/schema'
import { eq } from 'drizzle-orm'

export interface WebhookConfig {
  url: string
  secret: string
  events: string[]
  enabled: boolean
}

export async function getOrgWebhookConfig(orgId: string): Promise<WebhookConfig | null> {
  const db = getDb()
  const key = `webhook_config:${orgId}`
  const [row] = await db.select().from(kv).where(eq(kv.key, key)).limit(1)
  if (!row) return null
  try {
    if (typeof row.value === 'string') {
      return JSON.parse(row.value) as WebhookConfig
    }
    return row.value as WebhookConfig
  } catch {
    return null
  }
}

export async function saveOrgWebhookConfig(orgId: string, config: WebhookConfig): Promise<void> {
  const db = getDb()
  const key = `webhook_config:${orgId}`
  await db
    .insert(kv)
    .values({ key, value: config as any })
    .onConflictDoUpdate({ target: kv.key, set: { value: config as any } })
}

export async function dispatchOutboundWebhook(
  orgId: string,
  event: { type: string; payload: Record<string, unknown> }
): Promise<{ dispatched: boolean; status?: number }> {
  const config = await getOrgWebhookConfig(orgId)
  if (!config || !config.enabled || !config.url) {
    return { dispatched: false }
  }

  // Check event filter
  if (config.events && config.events.length > 0 && !config.events.includes(event.type) && !config.events.includes('*')) {
    return { dispatched: false }
  }

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const bodyString = JSON.stringify({
    event: event.type,
    timestamp,
    data: event.payload,
  })

  // Calculate HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', config.secret || 'default_secret')
    .update(`${timestamp}.${bodyString}`)
    .digest('hex')

  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ProofPay-Event': event.type,
        'X-ProofPay-Signature': signature,
        'X-ProofPay-Timestamp': timestamp,
        'User-Agent': 'ProofPay-Webhook-Dispatcher/2.1',
      },
      body: bodyString,
    })

    return { dispatched: true, status: res.status }
  } catch (err) {
    console.warn(`[Webhook] Outbound webhook dispatch failed:`, err)
    return { dispatched: false }
  }
}
