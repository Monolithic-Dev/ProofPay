import { describe, it, expect } from 'vitest'
import { formatDuration, shortHash, relativeTime } from '@/lib/format'
import { formatMoney } from '@/components/common/Money'

describe('Formatting Utilities (phase 6.1)', () => {
  it('Money formats cents', () => {
    expect(formatMoney(6000)).toBe('$60.00')
    expect(formatMoney(100)).toBe('$1.00')
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(4050)).toBe('$40.50')
    expect(formatMoney(null)).toBe('$0.00')
  })

  it('formatDuration rounds down', () => {
    // 2 days and 4 hours = (2 * 24 + 4) * 3600 * 1000 = 187,200,000 ms
    expect(formatDuration(187200000)).toBe('2d 4h')
    // 3 hours and 15 mins = (3 * 60 + 15) * 60 * 1000 = 11,700,000 ms
    expect(formatDuration(11700000)).toBe('3h 15m')
    // 45 mins = 45 * 60 * 1000 = 2,700,000 ms
    expect(formatDuration(2700000)).toBe('45m')
    // 0 or negative
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(-500)).toBe('0m')
  })

  it('shortHash keeps first 8 chars', () => {
    const hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    expect(shortHash(hash)).toBe('e3b0c442')
    expect(shortHash(hash, 12)).toBe('e3b0c44298fc')
    expect(shortHash('')).toBe('')
    expect(shortHash(null)).toBe('')
  })

  it('relativeTime formats past and future timestamps', () => {
    const now = new Date()
    expect(relativeTime(now.toISOString())).toBe('just now')

    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)
    expect(relativeTime(fiveMinAgo.toISOString())).toBe('5m ago')

    const threeHoursAgo = new Date(now.getTime() - 3 * 3600 * 1000)
    expect(relativeTime(threeHoursAgo.toISOString())).toBe('3h ago')

    const twoDaysAgo = new Date(now.getTime() - 2 * 86400 * 1000)
    expect(relativeTime(twoDaysAgo.toISOString())).toBe('2d ago')
  })
})
