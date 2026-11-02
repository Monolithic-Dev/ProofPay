import { describe, it, expect } from 'vitest'
import { signSession, readSession } from '@/server/auth/session'
import { createApiKey, authenticateApiKey } from '@/server/auth/apikeys'
import { forbidAgent, requireRole } from '@/server/auth/guards'
import { ForbiddenError, UnauthorizedError } from '@/server/util/errors'

describe('Authentication & Authorization Mechanics', () => {
  it('signSession and readSession generate and verify valid JWTs', async () => {
    const user = {
      id: '00000000-1111-2222-3333-444444444444',
      email: 'sarah@buyer.test',
      role: 'buyer' as const,
      is_agent: false,
    }

    const token = await signSession(user)
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)

    const payload = await readSession(token)
    expect(payload).not.toBeNull()
    expect(payload?.sub).toBe(user.id)
    expect(payload?.email).toBe(user.email)
    expect(payload?.role).toBe('buyer')
    expect(payload?.is_agent).toBe(false)
  })

  it('tampered JWT is rejected by readSession', async () => {
    const user = {
      id: '00000000-1111-2222-3333-444444444444',
      role: 'buyer' as const,
      is_agent: false,
    }
    const token = await signSession(user)
    const tampered = token.slice(0, -6) + 'xxxxxx'

    const payload = await readSession(tampered)
    expect(payload).toBeNull()
  })

  it('forbidAgent blocks agent users with 403 ForbiddenError', () => {
    const agentUser = {
      sub: 'agent-1',
      email: 'bot@proofpay.test',
      role: 'buyer' as const,
      is_agent: true,
    }
    const humanUser = {
      sub: 'human-1',
      email: 'human@proofpay.test',
      role: 'buyer' as const,
      is_agent: false,
    }

    expect(() => forbidAgent(agentUser)).toThrow(ForbiddenError)
    expect(() => forbidAgent(humanUser)).not.toThrow()
  })

  it('requireRole allows matching roles and admin, rejects unauthorized roles', () => {
    const buyerUser = {
      sub: 'u1',
      email: 'buyer@test',
      role: 'buyer' as const,
      is_agent: false,
    }
    const adminUser = {
      sub: 'u2',
      email: 'admin@test',
      role: 'admin' as const,
      is_agent: false,
    }

    expect(() => requireRole(buyerUser, 'buyer')).not.toThrow()
    expect(() => requireRole(buyerUser, 'seller')).toThrow(ForbiddenError)
    // Admins are always allowed
    expect(() => requireRole(adminUser, 'seller')).not.toThrow()
  })

  it('authenticateApiKey rejects invalid key prefixes', async () => {
    await expect(authenticateApiKey('invalid_token_prefix')).rejects.toThrow(UnauthorizedError)
  })
})
