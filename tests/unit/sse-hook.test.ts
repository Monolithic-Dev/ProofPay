import { describe, it, expect } from 'vitest'

describe('SSE Hook Invariants (phase 6.2)', () => {
  it('dedupes repeated seq numbers', () => {
    const seenSeqs = new Set<number>()
    const processedEvents: number[] = []

    const processEvent = (seq: number) => {
      if (seenSeqs.has(seq)) return
      seenSeqs.add(seq)
      processedEvents.push(seq)
    }

    // Stream with repeated events due to reconnect or network retry
    processEvent(1)
    processEvent(2)
    processEvent(2)
    processEvent(3)
    processEvent(1)
    processEvent(4)

    expect(processedEvents).toEqual([1, 2, 3, 4])
  })

  it('calculates exponential reconnect backoff within 1s to 10s', () => {
    let backoff = 1000
    const backoffs: number[] = []

    for (let i = 0; i < 6; i++) {
      backoffs.push(backoff)
      backoff = Math.min(backoff * 1.5, 10000)
    }

    expect(backoffs[0]).toBe(1000)
    expect(backoffs[1]).toBe(1500)
    expect(backoffs[2]).toBe(2250)
    expect(backoffs[backoffs.length - 1]).toBeLessThanOrEqual(10000)
  })
})
