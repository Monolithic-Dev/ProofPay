import { NextResponse } from 'next/server'
import { env } from '@/server/config/env'
import { getResilienceLabState, triggerSimulatedFault } from '@/server/demo/resilience-lab'

export async function GET() {
  if (!env.DEMO_MODE) {
    return NextResponse.json(
      { error: { code: 'DEMO_MODE_DISABLED', message: 'Resilience lab requires DEMO_MODE' } },
      { status: 404 }
    )
  }

  const state = getResilienceLabState()
  return NextResponse.json(state)
}

export async function POST(req: Request) {
  if (!env.DEMO_MODE) {
    return NextResponse.json(
      { error: { code: 'DEMO_MODE_DISABLED', message: 'Resilience lab requires DEMO_MODE' } },
      { status: 404 }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const faultId = typeof body?.faultId === 'string' ? body.faultId : ''

    if (!faultId) {
      return NextResponse.json({ error: 'Missing faultId parameter' }, { status: 400 })
    }

    const result = triggerSimulatedFault(faultId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fault injection failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
