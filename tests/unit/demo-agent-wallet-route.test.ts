import { describe, it, expect } from 'vitest'
import { GET, POST } from '@/app/api/v1/demo/agent-wallet/route'
import { NextRequest } from 'next/server'

describe('Demo Agent Wallet Guardrail API Route (/api/v1/demo/agent-wallet)', () => {
  it('GET returns default session, PayPal hold ID, and guardrail rules', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/demo/agent-wallet')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.status).toBe('ready')
    expect(data.session).toBeDefined()
    expect(data.session.paypalAuthorizationId).toBe('AUTH-991823746')
    expect(data.session.totalAuthorizedMinor).toBe(5000)
    expect(data.session.tasks).toHaveLength(3)
    expect(data.guardrail_rules).toHaveLength(4)
  })

  it('POST approves compliant task and emits PayPal capture ID', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/demo/agent-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: 'task-1',
        maxMilestoneMinor: 1500,
        minVerificationScore: 90,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.passed).toBe(true)
    expect(data.status).toBe('APPROVED_CAPTURED')
    expect(data.paypalAction).toBe('CAPTURE_EXECUTED')
    expect(data.paypalCaptureId).toContain('CAP-')
    expect(data.violations).toHaveLength(0)
  })

  it('POST blocks task exceeding milestone spend policy cap', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/demo/agent-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: 'task-3', // Requests $45.00
        maxMilestoneMinor: 1500, // Cap is $15.00
        minVerificationScore: 90,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.passed).toBe(false)
    expect(data.status).toBe('BLOCKED_POLICY_VIOLATION')
    expect(data.paypalAction).toBe('CAPTURE_PROHIBITED_HOLD_PRESERVED')
    expect(data.paypalCaptureId).toBeNull()
    expect(data.violations.some((v: string) => v.includes('exceeds max milestone cap'))).toBe(true)
    expect(data.violations.some((v: string) => v.includes('adversarial prompt injection'))).toBe(true)
  })

  it('POST returns 404 for unknown task ID', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/demo/agent-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: 'non_existent_task',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(404)
  })
})

