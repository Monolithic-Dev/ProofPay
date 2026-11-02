/**
 * Time utilities with test-overridability and demo time-scaling.
 */

// ---------------------------------------------------------------------------
// Clock override for tests
// ---------------------------------------------------------------------------
let _nowOverride: Date | null = null

export function setNowForTests(d: Date | null) {
  _nowOverride = d
}

export function now(): Date {
  return _nowOverride ?? new Date()
}

// ---------------------------------------------------------------------------
// Date arithmetic
// ---------------------------------------------------------------------------
export function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

export function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 3_600_000)
}

export function addMs(d: Date, ms: number): Date {
  return new Date(d.getTime() + ms)
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** ISO 8601 with milliseconds: "2026-11-08T09:41:07.113Z" */
export function isoMs(d: Date): string {
  return d.toISOString()
}

// ---------------------------------------------------------------------------
// Demo time scaling
// ---------------------------------------------------------------------------

/**
 * Scale a real millisecond duration by DEMO_TIME_SCALE.
 * Returns at least 1000 ms to avoid micro-intervals.
 */
export function scaledMs(ms: number): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { env } = require('../config/env') as { env: { DEMO_TIME_SCALE: number } }
    const scaled = Math.round(ms / env.DEMO_TIME_SCALE)
    return Math.max(scaled, 1000)
  } catch {
    return Math.max(ms, 1000)
  }
}

/** Hours to scaled milliseconds */
export function hoursToScaledMs(hours: number): number {
  return scaledMs(hours * 3_600_000)
}
