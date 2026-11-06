import { NextResponse } from 'next/server'
import { calculateSecurityPosture } from '@/shared/security'

export async function GET() {
  try {
    const posture = calculateSecurityPosture({
      mfaPrivilegedTotal: 2,
      mfaPrivilegedEnrolled: 2,
      apiKeysTotal: 3,
      apiKeysOlder90d: 0,
      apiKeysWithoutExpiry: 0,
      apiKeysWithoutAllowlist: 0,
      staleSessions30d: 0,
      pendingInvitesOlder14d: 0,
      unverifiedMembers: 0,
      riskEventsCount: 0,
      stepUpEnforced: true,
    })

    return NextResponse.json(posture, {
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve security posture' },
      { status: 500 }
    )
  }
}
