/**
 * Deterministic check registry — Stage 1 of the ProofPay verification pipeline.
 * Dispatches to individual check engines and unifies DetResult shapes.
 * Implements phase-4-verification-engine.md §4.2, ai-pipeline.md §3 Stage 1,
 * and docs/v2/01-NEXT-LEVEL-STRATEGY.md F6 (Criteria Library v2).
 */
import { parseArtifact, type ParsedArtifact } from '../artifact'
import { checkJsonSchema, type CheckJsonSchemaSpec } from './json-schema'
import { checkRowCount, type CheckRowCountSpec } from './row-count'
import { checkUniqueField, type CheckUniqueFieldSpec } from './unique-field'
import { checkRegexField, type CheckRegexFieldSpec } from './regex-field'
import { checkWordCount, type CheckWordCountSpec, countWords } from './word-count'
import { checkRequiredKeywords, type CheckRequiredKeywordsSpec } from './required-keywords'
import { checkCsvSchema, type CheckCsvSchemaSpec } from './csv-schema'
import { checkForbiddenTerms, type CheckForbiddenTermsSpec } from './forbidden-terms'
import { checkLinkCheck, type CheckLinkCheckSpec } from './link-check'
import { NAMED_PATTERNS } from './patterns'

export {
  checkJsonSchema,
  checkRowCount,
  checkUniqueField,
  checkRegexField,
  checkWordCount,
  checkRequiredKeywords,
  checkCsvSchema,
  checkForbiddenTerms,
  checkLinkCheck,
  countWords,
  NAMED_PATTERNS,
}

export interface DetResult {
  criterion_key: string
  status: 'pass' | 'fail'
  observed: unknown
  expected: unknown
  message: string
  passed: boolean
  reason: string
}

export interface DeterministicCriterion {
  key?: string
  criterion_key?: string
  type?: 'deterministic'
  check?: string
  check_name?: string
  spec?: Record<string, unknown>
  spec_json?: Record<string, unknown>
  required?: boolean
  description?: string
}

/**
 * Dispatch an individual deterministic criterion check against the parsed artifact.
 * Supports both modern (criterion, artifact) and legacy (checkName, artifact, spec) signatures.
 */
export function runDeterministicCheck(
  criterionOrCheckName: DeterministicCriterion | string,
  artifactOrContent: ParsedArtifact | string,
  maybeSpec?: Record<string, unknown>
): DetResult {
  let key = 'c_det'
  let checkName = ''
  let spec: Record<string, unknown> = {}

  if (typeof criterionOrCheckName === 'string') {
    checkName = criterionOrCheckName
    spec = maybeSpec ?? {}
  } else {
    key = criterionOrCheckName.key ?? criterionOrCheckName.criterion_key ?? 'c_det'
    checkName = criterionOrCheckName.check ?? criterionOrCheckName.check_name ?? ''
    spec = (criterionOrCheckName.spec ?? criterionOrCheckName.spec_json ?? {}) as Record<string, unknown>
  }

  const parsedArt: ParsedArtifact =
    typeof artifactOrContent === 'string'
      ? parseArtifact('text', artifactOrContent)
      : artifactOrContent

  let rawRes: { status: 'pass' | 'fail'; observed: unknown; expected: unknown; message: string }

  switch (checkName) {
    case 'json_schema':
      rawRes = checkJsonSchema(parsedArt, spec as unknown as CheckJsonSchemaSpec)
      break

    case 'row_count':
      rawRes = checkRowCount(parsedArt, spec as unknown as CheckRowCountSpec)
      break

    case 'unique_field':
      rawRes = checkUniqueField(parsedArt, spec as unknown as CheckUniqueFieldSpec)
      break

    case 'regex_field':
      rawRes = checkRegexField(parsedArt, spec as unknown as CheckRegexFieldSpec)
      break

    case 'word_count':
      rawRes = checkWordCount(parsedArt, spec as unknown as CheckWordCountSpec)
      break

    case 'required_keywords':
      rawRes = checkRequiredKeywords(parsedArt, spec as unknown as CheckRequiredKeywordsSpec)
      break

    case 'csv_schema':
      rawRes = checkCsvSchema(parsedArt, spec as unknown as CheckCsvSchemaSpec)
      break

    case 'forbidden_terms':
      rawRes = checkForbiddenTerms(parsedArt, spec as unknown as CheckForbiddenTermsSpec)
      break

    case 'link_check':
      rawRes = checkLinkCheck(parsedArt, spec as unknown as CheckLinkCheckSpec)
      break

    default:
      rawRes = {
        status: 'fail',
        observed: checkName,
        expected: 'json_schema | row_count | unique_field | regex_field | word_count | required_keywords | csv_schema | forbidden_terms | link_check',
        message: `Unknown check: "${checkName}".`,
      }
      break
  }

  return {
    criterion_key: key,
    status: rawRes.status,
    observed: rawRes.observed,
    expected: rawRes.expected,
    message: rawRes.message,
    passed: rawRes.status === 'pass',
    reason: rawRes.message,
  }
}
