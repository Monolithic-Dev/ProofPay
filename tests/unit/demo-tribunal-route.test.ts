import { describe, it, expect } from 'vitest'
import { GET, POST, SCENARIOS } from '@/app/api/v1/demo/tribunal/route'
import { NextRequest } from 'next/server'

describe('Demo AI Dispute Tribunal API Route (/api/v1/demo/tribunal)', () => {
  it('GET returns tribunal scenarios and governance metadata', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/demo/tribunal')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.status).toBe('ready')
    expect(data.feature).toBe('Multi-Agent AI Dispute Tribunal')
    expect(data.scenarios).toHaveLength(2)

    const scenarioIds = data.scenarios.map((s: { id: string }) => s.id)
    expect(scenarioIds).toContain('ambiguous_dataset')
    expect(scenarioIds).toContain('hallucinated_code')
  })

  it('POST returns full multi-agent debate and binding PayPal verdict for ambiguous dataset', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/demo/tribunal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'ambiguous_dataset' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.status).toBe('success')
    expect(data.scenario.id).toBe('ambiguous_dataset')
    expect(data.scenario.turns).toHaveLength(3)

    // Check binding verdict
    const verdict = data.scenario.verdict
    expect(verdict.paypalAction).toBe('PARTIAL_CAPTURE_AND_VOID')
    expect(verdict.sellerCapturePercent).toBe(75)
    expect(verdict.sellerCaptureMinor).toBe(1500)
    expect(verdict.buyerVoidMinor).toBe(500)
    expect(verdict.paypalPayload.method).toContain('capture')
  })

  it('POST returns full void binding verdict for hallucinated code deliverable', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/demo/tribunal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'hallucinated_code' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.scenario.id).toBe('hallucinated_code')

    const verdict = data.scenario.verdict
    expect(verdict.paypalAction).toBe('FULL_VOID')
    expect(verdict.sellerCapturePercent).toBe(0)
    expect(verdict.buyerVoidMinor).toBe(3500)
    expect(verdict.paypalPayload.method).toContain('void')
  })
})

