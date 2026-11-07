/**
 * Automated 1099-K & W-9 Tax Compliance Engine.
 * Enterprise Pillar 1 & 4 — Legal Compliance & Financial Defense.
 *
 * Implements IRS Form 1099-K reporting rules:
 *   - Tracks annual cumulative gross payment volume across milestone releases.
 *   - Calculates statutory reporting threshold:
 *       • Federal: $5,000 gross volume (IRS transitional phase-in threshold)
 *       • Traditional: $20,000 gross volume AND 200+ transactions
 *       • State-specific low thresholds (e.g. MA, VT, VA, MD: $600)
 *   - Issues W-9 collection requirements when reaching 80% of threshold.
 *   - Flags backup withholding (24%) requirements if W-9 TIN is missing.
 */

export interface TaxYearSummary {
  sellerId: string
  taxYear: number
  grossVolumeMinor: number
  grossVolumeUsd: number
  transactionCount: number
  w9OnFile: boolean
  tinVerified: boolean
  isReportable1099K: boolean
  w9Required: boolean
  backupWithholdingRequired: boolean
  withholdingRatePercent: number
}

export interface StateThreshold {
  stateCode: string
  grossThresholdUsd: number
  transactionCountThreshold?: number
}

// State thresholds with lower requirements than federal
export const STATE_1099K_THRESHOLDS: Record<string, StateThreshold> = {
  MA: { stateCode: 'MA', grossThresholdUsd: 600 },
  VT: { stateCode: 'VT', grossThresholdUsd: 600 },
  VA: { stateCode: 'VA', grossThresholdUsd: 600 },
  MD: { stateCode: 'MD', grossThresholdUsd: 600 },
  IL: { stateCode: 'IL', grossThresholdUsd: 1000, transactionCountThreshold: 4 },
}

export const FEDERAL_1099K_THRESHOLD_USD = 5000 // IRS phase-in threshold
export const W9_WARNING_PERCENT = 0.8 // 80% of threshold triggers W-9 prompt
export const BACKUP_WITHHOLDING_RATE_PERCENT = 24 // 24% IRS statutory backup withholding

export interface EvaluateTaxComplianceOptions {
  sellerId: string
  taxYear: number
  grossVolumeMinor: number
  transactionCount: number
  w9OnFile: boolean
  tinVerified: boolean
  sellerStateCode?: string
}

/**
 * Evaluates whether a contractor/seller meets 1099-K filing requirements or requires W-9 collection.
 */
export function evaluateTaxCompliance(options: EvaluateTaxComplianceOptions): TaxYearSummary {
  const grossVolumeUsd = options.grossVolumeMinor / 100
  const stateCode = options.sellerStateCode?.toUpperCase()

  // Determine applicable threshold (State or Federal)
  const stateConfig = stateCode ? STATE_1099K_THRESHOLDS[stateCode] : undefined
  const thresholdUsd = stateConfig ? stateConfig.grossThresholdUsd : FEDERAL_1099K_THRESHOLD_USD
  const requiredTransactions = stateConfig?.transactionCountThreshold ?? 0

  const meetsVolume = grossVolumeUsd >= thresholdUsd
  const meetsCount = requiredTransactions === 0 || options.transactionCount >= requiredTransactions

  const isReportable1099K = meetsVolume && meetsCount
  const w9Required = (grossVolumeUsd >= thresholdUsd * W9_WARNING_PERCENT) || isReportable1099K

  // Backup withholding applies if reportable or W-9 required, but valid TIN is not on file
  const backupWithholdingRequired = w9Required && (!options.w9OnFile || !options.tinVerified)

  return {
    sellerId: options.sellerId,
    taxYear: options.taxYear,
    grossVolumeMinor: options.grossVolumeMinor,
    grossVolumeUsd,
    transactionCount: options.transactionCount,
    w9OnFile: options.w9OnFile,
    tinVerified: options.tinVerified,
    isReportable1099K,
    w9Required,
    backupWithholdingRequired,
    withholdingRatePercent: backupWithholdingRequired ? BACKUP_WITHHOLDING_RATE_PERCENT : 0,
  }
}

/**
 * Validates US Employer Identification Number (EIN) or Social Security Number (SSN) format.
 * Accepts:
 *   - SSN: XXX-XX-XXXX or 9 digits
 *   - EIN: XX-XXXXXXX or 9 digits
 */
export function validateTinFormat(tin: string): boolean {
  if (!tin || typeof tin !== 'string') return false
  const clean = tin.trim().replace(/[-\s]/g, '')
  if (!/^\d{9}$/.test(clean)) return false

  // Reject obvious invalid / dummy numbers (e.g. 000000000, 123456789, repeated digits)
  if (/^(\d)\1{8}$/.test(clean)) return false
  if (clean === '123456789' || clean === '987654321') return false

  return true
}

/**
 * Masks TIN for safe storage and display (e.g. "XXX-XX-1234" or "XX-XXX1234")
 */
export function maskTin(tin: string): string {
  const clean = tin.trim().replace(/[-\s]/g, '')
  if (clean.length !== 9) return '***-**-****'
  return `***-**-${clean.slice(-4)}`
}

