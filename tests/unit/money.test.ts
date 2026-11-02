/**
 * Unit tests for PayPal money utilities.
 * Implements phase-5-paypal-funding-and-release.md §5.1.
 */
import { describe, it, expect } from 'vitest'
import { toPayPalValue, fromPayPalValue, formatUsd, MAX_MINOR_UNITS } from '@/server/paypal/money'

describe('PayPal Money Utilities (Task 5.1)', () => {
  it('converts minor units to PayPal decimal string correctly (6000 -> "60.00")', () => {
    expect(toPayPalValue(6000)).toBe('60.00')
  })

  it('converts small amounts correctly (5 -> "0.05")', () => {
    expect(toPayPalValue(5)).toBe('0.05')
    expect(toPayPalValue(1)).toBe('0.01')
    expect(toPayPalValue(99)).toBe('0.99')
    expect(toPayPalValue(100)).toBe('1.00')
  })

  it('rejects 0 and negative amounts', () => {
    expect(() => toPayPalValue(0)).toThrow(/strictly positive/)
    expect(() => toPayPalValue(-100)).toThrow(/strictly positive/)
  })

  it('rejects non-integer minor amounts', () => {
    expect(() => toPayPalValue(1.5)).toThrow(/must be an integer/)
    expect(() => toPayPalValue(100.01)).toThrow(/must be an integer/)
    expect(() => toPayPalValue(NaN)).toThrow(/must be an integer/)
  })

  it('rejects amounts exceeding 5,000,000 minor units', () => {
    expect(() => toPayPalValue(MAX_MINOR_UNITS + 1)).toThrow(/exceeds maximum allowed limit/)
    expect(toPayPalValue(MAX_MINOR_UNITS)).toBe('50000.00')
  })

  it('parses valid decimal string to minor units ("60.00" -> 6000)', () => {
    expect(fromPayPalValue('60.00')).toBe(6000)
    expect(fromPayPalValue('0.05')).toBe(5)
    expect(fromPayPalValue('100.50')).toBe(10050)
  })

  it('rejects invalid decimal strings like "60.0" or letters', () => {
    expect(() => fromPayPalValue('60.0')).toThrow(/Cannot parse/)
    expect(() => fromPayPalValue('60')).toThrow(/Cannot parse/)
    expect(() => fromPayPalValue('60.000')).toThrow(/Cannot parse/)
    expect(() => fromPayPalValue('abc')).toThrow(/Cannot parse/)
    expect(() => fromPayPalValue('0.00')).toThrow(/outside valid bounds/)
    expect(() => fromPayPalValue('-10.00')).toThrow(/Cannot parse/)
  })

  it('round-trips 1..10000 minor units losslessly', () => {
    for (let minor = 1; minor <= 10000; minor += 17) {
      const str = toPayPalValue(minor)
      const parsed = fromPayPalValue(str)
      expect(parsed).toBe(minor)
    }
  })

  it('formats display strings properly', () => {
    expect(formatUsd(6000)).toBe('$60.00')
    expect(formatUsd(5)).toBe('$0.05')
    expect(formatUsd(0)).toBe('$0.00')
  })
})
