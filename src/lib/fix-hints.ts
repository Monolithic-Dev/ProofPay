/**
 * Actionable Counterfactual Fix Hints Generator.
 * Implements docs/v2/01-NEW-FEATURES-SECURITY-AI-PRODUCT.md A5 & PROOFPAY-FULL-AUDIT-AND-IMPROVEMENTS.md AIP-2.
 *
 * Computes exact, minimal changes necessary to turn a failed criterion into a passing one.
 */

export interface FixHint {
  criterion_key: string
  action: string
  minimal_delta: string
  target_field?: string
}

export function computeFixHint(criterion: {
  criterion_key: string
  check?: string
  check_name?: string
  observed: unknown
  expected: unknown
  message?: string
}): FixHint | null {
  const checkName = criterion.check || criterion.check_name || ''
  const key = criterion.criterion_key

  // 1. Row count hints
  if (checkName === 'row_count') {
    const obs = typeof criterion.observed === 'number' ? criterion.observed : 0
    const exp = typeof criterion.expected === 'number' ? criterion.expected : null

    if (exp !== null) {
      if (obs < exp) {
        const diff = exp - obs
        return {
          criterion_key: key,
          action: `Add ${diff} row${diff > 1 ? 's' : ''}`,
          minimal_delta: `Current: ${obs} rows; target: >= ${exp} rows (deficit: ${diff}).`,
        }
      } else if (obs > exp) {
        const diff = obs - exp
        return {
          criterion_key: key,
          action: `Remove ${diff} row${diff > 1 ? 's' : ''}`,
          minimal_delta: `Current: ${obs} rows; target: <= ${exp} rows (excess: ${diff}).`,
        }
      }
    }
  }

  // 2. Word count hints
  if (checkName === 'word_count') {
    const obs = typeof criterion.observed === 'number' ? criterion.observed : 0
    const exp = criterion.expected as { min?: number; max?: number } | number | null

    if (typeof exp === 'number') {
      if (obs < exp) {
        const diff = exp - obs
        return {
          criterion_key: key,
          action: `Add ${diff} word${diff > 1 ? 's' : ''}`,
          minimal_delta: `Current: ${obs} words; required: >= ${exp} words.`,
        }
      }
    } else if (exp && typeof exp === 'object') {
      if (exp.min !== undefined && obs < exp.min) {
        const diff = exp.min - obs
        return {
          criterion_key: key,
          action: `Expand text by ${diff} word${diff > 1 ? 's' : ''}`,
          minimal_delta: `Current: ${obs} words; minimum required: ${exp.min}.`,
        }
      }
      if (exp.max !== undefined && obs > exp.max) {
        const diff = obs - exp.max
        return {
          criterion_key: key,
          action: `Trim text by ${diff} word${diff > 1 ? 's' : ''}`,
          minimal_delta: `Current: ${obs} words; maximum allowed: ${exp.max}.`,
        }
      }
    }
  }

  // 3. CSV schema hints
  if (checkName === 'csv_schema') {
    if (criterion.message && criterion.message.includes('Missing required CSV headers:')) {
      const match = criterion.message.match(/Missing required CSV headers:\s*([^.]+)/)
      if (match && match[1]) {
        return {
          criterion_key: key,
          action: `Add missing header columns: ${match[1].trim()}`,
          minimal_delta: `CSV header row must include [${match[1].trim()}].`,
        }
      }
    }
  }

  // 4. Forbidden terms hints
  if (checkName === 'forbidden_terms') {
    if (Array.isArray(criterion.observed) && criterion.observed.length > 0) {
      return {
        criterion_key: key,
        action: `Remove forbidden term(s): ${criterion.observed.join(', ')}`,
        minimal_delta: `Deliverable content contains unapproved phrases.`,
      }
    }
  }

  // Default fallback hint
  if (criterion.message) {
    return {
      criterion_key: key,
      action: 'Revise deliverable per specification',
      minimal_delta: criterion.message,
    }
  }

  return null
}
