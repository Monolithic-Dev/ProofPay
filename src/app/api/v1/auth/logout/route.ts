/**
 * Logout — POST /api/v1/auth/logout
 */
import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/server/auth/session'
import { newRequestId } from '@/server/util/ids'

export async function POST() {
  const requestId = newRequestId()
  await clearSessionCookie()
  return NextResponse.json({ ok: true }, { headers: { 'X-Request-Id': requestId } })
}
