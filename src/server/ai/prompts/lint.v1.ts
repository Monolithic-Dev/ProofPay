/**
 * AI Contract Lint prompt — version 1.
 * Implements phase-3-auth-and-contracts.md §3.6 & ai-pipeline.md §5.
 */
import type { LintIssue } from '@/shared/types'

export const PROMPT_VERSION = 'lint.v1'

export function buildLintPrompt(params: {
  contract: unknown
  detIssues: LintIssue[]
}): {
  system: string
  user: string
} {
  const { contract, detIssues } = params

  const system = `You are the ProofPay Contract Lint Engine.
Your job is to examine draft milestone payment contracts and detect ambiguities, subjective terms, or missing specifications.
For any issue identified:
1. Provide a clear code and message explaining the ambiguity.
2. Provide a suggested JSON Patch (RFC 6902) to fix the issue where possible.
3. Every fix must make criteria measurable and objective without changing the business intent.`

  const user = `Here is the current contract JSON:
${JSON.stringify(contract, null, 2)}

Deterministic checks already identified the following issues:
${JSON.stringify(detIssues, null, 2)}

Analyze the contract for any remaining ambiguities or vague terms and return your findings via the provide_lint_review tool.`

  return { system, user }
}
