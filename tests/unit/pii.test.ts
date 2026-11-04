import { describe, it, expect } from 'vitest'
import { maskPii } from '@/lib/pii'

describe('PII Shield (maskPii)', () => {
  it('masks emails, phones, IPs, SSNs, and credit cards', () => {
    const raw =
      'Contact alice@example.com or call 555-123-4567. IP is 192.168.1.1. Card: 4111 2222 3333 4444. SSN: 123-45-6789.'
    const result = maskPii(raw)

    expect(result.redactionCount).toBe(5)
    expect(result.redactionsByType.email).toBe(1)
    expect(result.redactionsByType.phone).toBe(1)
    expect(result.redactionsByType.ip).toBe(1)
    expect(result.redactionsByType.card).toBe(1)
    expect(result.redactionsByType.ssn).toBe(1)

    expect(result.maskedText).not.toContain('alice@example.com')
    expect(result.maskedText).not.toContain('555-123-4567')
    expect(result.maskedText).not.toContain('192.168.1.1')
    expect(result.maskedText).not.toContain('4111 2222 3333 4444')
    expect(result.maskedText).not.toContain('123-45-6789')

    // Unmask restoration
    const restored = result.unmask(result.maskedText)
    expect(restored).toBe(raw)
  })

  it('handles clean text without modifications', () => {
    const clean = 'This deliverable contains market research data for Q4 with 25 product lines.'
    const result = maskPii(clean)
    expect(result.redactionCount).toBe(0)
    expect(result.maskedText).toBe(clean)
  })
})

