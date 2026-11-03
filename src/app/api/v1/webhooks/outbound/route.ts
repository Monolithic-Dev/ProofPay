import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readSession } from '@/server/auth/session'
import { getOrgWebhookConfig, saveOrgWebhookConfig, dispatchOutboundWebhook } from '@/server/webhooks/outbound'
import { toErrorResponse, httpStatusFor, ValidationError, UnauthorizedError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

const webhookSchema = z.object({
  url: z.string().url('Must be a valid HTTPS webhook URL'),
  secret: z.string().min(8, 'Secret must be at least 8 characters').default('webhook_secret_key_123'),
  events: z.array(z.string()).default(['*']),
  enabled: z.boolean().default(true),
  test_ping: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) throw new UnauthorizedError('UNAUTHENTICATED')

    const orgId = user.org_id || user.sub
    const config = await getOrgWebhookConfig(orgId)

    return NextResponse.json({
      config: config || {
        url: '',
        secret: 'whsec_' + Math.random().toString(36).substring(2, 12),
        events: ['contract.funded', 'milestone.verified', 'milestone.released'],
        enabled: false,
      },
    }, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}

export async function POST(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) throw new UnauthorizedError('UNAUTHENTICATED')

    const orgId = user.org_id || user.sub
    const body = await req.json().catch(() => ({}))

    const parsed = webhookSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(`Invalid webhook config: ${parsed.error.message}`)
    }

    const { url, secret, events, enabled, test_ping } = parsed.data

    await saveOrgWebhookConfig(orgId, { url, secret, events, enabled })

    let pingResult: any = null
    if (test_ping) {
      pingResult = await dispatchOutboundWebhook(orgId, {
        type: 'webhook.ping',
        payload: {
          message: 'ProofPay outbound webhook test ping for Zapier / automation',
          timestamp: new Date().toISOString(),
          org_id: orgId,
        },
      })
    }

    return NextResponse.json({
      ok: true,
      config: { url, secret, events, enabled },
      ping: pingResult,
    }, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
