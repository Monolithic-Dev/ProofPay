import { describe, it, expect } from 'vitest'
import { DEMO_PERSONAS } from '@/../scripts/seed'

describe('Demo Persona Seeding', () => {
  it('defines exactly five demo personas', () => {
    expect(DEMO_PERSONAS).toHaveLength(5)
  })

  it('all personas have unique emails and persona keys', () => {
    const emails = DEMO_PERSONAS.map((p) => p.email)
    const personaKeys = DEMO_PERSONAS.map((p) => p.personaKey)

    expect(new Set(emails).size).toBe(5)
    expect(new Set(personaKeys).size).toBe(5)
  })

  it('includes required buyer, seller, agent, and admin personas', () => {
    const keys = DEMO_PERSONAS.map((p) => p.personaKey)
    expect(keys).toContain('buyer')
    expect(keys).toContain('seller')
    expect(keys).toContain('buyer_agent')
    expect(keys).toContain('worker_agent')
    expect(keys).toContain('admin')
  })
})
