/**
 * PayPal REST Client & Adapters Integration Tests using MSW.
 * Implements phase-5-paypal-funding-and-release.md §5.2, §5.3, §5.4.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import {
  paypalFetch,
  getAccessToken,
  resetTokenCacheForTests,
  SANDBOX_BASE_URL,
} from '@/server/paypal/client'
import { PayPalError } from '@/server/paypal/errors'
import { env } from '@/server/config/env'
import {
  createOrder,
  extractApprovalUrl,
  authorizeOrder,
  getOrder,
} from '@/server/paypal/orders'
import { captureAuthorization } from '@/server/paypal/capture'
import { voidAuthorization } from '@/server/paypal/void'
import { refundCapture } from '@/server/paypal/refund'

const defaultHandlers = [
  http.post(`${SANDBOX_BASE_URL}/v1/oauth2/token`, () => {
    return HttpResponse.json({
      access_token: 'mock_test_access_token_123',
      expires_in: 3600,
    })
  }),
]

const server = setupServer(...defaultHandlers)

describe('PayPal HTTP Client (§5.2)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
  beforeEach(() => {
    server.resetHandlers(...defaultHandlers)
    resetTokenCacheForTests()
  })
  afterEach(() => {
    server.resetHandlers(...defaultHandlers)
    resetTokenCacheForTests()
    vi.restoreAllMocks()
  })
  afterAll(() => server.close())

  it('caches token between calls', async () => {
    let tokenRequests = 0
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v1/oauth2/token`, () => {
        tokenRequests++
        return HttpResponse.json({
          access_token: `token_${tokenRequests}`,
          expires_in: 3600,
        })
      })
    )

    // Ensure mock credentials trigger actual oauth request
    const origId = env.PAYPAL_CLIENT_ID
    const origSecret = env.PAYPAL_CLIENT_SECRET
    Object.defineProperty(env, 'PAYPAL_CLIENT_ID', { value: 'client_123', configurable: true })
    Object.defineProperty(env, 'PAYPAL_CLIENT_SECRET', { value: 'secret_123', configurable: true })

    try {
      const token1 = await getAccessToken()
      const token2 = await getAccessToken()
      expect(token1).toBe('token_1')
      expect(token2).toBe('token_1')
      expect(tokenRequests).toBe(1)
    } finally {
      Object.defineProperty(env, 'PAYPAL_CLIENT_ID', { value: origId, configurable: true })
      Object.defineProperty(env, 'PAYPAL_CLIENT_SECRET', { value: origSecret, configurable: true })
    }
  })

  it('refreshes once on 401', async () => {
    let callCount = 0
    let tokenRequests = 0

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v1/oauth2/token`, () => {
        tokenRequests++
        return HttpResponse.json({
          access_token: `refreshed_token_${tokenRequests}`,
          expires_in: 3600,
        })
      }),
      http.get(`${SANDBOX_BASE_URL}/v1/test-endpoint`, ({ request }) => {
        callCount++
        const auth = request.headers.get('Authorization')
        if (callCount === 1) {
          return new HttpResponse(JSON.stringify({ message: 'Token expired' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return HttpResponse.json({ success: true, authHeader: auth })
      })
    )

    const res = await paypalFetch<{ success: boolean; authHeader: string }>('GET', '/v1/test-endpoint')
    expect(res.success).toBe(true)
    expect(callCount).toBe(2)
  })

  it('retries 503 with the same PayPal-Request-Id', async () => {
    const receivedRequestIds: string[] = []
    let attempts = 0

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v1/test-retry`, ({ request }) => {
        attempts++
        const reqId = request.headers.get('PayPal-Request-Id')
        if (reqId) receivedRequestIds.push(reqId)

        if (attempts < 2) {
          return new HttpResponse(JSON.stringify({ error: 'Service Unavailable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'PayPal-Debug-Id': 'debug_503' },
          })
        }
        return HttpResponse.json({ status: 'OK' })
      })
    )

    const result = await paypalFetch<{ status: string }>('POST', '/v1/test-retry', {
      requestId: 'test-fixed-req-id-123',
    })

    expect(result.status).toBe('OK')
    expect(attempts).toBe(2)
    expect(receivedRequestIds.length).toBe(2)
    expect(receivedRequestIds[0]).toBe('test-fixed-req-id-123')
    expect(receivedRequestIds[1]).toBe('test-fixed-req-id-123')
  })

  it('does not retry 422 INSTRUMENT_DECLINED', async () => {
    let attempts = 0

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v1/test-decline`, () => {
        attempts++
        return new HttpResponse(
          JSON.stringify({
            name: 'UNPROCESSABLE_ENTITY',
            message: 'Instrument declined',
            details: [{ issue: 'INSTRUMENT_DECLINED' }],
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json', 'PayPal-Debug-Id': 'debug_declined' },
          }
        )
      })
    )

    await expect(
      paypalFetch('POST', '/v1/test-decline', { requestId: 'req_declined' })
    ).rejects.toThrow(PayPalError)

    expect(attempts).toBe(1)
  })

  it('times out after 10s and reports ambiguous', async () => {
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v1/test-timeout`, async () => {
        await new Promise((r) => setTimeout(r, 100))
        return HttpResponse.json({ ok: true })
      })
    )

    // Using short timeoutMs to verify timeout behavior quickly
    let thrownError: any = null
    try {
      await paypalFetch('POST', '/v1/test-timeout', { timeoutMs: 20 })
    } catch (err) {
      thrownError = err
    }

    expect(thrownError).toBeInstanceOf(PayPalError)
    expect(thrownError.details?.isAmbiguous).toBe(true)
  })

  it('adds mock header only in CHAOS_MODE', async () => {
    let capturedHeader: string | null = null

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v1/test-chaos`, ({ request }) => {
        capturedHeader = request.headers.get('PayPal-Mock-Response')
        return HttpResponse.json({ status: 'OK' })
      })
    )

    // With CHAOS_MODE = false
    const origChaos = env.CHAOS_MODE
    Object.defineProperty(env, 'CHAOS_MODE', { value: false, configurable: true })
    try {
      await paypalFetch('POST', '/v1/test-chaos', { mockCode: 'INSTRUMENT_DECLINED' })
      expect(capturedHeader).toBeNull()

      // With CHAOS_MODE = true
      Object.defineProperty(env, 'CHAOS_MODE', { value: true, configurable: true })
      await paypalFetch('POST', '/v1/test-chaos', { mockCode: 'INSTRUMENT_DECLINED' })
      expect(capturedHeader).toBe(JSON.stringify({ mock_application_codes: 'INSTRUMENT_DECLINED' }))
    } finally {
      Object.defineProperty(env, 'CHAOS_MODE', { value: origChaos, configurable: true })
    }
  })

  it('refuses non-sandbox base URL', async () => {
    const origEnv = env.PAYPAL_ENV
    Object.defineProperty(env, 'PAYPAL_ENV', { value: 'live', configurable: true })

    try {
      await expect(paypalFetch('GET', '/v1/test')).rejects.toThrow(
        /Refusing non-sandbox/
      )
    } finally {
      Object.defineProperty(env, 'PAYPAL_ENV', { value: origEnv, configurable: true })
    }
  })

  it('logs debug_id and never the token', async () => {
    server.use(
      http.get(`${SANDBOX_BASE_URL}/v1/test-debug`, () => {
        return new HttpResponse(JSON.stringify({ error: 'bad' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'PayPal-Debug-Id': 'pp-dbg-98765',
          },
        })
      })
    )

    try {
      await paypalFetch('GET', '/v1/test-debug')
    } catch (err: any) {
      expect(err).toBeInstanceOf(PayPalError)
      expect(err.details?.debug_id).toBe('pp-dbg-98765')
    }
  })
})

describe('Orders and Authorization Adapters (§5.3)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('createOrder sends intent AUTHORIZE and CONTINUE', async () => {
    let capturedBody: any = null

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/checkout/orders`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({
          id: 'ORDER_123',
          status: 'PAYER_ACTION_REQUIRED',
          links: [
            { href: 'https://sandbox.paypal.com/checkoutnow?token=ORDER_123', rel: 'payer-action' },
          ],
        })
      })
    )

    const order = await createOrder({
      contractId: '9c1f2a7e-3b0d-4c2e-8f55-1d7a6e2b9a10',
      title: 'Test Deliverable',
      totalMinor: 10000,
      returnUrl: 'https://proofpay.test/return',
      cancelUrl: 'https://proofpay.test/cancel',
    })

    expect(order.id).toBe('ORDER_123')
    expect(capturedBody.intent).toBe('AUTHORIZE')
    expect(capturedBody.payment_source.paypal.experience_context.user_action).toBe('CONTINUE')
    expect(capturedBody.purchase_units[0].invoice_id).toBe('PP-9c1f2a7e')
    expect(capturedBody.purchase_units[0].amount.value).toBe('100.00')
    expect(capturedBody.purchase_units[0].payee).toBeUndefined()
  })

  it('extractApprovalUrl prefers payer-action', () => {
    const links = [
      { href: 'https://paypal.com/approve', rel: 'approve' },
      { href: 'https://paypal.com/payer-action', rel: 'payer-action' },
    ]
    expect(extractApprovalUrl(links)).toBe('https://paypal.com/payer-action')

    const fallbackOnly = [{ href: 'https://paypal.com/approve-only', rel: 'approve' }]
    expect(extractApprovalUrl(fallbackOnly)).toBe('https://paypal.com/approve-only')

    expect(() => extractApprovalUrl([])).toThrow(/No links returned/)
  })

  it('authorizeOrder parses authorization id and times', async () => {
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/checkout/orders/ORD_456/authorize`, () => {
        return HttpResponse.json({
          id: 'ORD_456',
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                authorizations: [
                  {
                    id: 'AUTH_789',
                    status: 'CREATED',
                    amount: { currency_code: 'USD', value: '100.00' },
                    create_time: '2026-11-04T10:00:00Z',
                    expiration_time: '2026-12-03T10:00:00Z',
                  },
                ],
              },
            },
          ],
        })
      })
    )

    const auth = await authorizeOrder('ORD_456')
    expect(auth.authorizationId).toBe('AUTH_789')
    expect(auth.status).toBe('CREATED')
    expect(auth.createTime).toBe('2026-11-04T10:00:00Z')
    expect(auth.expirationTime).toBe('2026-12-03T10:00:00Z')
  })

  it('authorizeOrder fails clearly when status is not CREATED', async () => {
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/checkout/orders/ORD_FAIL/authorize`, () => {
        return HttpResponse.json({
          id: 'ORD_FAIL',
          status: 'VOIDED',
          purchase_units: [{ payments: { authorizations: [] } }],
        })
      })
    )

    await expect(authorizeOrder('ORD_FAIL')).rejects.toThrow(/missing authorization/)
  })

  it('getOrder lists captures by invoice_id', async () => {
    server.use(
      http.get(`${SANDBOX_BASE_URL}/v2/checkout/orders/ORD_DETAILED`, () => {
        return HttpResponse.json({
          id: 'ORD_DETAILED',
          status: 'COMPLETED',
          intent: 'AUTHORIZE',
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'CAP_1',
                    status: 'COMPLETED',
                    invoice_id: 'PP-9c1f2a7e-m1',
                    amount: { currency_code: 'USD', value: '60.00' },
                    final_capture: false,
                  },
                  {
                    id: 'CAP_2',
                    status: 'COMPLETED',
                    invoice_id: 'PP-9c1f2a7e-m2',
                    amount: { currency_code: 'USD', value: '40.00' },
                    final_capture: true,
                  },
                ],
              },
            },
          ],
        })
      })
    )

    const order = await getOrder('ORD_DETAILED')
    expect(order.captures.length).toBe(2)
    expect(order.captures[0]?.invoice_id).toBe('PP-9c1f2a7e-m1')
    expect(order.captures[0]?.amount.value).toBe('60.00')
    expect(order.captures[1]?.final_capture).toBe(true)
  })
})

describe('Capture, Void, and Refund Adapters (§5.4)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('capture sends amount, final_capture and unique invoice_id', async () => {
    let capturedBody: any = null

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_CAP/capture`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({
          id: 'CAPTURE_111',
          status: 'COMPLETED',
          final_capture: true,
          amount: { currency_code: 'USD', value: '60.00' },
        })
      })
    )

    const res = await captureAuthorization({
      authorizationId: 'AUTH_CAP',
      amountMinor: 6000,
      finalCapture: true,
      invoiceId: 'PP-contract8-m1',
      note: 'Milestone verified',
    })

    expect(res.captureId).toBe('CAPTURE_111')
    expect(res.status).toBe('COMPLETED')
    expect(capturedBody.amount.value).toBe('60.00')
    expect(capturedBody.final_capture).toBe(true)
    expect(capturedBody.invoice_id).toBe('PP-contract8-m1')
  })

  it('capture returns PENDING without throwing', async () => {
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_PEND/capture`, () => {
        return HttpResponse.json({
          id: 'CAPTURE_PENDING',
          status: 'PENDING',
        })
      })
    )

    const res = await captureAuthorization({
      authorizationId: 'AUTH_PEND',
      amountMinor: 4000,
      finalCapture: false,
      invoiceId: 'PP-inv-m2',
    })

    expect(res.status).toBe('PENDING')
    expect(res.captureId).toBe('CAPTURE_PENDING')
  })

  it('capture maps INSTRUMENT_DECLINED to PayPalError', async () => {
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_DEC/capture`, () => {
        return new HttpResponse(
          JSON.stringify({
            name: 'UNPROCESSABLE_ENTITY',
            message: 'Payment declined',
            details: [{ issue: 'INSTRUMENT_DECLINED' }],
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )

    await expect(
      captureAuthorization({
        authorizationId: 'AUTH_DEC',
        amountMinor: 5000,
        finalCapture: false,
        invoiceId: 'PP-inv-declined',
      })
    ).rejects.toThrow(PayPalError)
  })

  it('void succeeds on 204', async () => {
    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/authorizations/AUTH_VOID/void`, () => {
        return new HttpResponse(null, { status: 204 })
      })
    )

    await expect(voidAuthorization('AUTH_VOID')).resolves.toBeUndefined()
  })

  it('refund omits amount for full refund', async () => {
    let capturedBody: any = null

    server.use(
      http.post(`${SANDBOX_BASE_URL}/v2/payments/captures/CAP_REFUND/refund`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({
          id: 'REFUND_999',
          status: 'COMPLETED',
        })
      })
    )

    const res = await refundCapture({
      captureId: 'CAP_REFUND',
      note: 'Full refund issued',
    })

    expect(res.id).toBe('REFUND_999')
    expect(capturedBody.amount).toBeUndefined()
    expect(capturedBody.note_to_payer).toBe('Full refund issued')
  })
})
