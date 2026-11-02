/**
 * Contract compilation engine — transforms natural language job prompts into verified contracts.
 * Implements phase-3-auth-and-contracts.md §3.9 & ai-pipeline.md §1.
 */
import { randomBytes } from 'crypto'
import { callTool } from '@/server/ai/llm'
import { COMPILE_SYSTEM_PROMPT } from '@/server/ai/prompts/compile.v1'
import { contractTool } from '@/server/ai/tools'
import { parseContract, type Contract } from '@/server/contracts/schema'
import { runDeterministicLint } from '@/server/contracts/lint/rules'
import { runAiLint } from '@/server/contracts/lint/ai-lint'
import { withTx, lockContract } from '@/server/db/client'
import { insertDraftContract } from '@/server/db/repos/contracts.repo'
import { appendLedgerEvent } from '@/server/ledger/append'
import { sha256Hex } from '@/server/contracts/canonical'
import { AppError, ValidationError } from '@/server/util/errors'
import type { LintIssue } from '@/shared/types'

export function buildCompilePrompt(params: { prompt: string; nonce: string; budgetCapMinor?: number }) {
  const capNotice = params.budgetCapMinor
    ? `\nHard budget cap: $${(params.budgetCapMinor / 100).toFixed(2)} USD (${params.budgetCapMinor} cents). total_minor must NOT exceed this amount.`
    : ''
  return {
    system: `${COMPILE_SYSTEM_PROMPT}${capNotice}`,
    user: `<user_prompt nonce="${params.nonce}">\n${params.prompt}\n</user_prompt>`,
  }
}

export interface CompileParams {
  prompt: string
  userId: string
  sellerEmail?: string
  budgetCapMinor?: number
}

export interface CompileResult {
  contract_id: string
  contract: Contract
  lint: {
    issues: LintIssue[]
  }
}

export async function compileContract(params: CompileParams): Promise<CompileResult> {
  const { prompt, userId, budgetCapMinor } = params

  // 1. Validate prompt
  const trimmed = prompt ? prompt.trim() : ''
  if (!trimmed || trimmed.length === 0) {
    throw new ValidationError('Job prompt cannot be empty')
  }
  if (trimmed.length > 2000) {
    throw new ValidationError('Job prompt exceeds maximum length of 2,000 characters')
  }

  // Strip control chars (keep \n and \t)
  const sanitized = trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Prompt injection neutralization check
  const hasInjectionAttempt = /ignore (all|previous)|mark .* pass/i.test(sanitized)

  // 2. Generate nonce and prompt outside DB transaction
  const nonce = randomBytes(16).toString('hex')
  const { system, user } = buildCompilePrompt({
    prompt: sanitized,
    nonce,
    budgetCapMinor,
  })

  // 3. Call LLM (STRICTLY outside any DB transaction)
  let rawContract: unknown
  try {
    const res = await callTool<Contract>({
      purpose: 'compile_contract',
      system,
      user,
      tool: contractTool,
      parse: parseContract,
      temperature: 0,
    })
    rawContract = res.data
  } catch (err: unknown) {
    throw new AppError('UPSTREAM_LLM', `Failed to compile contract from prompt: ${String(err)}`, 502)
  }

  const contract = parseContract(rawContract)

  // 4. Run Lints
  const detIssues = runDeterministicLint(contract, { budgetCapMinor })
  if (hasInjectionAttempt) {
    detIssues.push({
      code: 'LINT_SUSPICIOUS_PROMPT',
      severity: 'info',
      path: '/',
      message: 'Prompt contained instruction-override patterns; contract compiled with strict isolation.',
    })
  }

  const aiIssues = await runAiLint(contract, detIssues)
  const allIssues = [...detIssues, ...aiIssues]

  const errorCount = allIssues.filter((i) => i.severity === 'error').length
  const warnCount = allIssues.filter((i) => i.severity === 'warn').length
  const infoCount = allIssues.filter((i) => i.severity === 'info').length

  const promptHash = sha256Hex(sanitized)

  // 5. Save to database within a short transaction
  const result = await withTx(async (tx) => {
    const draft = await insertDraftContract(tx, {
      buyerId: userId,
      title: contract.title,
      contract: contract as unknown as Record<string, unknown>,
      lint: { issues: allIssues },
      totalMinor: contract.total_minor,
    })

    await lockContract(tx, draft.id)

    // Ledger CONTRACT_CREATED
    await appendLedgerEvent(tx as any, {
      contractId: draft.id,
      type: 'CONTRACT_CREATED',
      actorType: 'buyer',
      actorId: userId,
      payload: {
        title: contract.title,
        total_minor: contract.total_minor,
        prompt_sha256: promptHash,
      },
    })

    // Ledger CONTRACT_LINTED
    await appendLedgerEvent(tx as any, {
      contractId: draft.id,
      type: 'CONTRACT_LINTED',
      actorType: 'system',
      payload: {
        issue_counts: {
          error: errorCount,
          warn: warnCount,
          info: infoCount,
        },
      },
    })

    return {
      contract_id: draft.id,
      contract,
      lint: {
        issues: allIssues,
      },
    }
  })

  return result
}
