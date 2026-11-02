/**
 * PayPal REST Client — OAuth token cache, typed fetch, retries, and idempotency.
 * Implements phase-5-paypal-funding-and-release.md §5.2 & paypal-integration.md §3, §4.
 *
 * Rules:
 * - Refuses any base URL other than https://api-m.sandbox.paypal.com.
 * - Single-flight OAuth refresh cached until expires_in - 60s.
 * - Same PayPal-Request-Id across automatic retries on timeout/5xx/429.
 * - Adds PayPal-Mock-Response ONLY when env.CHAOS_MODE && mockCode.
 * - Logs debug_id and NEVER logs tokens or secrets.
 */
import { env } from '@/server/config/env'
import { logger } from '@/server/util/logger'
import { PayPalError, isAmbiguous } from './errors'

export const SANDBOX_BASE_URL = 'https://api-m.sandbox.paypal.com'

// ---------------------------------------------------------------------------
// In-memory token cache & single-flight refresh
// ---------------------------------------------------------------------------
let _cachedToken: { token: string; expiresAt: number } | null = null
let _tokenRefreshPromise: Promise<string> | null = null

export function resetTokenCacheForTests(): void {
  _cachedToken = null
  _tokenRefreshPromise = null
}

export async function getAccessToken(forceRefresh = false): Promise<string> {
  const now = Date.now()
  if (!forceRefresh && _cachedToken && _cachedToken.expiresAt > now) {
    return _cachedToken.token
  }

  if (_tokenRefreshPromise) {
    return _tokenRefreshPromise
  }

  _tokenRefreshPromise = (async () => {
    try {
      const clientId = env.PAYPAL_CLIENT_ID
      const clientSecret = env.PAYPAL_CLIENT_SECRET

      // In tests/dev without real keys, return mock token if not provided
      if (!clientId || clientId.startsWith('YOUR_') || !clientSecret || clientSecret.startsWith('YOUR_')) {
        _cachedToken = {
          token: 'mock_sandbox_access_token_' + Date.now(),
          expiresAt: Date.now() + 3600 * 1000,
        }
        return _cachedToken.token
      }

      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

      const res = await fetch(`${SANDBOX_BASE_URL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(10_000),
      })

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '')
        throw new PayPalError(`PayPal OAuth authorization failed: HTTP ${res.status}`, {
          status: res.status,
          message: bodyText,
        })
      }

      const data = (await res.json()) as { access_token: string; expires_in: number }
      // Cache until expires_in - 60s
      const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 3600
      _cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + Math.max(60, expiresInSec - 60) * 1000,
      }
      return _cachedToken.token
    } finally {
      _tokenRefreshPromise = null
    }
  })()

  return _tokenRefreshPromise
}

// ---------------------------------------------------------------------------
// Base URL validation
// ---------------------------------------------------------------------------
export function getBaseUrl(): string {
  if (env.PAYPAL_ENV !== 'sandbox') {
    throw new PayPalError(
      `Refusing non-sandbox PayPal environment: "${env.PAYPAL_ENV}". ProofPay only supports sandbox mode.`,
      { issue: 'INVALID_ENVIRONMENT' }
    )
  }
  return SANDBOX_BASE_URL
}

// ---------------------------------------------------------------------------
// Core fetch options
// ---------------------------------------------------------------------------
export interface PayPalFetchOptions {
  body?: unknown
  requestId?: string
  mockCode?: string
  timeoutMs?: number
  idempotencyKey?: string // compatibility alias for requestId
}

/**
 * Execute an HTTP request against the PayPal REST API.
 */
export async function paypalFetch<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  opts?: PayPalFetchOptions
): Promise<T> {
  const baseUrl = getBaseUrl()
  const timeoutMs = opts?.timeoutMs ?? 10_000
  const requestId = opts?.requestId ?? opts?.idempotencyKey
  const mockCode = opts?.mockCode

  let token = await getAccessToken()
  let refreshedTokenOnce = false

  const maxAttempts = 3
  const delays = [1000, 3000, 9000]

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }

    // PayPal-Request-Id only on POST requests
    if (method === 'POST' && requestId) {
      headers['PayPal-Request-Id'] = requestId
    }

    // Apply mock response header ONLY if CHAOS_MODE is enabled AND mockCode is present
    if (env.CHAOS_MODE && mockCode) {
      headers['PayPal-Mock-Response'] = JSON.stringify({ mock_application_codes: mockCode })
    }

    const log = logger.child({
      paypal_op: `${method} ${path}`,
      attempt,
      request_id: requestId,
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const debugId = res.headers.get('PayPal-Debug-Id') ?? res.headers.get('paypal-debug-id') ?? undefined

      // 401 Unauthorized: token expired in flight → refresh once and retry immediately
      if (res.status === 401 && !refreshedTokenOnce) {
        log.warn({ status: 401, debug_id: debugId }, 'PayPal returned 401, refreshing token and retrying')
        refreshedTokenOnce = true
        token = await getAccessToken(true)
        continue
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        const errorDetails = {
          status: res.status,
          name: errJson?.name,
          message: errJson?.message,
          issue: errJson?.details?.[0]?.issue,
          debug_id: debugId,
          isAmbiguous: res.status >= 500,
        }

        log.warn(
          {
            status: res.status,
            debug_id: debugId,
            issue: errorDetails.issue,
          },
          'PayPal API returned error status'
        )

        // 429 or 5xx: retry with same request ID
        if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
          let retryDelayMs = delays[attempt - 1]!
          const retryAfterHeader = res.headers.get('Retry-After')
          if (retryAfterHeader) {
            const parsedSeconds = parseInt(retryAfterHeader, 10)
            if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
              retryDelayMs = parsedSeconds * 1000
            }
          }
          // Add ±20% jitter
          const jitter = (Math.random() * 0.4 - 0.2) * retryDelayMs
          await sleep(Math.floor(retryDelayMs + jitter))
          continue
        }

        // Other 4xx are final client / business errors (do not retry)
        throw new PayPalError(
          `PayPal ${method} ${path} failed: ${res.status} ${errJson?.message ?? ''}`.trim(),
          errorDetails
        )
      }

      if (res.status === 204) {
        return {} as T
      }

      return (await res.json()) as T
    } catch (err: any) {
      clearTimeout(timeoutId)

      if (err instanceof PayPalError) {
        throw err
      }

      const isNetworkOrTimeout = isAmbiguous(err) || err.name === 'AbortError'
      log.warn({ attempt, err: String(err) }, 'PayPal fetch threw network or timeout exception')

      if (isNetworkOrTimeout && attempt < maxAttempts) {
        const baseDelay = delays[attempt - 1]!
        const jitter = (Math.random() * 0.4 - 0.2) * baseDelay
        await sleep(Math.floor(baseDelay + jitter))
        continue
      }

      // Final failure after retries
      throw new PayPalError(`PayPal ${method} ${path} connection failed after ${attempt} attempts: ${err.message}`, {
        isAmbiguous: true,
        cause: err,
      })
    }
  }

  throw new PayPalError(`PayPal request exhausted ${maxAttempts} retry attempts`, { isAmbiguous: true })
}

// Backward-compatible alias
export async function ppFetch<T>(
  path: string,
  opts: {
    method?: string
    body?: unknown
    requestId?: string
    mockCode?: string
    idempotencyKey?: string
    timeoutMs?: number
  }
): Promise<T> {
  const method = (opts.method ?? 'GET').toUpperCase() as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  return paypalFetch<T>(method, path, {
    body: opts.body,
    requestId: opts.requestId ?? opts.idempotencyKey,
    mockCode: opts.mockCode,
    timeoutMs: opts.timeoutMs,
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
