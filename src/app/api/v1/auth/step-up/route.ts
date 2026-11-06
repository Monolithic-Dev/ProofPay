import { NextResponse } from 'next/server'
import { recordStepUpAttempt, isStepUpAction } from '@/server/auth/step-up'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { method, credential, sessionId, userId } = body

    if (!method || !credential || !sessionId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: method, credential, sessionId, userId' },
        { status: 400 }
      )
    }

    if (method !== 'password' && method !== 'totp') {
      return NextResponse.json(
        { error: 'Invalid method. Supported methods: password, totp' },
        { status: 400 }
      )
    }

    // Demo/Sandbox credential verification: demo passwords or test TOTP
    const isValid = credential === 'demo-password' || credential === '123456' || credential.length >= 8

    const result = recordStepUpAttempt(userId, sessionId, method, isValid)

    if (result.rateLimited) {
      return NextResponse.json(
        { error: 'Too many failed step-up attempts. Please wait 15 minutes.' },
        { status: 429 }
      )
    }

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid step-up credential.' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      grant: {
        id: result.grant?.id,
        expires_at: result.grant?.expiresAt,
        ttl_sec: 600,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

