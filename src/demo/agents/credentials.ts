/**
 * Agent Credentials Helper — manages encrypted API keys for autonomous demo agents.
 * Implements phase-7-agents-judge-mode-mcp.md §7.1.
 */
import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { users, kv } from '@/server/db/schema'
import { createApiKey } from '@/server/auth/apikeys'
import { createApiClient, type ApiClient } from '@/shared/api-client'
import { env } from '@/server/config/env'

export type AgentPersona = 'buyer_agent' | 'worker_agent'

const PERSONA_CONFIG: Record<
  AgentPersona,
  { email: string; displayName: string; role: 'buyer' | 'seller' }
> = {
  buyer_agent: {
    email: 'buyer-agent@demo.proofpay',
    displayName: 'ProcureBot',
    role: 'buyer',
  },
  worker_agent: {
    email: 'worker-agent@demo.proofpay',
    displayName: 'SynthetixBot',
    role: 'seller',
  },
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptSecret(secret: string, masterKey: string): { iv: string; tag: string; data: string } {
  const key = deriveKey(masterKey)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(secret, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted,
  }
}

export function decryptSecret(payload: { iv: string; tag: string; data: string }, masterKey: string): string {
  const key = deriveKey(masterKey)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'hex'))
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'))
  let decrypted = decipher.update(payload.data, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * Retrieves or lazily provisions an authenticated API client for an autonomous agent persona.
 */
export async function getAgentClient(
  persona: AgentPersona,
  customBaseUrl?: string
): Promise<{ client: ApiClient; apiKey: string; userId: string }> {
  const db = getDb()
  const kvKey = `demo:apikey:${persona}`
  const config = PERSONA_CONFIG[persona]

  // 1. Ensure the user persona exists in users table
  let [user] = await db.select().from(users).where(eq(users.email, config.email)).limit(1)
  if (!user) {
    const [created] = await db
      .insert(users)
      .values({
        email: config.email,
        display_name: config.displayName,
        role: config.role,
        is_agent: true,
      })
      .returning()
    user = created!
  }

  // 2. Check if encrypted secret is already stored in kv
  const [existingKv] = await db.select().from(kv).where(eq(kv.key, kvKey)).limit(1)

  let apiKey: string

  if (existingKv && existingKv.value) {
    const encPayload = existingKv.value as { iv: string; tag: string; data: string }
    try {
      apiKey = decryptSecret(encPayload, env.SESSION_SECRET)
    } catch {
      // If decryption fails (e.g. session secret changed), re-create
      apiKey = ''
    }
  } else {
    apiKey = ''
  }

  if (!apiKey) {
    // Mint new API key
    const minted = await createApiKey(user.id, `Demo ${config.displayName}`)
    apiKey = minted.secret

    // Encrypt and persist to kv
    const encrypted = encryptSecret(apiKey, env.SESSION_SECRET)
    await db
      .insert(kv)
      .values({
        key: kvKey,
        value: encrypted,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: kv.key,
        set: {
          value: encrypted,
          updated_at: new Date(),
        },
      })
  }

  const baseUrl = customBaseUrl || env.APP_BASE_URL || 'http://localhost:3000'
  const client = createApiClient({ baseUrl, apiKey })

  return { client, apiKey, userId: user.id }
}
