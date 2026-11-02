/**
 * Revoke API key endpoint — DELETE /api/v1/me/api-keys/[id]
 * Implements phase-3-auth-and-contracts.md §3.8 & api-spec.md §3.
 */
import { NextResponse } from 'next/server'
import { apiHandler } from '@/server/http/handler'
import { revokeApiKey } from '@/server/auth/apikeys'

export const DELETE = apiHandler(
  { auth: 'user' },
  async ({ user, params }) => {
    const keyId = params['id']!
    await revokeApiKey(user!.sub, keyId)

    return NextResponse.json({ ok: true }, { status: 200 })
  }
)
