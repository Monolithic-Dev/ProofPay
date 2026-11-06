import { NextResponse } from 'next/server'
import type { RiskEvent } from '@/shared/security'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const cursor = url.searchParams.get('cursor')

    // Return empty list until PLAT-8 risk engine rule evaluation is deployed
    const events: RiskEvent[] = []

    return NextResponse.json({
      events,
      next_cursor: null,
      total: 0,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve risk events' },
      { status: 500 }
    )
  }
}

