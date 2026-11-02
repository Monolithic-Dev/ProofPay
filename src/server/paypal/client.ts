/**
 * PayPal REST client — OAuth token cache, typed fetch, retries, idempotency.
 * Implements paypal-integration.md §1, §12.
 *
 * IMPORTANT: This module only handles auth and transport.
 * Business logic lives in orders.ts, authorizations.ts, capture.ts, etc.
 */
import { env } from '@/server/config/env'
import { logger } from '@/server/util/logger'
import { PayPalError } from '@/server/util/errors'

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------
let _tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (_tokenCache && _tokenCache.expiresAt > now + 30_000) {
    return _tokenCache.token
  }

  const credentials = Buffer.from(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new PayPalError(`PayPal OAuth failed: ${res.status}`, body)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  _tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  }
  return _tokenCache.token
}

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------
function baseUrl(): string {
  return 'https://api-m.sandbox.paypal.com' // always sandbox per env validation
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------
export interface PayPalRequestOptions {
  method?: string
  body?: unknown
  requestId: string
  mockCode?: string  // PayPal-Mock-Response header value (sandbox only)
  idempotencyKey?: string
}

export async function ppFetch<T>(
  path: string,
  opts: PayPalRequestOptions
): Promise<T> {
  const { method = 'GET', body, requestId, mockCode, idempotencyKey } = opts
  const token = await getAccessToken()

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'PayPal-Request-Id': requestId,
  }
  if (mockCode) {
    headers['PayPal-Mock-Response'] = JSON.stringify({ mock_application_codes: mockCode })
  }
  if (idempotencyKey) {
    headers['PayPal-Request-Id'] = idempotencyKey
  }

  const log = logger.child({ request_id: requestId, paypal_path: path })
  const url = `${baseUrl()}${path}`

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      })

      const debugId = res.headers.get('PayPal-Debug-Id') ?? 'unknown'

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        log.warn({ status: res.status, debug_id: debugId, body: errBody }, 'PayPal error')
        // 429 / 503 → retry
        if ((res.status === 429 || res.status >= 500) && attempt < 3) {
          await sleep(attempt * 1000)
          continue
        }
        throw new PayPalError(
          `PayPal ${method} ${path} failed: ${res.status}`,
          { debug_id: debugId, body: errBody }
        )
      }

      if (res.status === 204) return {} as T
      return res.json() as Promise<T>
    } catch (err) {
      if (err instanceof PayPalError) throw err
      if (attempt === 3) throw new PayPalError(`PayPal request failed after 3 attempts`, { cause: String(err) })
      await sleep(attempt * 1000)
    }
  }

  throw new PayPalError('PayPal request exhausted retries')
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Expose base URL for scripts */
export { baseUrl as paypalBaseUrl }
