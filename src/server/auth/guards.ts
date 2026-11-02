/**
 * Route guards — authenticate incoming requests (cookie session or API key).
 */
import { NextRequest } from 'next/server'
import { getSession, verifySession } from './session'
import { verifyApiKey } from './apikeys'
import { UnauthorizedError, ForbiddenError } from '@/server/util/errors'
import type { SessionPayload } from './session'
import type { UserRole } from '@/shared/types'

/**
 * Authenticate a request. Tries:
 * 1. Authorization: Bearer <api_key>
 * 2. pp_session cookie
 */
export async function authenticate(req: NextRequest): Promise<SessionPayload> {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    // API key format: pp_k_...
    if (token.startsWith('pp_k_')) {
      return verifyApiKey(token)
    }
    // JWT token (from Bearer header)
    const payload = await verifySession(token)
    if (!payload) throw new UnauthorizedError('Invalid or expired token')
    return payload
  }

  // Fallback: cookie session
  const session = await getSession()
  if (!session) throw new UnauthorizedError()
  return session
}

/** Require a specific role */
export function requireRole(session: SessionPayload, role: UserRole): void {
  if (session.role !== role && session.role !== 'admin') {
    throw new ForbiddenError(`Role '${role}' required`)
  }
}

/** Require admin role */
export function requireAdmin(session: SessionPayload): void {
  if (session.role !== 'admin') {
    throw new ForbiddenError('Admin access required')
  }
}
