import type { ParsedArtifact } from '../artifact'

export interface CheckForbiddenTermsSpec {
  terms: string[]
  case_sensitive?: boolean
}

export function checkForbiddenTerms(
  artifact: ParsedArtifact,
  spec: CheckForbiddenTermsSpec
): { status: 'pass' | 'fail'; observed: unknown; expected: unknown; message: string } {
  const content = artifact.text || ''
  const terms = spec.terms || []
  const caseSensitive = Boolean(spec.case_sensitive)

  const testContent = caseSensitive ? content : content.toLowerCase()
  const foundTerms: string[] = []

  for (const term of terms) {
    const testTerm = caseSensitive ? term : term.toLowerCase()
    if (testContent.includes(testTerm)) {
      foundTerms.push(term)
    }
  }

  if (foundTerms.length > 0) {
    return {
      status: 'fail',
      observed: foundTerms,
      expected: '0 forbidden terms',
      message: `Deliverable contains forbidden terms: ${foundTerms.join(', ')}.`,
    }
  }

  return {
    status: 'pass',
    observed: '0 forbidden terms found',
    expected: '0 forbidden terms',
    message: `All ${terms.length} forbidden term check(s) passed.`,
  }
}
