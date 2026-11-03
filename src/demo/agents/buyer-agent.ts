/**
 * Buyer Agent (ProcureBot) — autonomous buyer agent compiling, proposing, and funding contracts.
 * Implements phase-7-agents-judge-mode-mcp.md §7.2.
 */
import type { ApiClient } from '@/shared/api-client'
import type { ContractView } from '@/shared/types'

export interface CreateAndProposeResult {
  contract: ContractView
  iterations: number
}

/**
 * Compiles a contract from prompt, automatically applies deterministic fixes (<= 5 iterations),
 * and proposes it to the worker agent.
 */
export async function createAndPropose(
  client: ApiClient,
  prompt: string,
  sellerEmail = 'worker-agent@demo.proofpay'
): Promise<CreateAndProposeResult> {
  // 1. Compile contract
  const compiled = await client.compileContract(prompt)
  let contract = compiled.contract

  // 2. Lint and auto-fix loop (max 5 iterations)
  let iterations = 0
  const maxIterations = 5

  while (iterations < maxIterations) {
    const lintResult = await client.lintContract(contract.id)
    const errorIssues = lintResult.issues.filter((i) => i.severity === 'error')
    if (errorIssues.length === 0) break

    const fixable = errorIssues.find((i) => i.suggested_fix)
    if (!fixable) {
      break
    }

    contract = await client.applyLintFix(contract.id, fixable.code)
    iterations++
  }

  // 3. Propose to worker agent
  const proposed = await client.proposeContract(contract.id, sellerEmail)
  return {
    contract: proposed,
    iterations,
  }
}

/**
 * Initiates PayPal funding hold and returns the approval URL for the human payer.
 */
export async function requestFunding(
  client: ApiClient,
  contractId: string
): Promise<{ approvalUrl: string; orderId?: string }> {
  const res = await client.startFunding(contractId)
  if (!res.approval_url) {
    throw new Error('No approval URL returned from PayPal funding initiation')
  }
  return {
    approvalUrl: res.approval_url,
    orderId: res.order_id,
  }
}

/**
 * Polls contract state until funded, or throws on timeout.
 */
export async function waitForFunded(
  client: ApiClient,
  contractId: string,
  timeoutMs = 15 * 60 * 1000,
  pollIntervalMs = 2000
): Promise<ContractView> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const contract = await client.getContract(contractId)
    const status = contract.status
    if (status === 'FUNDED' || status === 'IN_PROGRESS' || status === 'COMPLETED') {
      return contract
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  throw new Error(`Timed out waiting for contract ${contractId} to reach FUNDED state`)
}
