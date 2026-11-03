/**
 * Session management using Jose JWTs stored in an HttpOnly cookie.
 * Implements phase-3-auth-and-contracts.md §3.1.
 */
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { UserRole } from '@/shared/types'

export const COOKIE_NAME = 'pp_session'
export const SESSION_DURATION_S = 60 * 60 * 12 // 12 hours (43200 s)

export interface SessionPayload {
  sub: string // user id
  email: string
  role: UserRole
  is_agent: boolean
  org_id?: string
  org_role?: string
  iat?: number
  exp?: number
}

export type SessionUser = SessionPayload

function getSecret(): Uint8Array {
  const secret = process.env['SESSION_SECRET'] ?? 'default_session_secret_for_development_and_tests_min_32'
  return new TextEncoder().encode(secret)
}

/**
 * Sign a session JWT for a user.
 */
export async function signSession(user: {
  id?: string
  sub?: string
  role: UserRole
  is_agent: boolean
  email?: string
  org_id?: string
  org_role?: string
}): Promise<string> {
  const secret = getSecret()
  const userId = user.id ?? user.sub ?? ''
  return new SignJWT({
    sub: userId,
    email: user.email ?? '',
    role: user.role,
    is_agent: user.is_agent,
    org_id: user.org_id,
    org_role: user.org_role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('proofpay')
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_S}s`)
    .sign(secret)
}

export const createSession = signSession
export const createSessionToken = signSession

/**
 * Read and verify a session token from a cookie string or Request.
 */
export async function readSession(
  input: string | Request | null | undefined
): Promise<SessionUser | null> {
  if (!input) return null

  let token = ''
  if (typeof input === 'string') {
    if (input.includes(`${COOKIE_NAME}=`)) {
      const match = input.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
      token = match ? (match[1] ?? '') : ''
    } else {
      token = input
    }
  } else if ('headers' in input) {
    const cookieHeader = input.headers.get('cookie') ?? ''
    const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
    token = match ? (match[1] ?? '') : ''
  }

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: 'proofpay',
    })
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

export const verifySession = readSession

/**
 * Get session in Next.js Server Components / Route Handlers using next/headers.
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    return readSession(token)
  } catch {
    return null
  }
}

/**
 * Build the Set-Cookie string.
 */
export function sessionCookie(token: string): string {
  const isProd = process.env['NODE_ENV'] === 'production'
  const secureFlag = isProd ? '; Secure' : ''
  return `${COOKIE_NAME}=${token}; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=${SESSION_DURATION_S}`
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_S,
    path: '/',
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}
