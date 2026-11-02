/**
 * Deterministic check registry — Stage 1 of verification pipeline.
 * All checks are pure functions: (artifact, spec) → {passed, reason}.
 */
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { readFileSync } from 'fs'
import { join } from 'path'

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)

// ---------------------------------------------------------------------------
// Named patterns (ReDoS-safe)
// ---------------------------------------------------------------------------
const NAMED_PATTERNS: Record<string, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  url: /^https?:\/\/[^\s]+$/,
  sku: /^[A-Z]{3}-\d{4}$/,
}

// ---------------------------------------------------------------------------
// Check result type
// ---------------------------------------------------------------------------
export interface CheckResult {
  passed: boolean
  reason: string
}

// ---------------------------------------------------------------------------
// json_schema check
// ---------------------------------------------------------------------------
export function checkJsonSchema(
  content: string,
  spec: { schema_ref: string }
): CheckResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return { passed: false, reason: 'Content is not valid JSON' }
  }

  // Load schema from disk
  let schema: unknown
  try {
    const schemaPath = join(process.cwd(), 'src/server/verify/schemas', `${spec.schema_ref}.json`)
    schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
  } catch {
    return { passed: false, reason: `Schema '${spec.schema_ref}' not found` }
  }

  const validate = ajv.compile(schema as object)
  const valid = validate(parsed)
  if (!valid) {
    const errors = validate.errors?.slice(0, 3).map((e) => `${e.instancePath} ${e.message}`).join('; ')
    return { passed: false, reason: `Schema validation failed: ${errors}` }
  }
  return { passed: true, reason: 'Schema validation passed' }
}

// ---------------------------------------------------------------------------
// row_count check
// ---------------------------------------------------------------------------
export function checkRowCount(
  content: string,
  spec: { min?: number; max?: number }
): CheckResult {
  let parsed: unknown[]
  try {
    parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) throw new Error()
  } catch {
    return { passed: false, reason: 'Content is not a JSON array' }
  }

  const count = parsed.length
  if (spec.min !== undefined && count < spec.min) {
    return { passed: false, reason: `Expected ≥ ${spec.min} records, found ${count}.` }
  }
  if (spec.max !== undefined && count > spec.max) {
    return { passed: false, reason: `Expected ≤ ${spec.max} records, found ${count}.` }
  }
  return { passed: true, reason: `Row count ${count} is within bounds.` }
}

// ---------------------------------------------------------------------------
// unique_field check
// ---------------------------------------------------------------------------
export function checkUniqueField(
  content: string,
  spec: { field: string }
): CheckResult {
  let parsed: unknown[]
  try {
    parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) throw new Error()
  } catch {
    return { passed: false, reason: 'Content is not a JSON array' }
  }

  const values = parsed.map((row) => (row as Record<string, unknown>)[spec.field])
  const nonNull = values.filter((v) => v !== undefined && v !== null)
  const unique = new Set(nonNull.map(String))

  if (unique.size !== nonNull.length) {
    return { passed: false, reason: `Field '${spec.field}' has duplicate values.` }
  }
  return { passed: true, reason: `All '${spec.field}' values are unique.` }
}

// ---------------------------------------------------------------------------
// regex_field check
// ---------------------------------------------------------------------------
export function checkRegexField(
  content: string,
  spec: { field: string; pattern: 'email' | 'url' | 'sku' }
): CheckResult {
  let parsed: unknown[]
  try {
    parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) throw new Error()
  } catch {
    return { passed: false, reason: 'Content is not a JSON array' }
  }

  const regex = NAMED_PATTERNS[spec.pattern]
  if (!regex) return { passed: false, reason: `Unknown pattern '${spec.pattern}'` }

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i] as Record<string, unknown>
    const val = String(row[spec.field] ?? '')
    if (!regex.test(val)) {
      return {
        passed: false,
        reason: `Row ${i + 1}: ${spec.field} '${val.slice(0, 60)}' does not match ${spec.pattern} pattern.`,
      }
    }
  }
  return { passed: true, reason: `All '${spec.field}' values match ${spec.pattern} pattern.` }
}

// ---------------------------------------------------------------------------
// word_count check
// ---------------------------------------------------------------------------
export function checkWordCount(
  content: string,
  spec: { min?: number; max?: number }
): CheckResult {
  const count = content.trim().split(/\s+/).filter(Boolean).length
  if (spec.min !== undefined && count < spec.min) {
    return { passed: false, reason: `Expected ≥ ${spec.min} words, found ${count}.` }
  }
  if (spec.max !== undefined && count > spec.max) {
    return { passed: false, reason: `Expected ≤ ${spec.max} words, found ${count}.` }
  }
  return { passed: true, reason: `Word count ${count} is within bounds.` }
}

// ---------------------------------------------------------------------------
// required_keywords check
// ---------------------------------------------------------------------------
export function checkRequiredKeywords(
  content: string,
  spec: { keywords: string[]; mode: 'all' | 'any'; case_sensitive?: boolean }
): CheckResult {
  const haystack = spec.case_sensitive ? content : content.toLowerCase()
  const keywords = spec.case_sensitive
    ? spec.keywords
    : spec.keywords.map((k) => k.toLowerCase())

  if (spec.mode === 'all') {
    const missing = keywords.filter((k) => !haystack.includes(k))
    if (missing.length > 0) {
      return { passed: false, reason: `Missing required keywords: ${missing.slice(0, 5).join(', ')}` }
    }
    return { passed: true, reason: 'All required keywords found.' }
  } else {
    const found = keywords.filter((k) => haystack.includes(k))
    if (found.length === 0) {
      return { passed: false, reason: `None of the required keywords found: ${keywords.slice(0, 5).join(', ')}` }
    }
    return { passed: true, reason: `Found keyword(s): ${found.slice(0, 3).join(', ')}` }
  }
}

// ---------------------------------------------------------------------------
// Registry dispatcher
// ---------------------------------------------------------------------------
export function runDeterministicCheck(
  checkName: string,
  content: string,
  spec: Record<string, unknown>
): CheckResult {
  switch (checkName) {
    case 'json_schema':
      return checkJsonSchema(content, spec as { schema_ref: string })
    case 'row_count':
      return checkRowCount(content, spec as { min?: number; max?: number })
    case 'unique_field':
      return checkUniqueField(content, spec as { field: string })
    case 'regex_field':
      return checkRegexField(content, spec as { field: string; pattern: 'email' | 'url' | 'sku' })
    case 'word_count':
      return checkWordCount(content, spec as { min?: number; max?: number })
    case 'required_keywords':
      return checkRequiredKeywords(
        content,
        spec as { keywords: string[]; mode: 'all' | 'any'; case_sensitive?: boolean }
      )
    default:
      return { passed: false, reason: `Unknown check: ${checkName}` }
  }
}
