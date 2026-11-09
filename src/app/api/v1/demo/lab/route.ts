import { NextResponse } from 'next/server'
import { getResilienceLabState, triggerSimulatedFault } from '@/server/demo/resilience-lab'

export async function GET() {
  const state = getResilienceLabState()
  return NextResponse.json(state)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { faultId } = body

    if (!faultId) {
      return NextResponse.json({ error: 'Missing faultId parameter' }, { status: 400 })
    }

    const result = triggerSimulatedFault(faultId)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Fault injection failed' }, { status: 500 })
  }
}

