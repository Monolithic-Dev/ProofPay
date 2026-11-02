/**
 * PayPal Orders API v2 adapter.
 * Implements phase-5-paypal-funding-and-release.md §5.3 & paypal-integration.md §3.1, §3.2, §3.7.
 *
 * Rules:
 * - Intent is always AUTHORIZE.
 * - user_action is CONTINUE (no capture at approval).
 * - purchase_units.payee is NOT set (single merchant model).
 * - Invoice ID format: PP-<contractIdFirst8>.
 * - Amounts converted with integer toPayPalValue.
 */
import { paypalFetch } from './client'
import { toPayPalValue } from './money'
import { PayPalError } from './errors'

export interface CreateOrderParams {
  contractId: string
  title: string
  totalMinor: number
  returnUrl: string
  cancelUrl: string
  requestId?: string
}

export interface PayPalOrderLink {
  href: string
  rel: string
  method?: string
}

export interface CreateOrderResult {
  id: string
  status: string
  links: PayPalOrderLink[]
}

export interface AuthorizeOrderResult {
  authorizationId: string
  status: string
  createTime?: string
  expirationTime?: string
  amount?: { currency_code: string; value: string }
  raw?: unknown
}

export interface PayPalCaptureSummary {
  id: string
  status: string
  invoice_id?: string
  amount: { currency_code: string; value: string }
  final_capture?: boolean
  create_time?: string
}

export interface PayPalOrderDetails {
  id: string
  status: string
  intent: string
  captures: PayPalCaptureSummary[]
  links?: PayPalOrderLink[]
  raw: unknown
}

/**
 * Create an order with intent=AUTHORIZE to start the funding hold.
 */
export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const { contractId, title, totalMinor, returnUrl, cancelUrl, requestId } = params
  const shortId = contractId.slice(0, 8)
  const description = `ProofPay contract: ${title}`.slice(0, 80)

  const body = {
    intent: 'AUTHORIZE',
    purchase_units: [
      {
        reference_id: contractId,
        custom_id: contractId,
        invoice_id: `PP-${shortId}`,
        description,
        amount: {
          currency_code: 'USD',
          value: toPayPalValue(totalMinor),
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: 'ProofPay',
          locale: 'en-US',
          landing_page: 'LOGIN',
          user_action: 'CONTINUE',
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      },
    },
  }

  const res = await paypalFetch<CreateOrderResult>('POST', '/v2/checkout/orders', {
    body,
    requestId,
  })

  return {
    id: res.id,
    status: res.status,
    links: res.links ?? [],
  }
}

/**
 * Extract buyer approval URL from order links.
 * Prefers 'payer-action', falls back to 'approve'.
 */
export function extractApprovalUrl(links: PayPalOrderLink[] | undefined): string {
  if (!links || links.length === 0) {
    throw new PayPalError('No links returned in PayPal order response', {
      issue: 'MISSING_LINKS',
    })
  }

  const payerAction = links.find((l) => l.rel === 'payer-action')
  if (payerAction?.href) return payerAction.href

  const approve = links.find((l) => l.rel === 'approve')
  if (approve?.href) return approve.href

  throw new PayPalError('Approval link not found in PayPal order links', {
    issue: 'MISSING_APPROVAL_URL',
  })
}

/**
 * Authorize an approved order.
 * Extracts authorization object from purchase_units[0].payments.authorizations[0].
 */
export async function authorizeOrder(
  orderId: string,
  requestId?: string
): Promise<AuthorizeOrderResult> {
  const res = await paypalFetch<any>('POST', `/v2/checkout/orders/${orderId}/authorize`, {
    body: {},
    requestId,
  })

  const auth = res?.purchase_units?.[0]?.payments?.authorizations?.[0]
  if (!auth || !auth.id) {
    throw new PayPalError(
      `PayPal order authorize response missing authorization: status is ${res?.status ?? 'UNKNOWN'}`,
      {
        status: 422,
        issue: 'AUTHORIZATION_NOT_CREATED',
        details: res,
      }
    )
  }

  return {
    authorizationId: auth.id,
    status: auth.status,
    createTime: auth.create_time,
    expirationTime: auth.expiration_time,
    amount: auth.amount,
    raw: res,
  }
}

/**
 * Get order details, including captures for reconciliation.
 */
export async function getOrder(orderId: string): Promise<PayPalOrderDetails> {
  const res = await paypalFetch<any>('GET', `/v2/checkout/orders/${orderId}`)

  const rawCaptures = res?.purchase_units?.[0]?.payments?.captures ?? []
  const captures: PayPalCaptureSummary[] = rawCaptures.map((c: any) => ({
    id: c.id,
    status: c.status,
    invoice_id: c.invoice_id,
    amount: c.amount ?? { currency_code: 'USD', value: '0.00' },
    final_capture: c.final_capture,
    create_time: c.create_time,
  }))

  return {
    id: res.id,
    status: res.status,
    intent: res.intent,
    captures,
    links: res.links,
    raw: res,
  }
}
