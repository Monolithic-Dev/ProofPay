/**
 * AI-assisted Contract Lint with patch verification.
 * Implements phase-3-auth-and-contracts.md §3.8.
 */
import { callTool, getBudgetStatus } from '@/server/ai/llm'
import { buildLintPrompt, PROMPT_VERSION } from '@/server/ai/prompts/lint.v1'
import { lintTool } from '@/server/ai/tools'
import { applyPatchSafe } from './patch'
import { runDeterministicLint } from './rules'
import type { LintIssue } from '@/shared/types'

export async function runAiLint(
  contract: unknown,
  detIssues: LintIssue[],
  options?: { contractId?: string }
): Promise<LintIssue[]> {
  // 1. Budget check — skip AI lint gracefully if budget is exhausted
  try {
    const budget = await getBudgetStatus()
    if (budget.exhausted) {
      return [
        {
          code: 'LINT_AI_UNAVAILABLE',
          severity: 'info',
          path: '/',
          message: 'AI lint is temporarily unavailable due to daily cost budget. Deterministic checks remain active.',
        },
      ]
    }
  } catch {
    // If budget check fails, continue
  }

  // 2. Call LLM for AI suggestions
  const { system, user } = buildLintPrompt({ contract, detIssues })
  let rawIssues: LintIssue[] = []

  try {
    const res = await callTool<{ issues: any[] }>({
      purpose: 'lint_contract',
      system,
      user,
      tool: lintTool,
      contractId: options?.contractId,
      temperature: 0,
    })

    rawIssues = (res.data?.issues || []).map((issue: any) => ({
      code: issue.code || 'LINT_AI_SUGGESTION',
      severity: issue.severity || 'warn',
      path: issue.path || '/',
      message: issue.message || 'Ambiguity flagged by AI reviewer',
      fix: issue.suggested_fix?.patch ? JSON.stringify(issue.suggested_fix.patch) : undefined,
    }))
  } catch (err) {
    return [
      {
        code: 'LINT_AI_UNAVAILABLE',
        severity: 'info',
        path: '/',
        message: 'AI lint review could not be completed. Only deterministic rules applied.',
      },
    ]
  }

  // 3. Verify each suggested fix: must be safe AND must not increase errors
  const verifiedIssues: LintIssue[] = []
  const initialErrorCount = detIssues.filter((i) => i.severity === 'error').length

  for (const issue of rawIssues) {
    if (!issue.fix) {
      verifiedIssues.push(issue)
      continue
    }

    try {
      const patch = JSON.parse(issue.fix)
      const patchResult = applyPatchSafe(contract, patch)

      if (!patchResult.ok || !patchResult.contract) {
        // Drop unsafe fix, keep issue
        verifiedIssues.push({ ...issue, fix: undefined })
        continue
      }

      // Re-lint patched contract
      const postLintIssues = runDeterministicLint(patchResult.contract)
      const postErrorCount = postLintIssues.filter((i) => i.severity === 'error').length

      // Drop fix if it increases error count or fails schema
      if (postErrorCount > initialErrorCount) {
        verifiedIssues.push({ ...issue, fix: undefined })
        continue
      }

      verifiedIssues.push(issue)
    } catch {
      verifiedIssues.push({ ...issue, fix: undefined })
    }
  }

  return verifiedIssues
}
