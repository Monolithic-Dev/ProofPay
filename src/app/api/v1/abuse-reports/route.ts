import { NextResponse } from 'next/server'
import { addEmailSuppression } from '@/server/security/email-abuse'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, reason } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    // Add email to suppression list
    addEmailSuppression(email)

    console.info(`[AbuseReport] Email suppressed: reason="${reason || 'unsolicited'}"`)

    return NextResponse.json({
      success: true,
      message: 'Email address has been suppressed from future outbound invitations.',
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to record abuse report' }, { status: 500 })
  }
}

