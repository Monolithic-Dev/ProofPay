/**
 * Unit tests for Chaos Harness helpers.
 * Implements phase-8-testing-and-hardening.md §8.3.
 */
import { describe, it, expect, vi } from 'vitest'
import { waitFor } from '../chaos/harness'

describe('PayPal Chaos Harness Unit Tests (§8.3)', () => {
  it('waitFor resolves as soon as condition becomes truthy', async () => {
    let attempts = 0
    const condition = vi.fn().mockImplementation(async () => {
      attempts++
      return attempts >= 3 ? 'success' : null
    })

    const result = await waitFor(condition, { intervalMs: 10, timeoutMs: 500, label: 'condition' })
    expect(result).toBe('success')
    expect(attempts).toBe(3)
  })

  it('waitFor times out with a helpful error when condition never succeeds', async () => {
    const neverCondition = vi.fn().mockResolvedValue(null)

    await expect(
      waitFor(neverCondition, { intervalMs: 20, timeoutMs: 80, label: 'sample_check' })
    ).rejects.toThrow('Timeout waiting for sample_check after 80ms')
  })
})
