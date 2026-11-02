/**
 * PayPal void — ONLY imported by src/server/release/.
 */
import { ppFetch } from './client'
import { newRequestId } from '@/server/util/ids'

export async function voidAuthorization(authId: string): Promise<void> {
  await ppFetch<void>(
    `/v2/payments/authorizations/${authId}/void`,
    {
      method: 'POST',
      requestId: newRequestId(),
      idempotencyKey: `pp:void:${authId}`,
      body: {},
    }
  )
}
