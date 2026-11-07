/**
 * Unit Tests: Automated 1099-K & W-9 Tax Compliance Engine
 */
import { describe, it, expect } from 'vitest'
import {
  evaluateTaxCompliance,
  validateTinFormat,
  maskTin,
  FEDERAL_1099K_THRESHOLD_USD,
  BACKUP_WITHHOLDING_RATE_PERCENT,
} from '@/server/tax/compliance'

describe('Automated 1099-K & W-9 Tax Compliance', () => {
  describe('evaluateTaxCompliance', () => {
    it('marks low volume seller as non-reportable with no W-9 requirement', () => {
      const summary = evaluateTaxCompliance({
        sellerId: 's-1',
        taxYear: 2026,
        grossVolumeMinor: 150000, // $1,500.00
        transactionCount: 2,
        w9OnFile: false,
        tinVerified: false,
      })

      expect(summary.grossVolumeUsd).toBe(1500)
      expect(summary.isReportable1099K).toBe(false)
      expect(summary.w9Required).toBe(false)
      expect(summary.backupWithholdingRequired).toBe(false)
      expect(summary.withholdingRatePercent).toBe(0)
    })

    it('requires W-9 when seller reaches 80% warning threshold ($4,000)', () => {
      const summary = evaluateTaxCompliance({
        sellerId: 's-2',
        taxYear: 2026,
        grossVolumeMinor: 410000, // $4,100.00 (> 80% of $5,000)
        transactionCount: 5,
        w9OnFile: false,
        tinVerified: false,
      })

      expect(summary.isReportable1099K).toBe(false)
      expect(summary.w9Required).toBe(true)
      expect(summary.backupWithholdingRequired).toBe(true)
      expect(summary.withholdingRatePercent).toBe(BACKUP_WITHHOLDING_RATE_PERCENT)
    })

    it('marks seller exceeding federal threshold ($5,000) as reportable 1099-K', () => {
      const summary = evaluateTaxCompliance({
        sellerId: 's-3',
        taxYear: 2026,
        grossVolumeMinor: 520000, // $5,200.00
        transactionCount: 10,
        w9OnFile: true,
        tinVerified: true,
      })

      expect(summary.isReportable1099K).toBe(true)
      expect(summary.w9Required).toBe(true)
      expect(summary.backupWithholdingRequired).toBe(false)
      expect(summary.withholdingRatePercent).toBe(0)
    })

    it('applies state-specific lower threshold (e.g. Massachusetts $600)', () => {
      const summary = evaluateTaxCompliance({
        sellerId: 's-4',
        taxYear: 2026,
        grossVolumeMinor: 75000, // $750.00
        transactionCount: 3,
        w9OnFile: false,
        tinVerified: false,
        sellerStateCode: 'MA',
      })

      expect(summary.grossVolumeUsd).toBe(750)
      expect(summary.isReportable1099K).toBe(true)
      expect(summary.w9Required).toBe(true)
      expect(summary.backupWithholdingRequired).toBe(true)
    })
  })

  describe('validateTinFormat', () => {
    it('accepts valid 9-digit SSN and EIN formats', () => {
      expect(validateTinFormat('12-3456788')).toBe(true)
      expect(validateTinFormat('987-65-4320')).toBe(true)
      expect(validateTinFormat('123456788')).toBe(true)
    })

    it('rejects invalid or dummy numbers', () => {
      expect(validateTinFormat('123456789')).toBe(false)
      expect(validateTinFormat('111111111')).toBe(false)
      expect(validateTinFormat('000000000')).toBe(false)
      expect(validateTinFormat('short')).toBe(false)
      expect(validateTinFormat('')).toBe(false)
    })
  })

  describe('maskTin', () => {
    it('masks full TIN displaying only the last 4 digits', () => {
      expect(maskTin('12-3456789')).toBe('***-**-6789')
      expect(maskTin('987654321')).toBe('***-**-4321')
    })

    it('returns placeholder on invalid length', () => {
      expect(maskTin('123')).toBe('***-**-****')
    })
  })
})

