import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { now, setNowForTests, addDays, addHours, isoMs, scaledMs } from '@/server/util/time'

describe('Time utilities', () => {
  beforeEach(() => {
    setNowForTests(null)
  })

  afterEach(() => {
    setNowForTests(null)
  })

  it('clock override works in tests', () => {
    const fixedDate = new Date('2026-11-03T10:00:00.000Z')
    setNowForTests(fixedDate)
    expect(now().toISOString()).toBe('2026-11-03T10:00:00.000Z')
  })

  it('isoMs produces ISO 8601 with millisecond precision', () => {
    const d = new Date('2026-11-08T09:41:07.113Z')
    expect(isoMs(d)).toBe('2026-11-08T09:41:07.113Z')
  })

  it('addDays correctly advances dates', () => {
    const base = new Date('2026-11-01T00:00:00.000Z')
    const next = addDays(base, 3)
    expect(next.getUTCDate()).toBe(4)
  })

  it('addHours correctly advances hours', () => {
    const base = new Date('2026-11-01T12:00:00.000Z')
    const next = addHours(base, 5)
    expect(next.toISOString()).toBe('2026-11-01T17:00:00.000Z')
  })

  it('scaledMs never drops below 1000ms floor', () => {
    expect(scaledMs(200)).toBe(1000)
    expect(scaledMs(50)).toBe(1000)
    expect(scaledMs(0)).toBe(1000)
  })

  it('scaledMs preserves scaled values above floor', () => {
    // default DEMO_TIME_SCALE is 1
    expect(scaledMs(5000)).toBe(5000)
  })
})
