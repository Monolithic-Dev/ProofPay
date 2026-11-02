/**
 * Session management using Jose JWTs stored in an HttpOnly cookie.
 */
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { UserRole } from '@/shared/types'

const COOKIE_NAME = 'pp_session'
const SESSION_DURATION_S = 60 * 60 * 24 * 7 // 7 days

export interface SessionPayload {
  sub: string      // user id
  email: string
  role: UserRole
  is_agent: boolean
  iat?: number
  exp?: number
}

function getSecret(): Uint8Array {
  const secret = process.env['SESSION_SECRET'] ?? ''
  return new TextEncoder().encode(secret)
}

export async function createSession(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  const secret = getSecret()
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_S}s`)
    .sign(secret)
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as SessionPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
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
  cookieStore.delete(COOKIE_NAME)
}
