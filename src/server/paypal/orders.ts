/**
 * PayPal Orders API v2 — createOrder, authorizeOrder, getOrder.
 */
import { ppFetch } from './client'
import { newRequestId } from '@/server/util/ids'

export interface CreateOrderParams {
  amountMinor: number
  contractId: string
  invoiceSuffix: string
  returnUrl: string
  cancelUrl: string
}

export interface PayPalOrder {
  id: string
  status: string
  links: Array<{ href: string; rel: string; method: string }>
}

export async function createOrder(params: CreateOrderParams): Promise<PayPalOrder> {
  const { amountMinor, contractId, invoiceSuffix, returnUrl, cancelUrl } = params
  const amount = (amountMinor / 100).toFixed(2)

  return ppFetch<PayPalOrder>('/v2/checkout/orders', {
    method: 'POST',
    requestId: newRequestId(),
    idempotencyKey: `pp:order:${contractId}:${invoiceSuffix}`,
    body: {
      intent: 'AUTHORIZE',
      purchase_units: [
        {
          reference_id: contractId,
          custom_id: contractId,
          invoice_id: `PP-${contractId.slice(0, 8)}-${invoiceSuffix}`,
          amount: { currency_code: 'USD', value: amount },
          payee: {
            merchant_id: process.env['PAYPAL_MERCHANT_ID'],
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'ProofPay',
            user_action: 'PAY_NOW',
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    },
  })
}

export interface AuthorizeOrderResult {
  id: string
  status: string
  purchase_units: Array<{
    payments: {
      authorizations: Array<{
        id: string
        status: string
        expiration_time?: string
        seller_protection?: { status: string }
        create_time?: string
        links: Array<{ href: string; rel: string }>
      }>
    }
  }>
}

export async function authorizeOrder(orderId: string): Promise<AuthorizeOrderResult> {
  return ppFetch<AuthorizeOrderResult>(
    `/v2/checkout/orders/${orderId}/authorize`,
    {
      method: 'POST',
      requestId: newRequestId(),
      idempotencyKey: `pp:authorize:${orderId}`,
      body: {},
    }
  )
}

export async function getOrder(orderId: string): Promise<PayPalOrder> {
  return ppFetch<PayPalOrder>(`/v2/checkout/orders/${orderId}`, {
    requestId: newRequestId(),
  })
}

/** Extract the payer-action (approval) URL from an order */
export function getApprovalUrl(order: PayPalOrder): string | undefined {
  return order.links.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href
}
