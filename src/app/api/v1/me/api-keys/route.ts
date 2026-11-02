/**
 * User API keys management — GET, POST /api/v1/me/api-keys
 * Implements phase-3-auth-and-contracts.md §3.8 & api-spec.md §3.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { createApiKey, listApiKeys } from '@/server/auth/apikeys'

export const GET = apiHandler(
  { auth: 'user' },
  async ({ user }) => {
    const keys = await listApiKeys(user!.sub)

    return NextResponse.json({ api_keys: keys }, { status: 200 })
  }
)

const CreateApiKeySchema = z.object({
  label: z.string().min(1).max(100).default('Default Key'),
})

export const POST = apiHandler(
  {
    auth: 'user',
    body: CreateApiKeySchema,
  },
  async ({ user, body }) => {
    const created = await createApiKey(user!.sub, body?.label ?? 'Default Key')

    return NextResponse.json(created, { status: 201 })
  }
)
