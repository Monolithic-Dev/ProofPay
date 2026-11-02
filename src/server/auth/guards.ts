/**
 * Authentication and authorization route guards.
 * Implements phase-3-auth-and-contracts.md §3.1.
 */
import { NextRequest } from 'next/server'
import { readSession, type SessionUser } from './session'
export type { SessionUser } from './session'
import { authenticateApiKey } from './apikeys'
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/server/util/errors'
import { getContractById } from '@/server/db/repos/contracts.repo'
import type { Tx, Db } from '@/server/db/client'
import type { UserRole } from '@/shared/types'
import type { ContractRow } from '@/server/db/schema'

/**
 * Require an authenticated user (either through session cookie or Bearer API key).
 */
export async function requireUser(req: Request | NextRequest): Promise<SessionUser> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token.startsWith('pp_k_')) {
      return authenticateApiKey(token)
    }
    const session = await readSession(token)
    if (!session) throw new UnauthorizedError('INVALID_TOKEN')
    return session
  }

  // Fallback to cookie
  const session = await readSession(req)
  if (!session) throw new UnauthorizedError('UNAUTHENTICATED')
  return session
}

export const authenticate = requireUser

/**
 * Require that the user possesses one of the allowed roles (admins always allowed).
 */
export function requireRole(user: SessionUser, ...allowedRoles: UserRole[]): void {
  if (user.role === 'admin') return
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(`Role required: [${allowedRoles.join(', ')}]`)
  }
}

/**
 * Assert that the user is a legitimate party to the contract (buyer, seller, or admin).
 * Strangers are thrown a 404 NOT_FOUND error to prevent enumeration/IDOR.
 */
export async function requireParty(
  txOrDb: Tx | Db,
  contractId: string,
  user: SessionUser
): Promise<{
  contract: ContractRow
  partyRole: 'buyer' | 'seller' | 'admin'
}> {
  const contract = await getContractById(txOrDb, contractId)
  if (!contract) {
    throw new NotFoundError('Contract', { contractId })
  }

  if (user.role === 'admin') {
    return { contract, partyRole: 'admin' }
  }

  if (contract.buyer_id === user.sub) {
    return { contract, partyRole: 'buyer' }
  }

  if (contract.seller_id === user.sub) {
    return { contract, partyRole: 'seller' }
  }

  // Stranger receives 404 NOT_FOUND per security spec
  throw new NotFoundError('Contract', { contractId })
}

/**
 * Forbid automated AI agents from human-only actions (decision, cancel, refund).
 */
export function forbidAgent(user: SessionUser): void {
  if (user.is_agent) {
    throw new ForbiddenError('Action is forbidden for automated agents (human approval required)')
  }
}

/**
 * CSRF check: assert same origin on state-changing requests when authenticated via cookies.
 * API key requests are exempt.
 */
export function assertSameOrigin(req: Request | NextRequest): void {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer pp_k_')) {
    // API key calls are machine-to-machine and exempt from Origin check
    return
  }

  const origin = req.headers.get('origin') || req.headers.get('Origin')
  if (!origin) {
    // Non-browser or direct curl request
    return
  }

  const appBaseUrl = process.env['APP_BASE_URL'] || 'http://localhost:3000'
  try {
    const originHost = new URL(origin).host
    const appHost = new URL(appBaseUrl).host
    if (originHost !== appHost) {
      throw new ForbiddenError('Cross-origin request rejected')
    }
  } catch (err) {
    if (err instanceof ForbiddenError) throw err
  }
}
