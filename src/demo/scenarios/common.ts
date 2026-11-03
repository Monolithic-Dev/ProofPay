/**
 * Common step helpers for autonomous agent demo scenarios.
 * Implements phase-7-agents-judge-mode-mcp.md §7.3.
 */
import fs from 'fs'
import path from 'path'
import { eq } from 'drizzle-orm'
import { getDb, withTx } from '@/server/db/client'
import { contracts, milestones } from '@/server/db/schema'
import { insertDraftContract } from '@/server/db/repos/contracts.repo'
import { appendLedgerEvent } from '@/server/ledger/append'
import { env } from '@/server/config/env'
import { requestFunding } from '@/demo/agents/buyer-agent'
import type { ScenarioContext, StepResult } from './types'
import type { ContractView } from '@/shared/types'

/**
 * Loads a JSON contract fixture from disk.
 */
export function loadContractFixture(filename: string): any {
  const p = path.resolve(process.cwd(), 'src/demo/fixtures', filename)
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

/**
 * Creates and proposes a contract for the scenario.
 * Uses compileContract if LLM enabled, otherwise falls back to fixture.
 */
export async function createAndProposeContract(
  ctx: ScenarioContext,
  fixtureName: 'contract-demo.json' | 'contract-escalation.json' = 'contract-demo.json'
): Promise<ContractView> {
  const sellerEmail = 'worker-agent@demo.proofpay'

  // If already created in context, return current contract
  if (ctx.contractId) {
    return ctx.buyerClient.getContract(ctx.contractId)
  }

  const fixture = loadContractFixture(fixtureName)
  const db = getDb()

  // Deterministic creation from fixture to ensure 100% demo reliability
  const draft = await withTx(async (tx) => {
    const created = await insertDraftContract(tx, {
      buyerId: ctx.userId,
      title: fixture.title,
      contract: fixture,
      lint: { issues: [] },
      totalMinor: fixture.total_minor,
    })

    // Append CONTRACT_CREATED
    await appendLedgerEvent(tx, {
      contractId: created.id,
      type: 'CONTRACT_CREATED',
      actorType: 'buyer',
      actorId: ctx.userId,
      payload: {
        title: fixture.title,
        total_minor: fixture.total_minor,
      },
    })

    return created
  })

  // Propose to worker agent
  const proposed = await ctx.buyerClient.proposeContract(draft.id, sellerEmail)
  ctx.contractId = draft.id
  ctx.data.contractId = draft.id

  await ctx.emit({
    actor: 'buyer_agent',
    kind: 'message',
    text: `Proposed contract '${proposed.title}' for $${(proposed.total_minor / 100).toFixed(2)} USD to SynthetixBot.`,
    data: {
      contract_id: draft.id,
      title: proposed.title,
      total_minor: proposed.total_minor,
      milestones: proposed.milestones?.length,
    },
  })

  return proposed
}

/**
 * Step: Worker agent accepts the proposed contract.
 */
export async function stepWorkerAccept(ctx: ScenarioContext): Promise<StepResult> {
  if (!ctx.contractId) throw new Error('Contract ID missing in scenario context')

  const contract = await ctx.buyerClient.getContract(ctx.contractId)
  if (contract.status !== 'PROPOSED') {
    // Already accepted
    return { next: 'continue' }
  }

  const accepted = await ctx.workerClient.acceptContract(ctx.contractId)

  await ctx.emit({
    actor: 'worker_agent',
    kind: 'message',
    text: `SynthetixBot accepted contract terms (${accepted.milestones?.length || 2} milestones). Ready to execute upon PayPal escrow funding.`,
    data: { contract_id: ctx.contractId, status: accepted.status },
  })

  return { next: 'continue' }
}

/**
 * Step: Requests PayPal funding and polls until human approval hold is confirmed.
 */
export async function stepFundingWait(ctx: ScenarioContext): Promise<StepResult> {
  if (!ctx.contractId) throw new Error('Contract ID missing in scenario context')

  const contract = await ctx.buyerClient.getContract(ctx.contractId)

  // If already funded or past, continue immediately
  if (
    contract.status === 'FUNDED' ||
    contract.status === 'IN_PROGRESS' ||
    contract.status === 'COMPLETED'
  ) {
    return { next: 'continue' }
  }

  // If not yet started funding, start it
  if (!ctx.data.approvalUrl) {
    const fundingRes = await requestFunding(ctx.buyerClient, ctx.contractId)
    ctx.data.approvalUrl = fundingRes.approvalUrl
    ctx.data.orderId = fundingRes.orderId

    await ctx.emit({
      actor: 'human',
      kind: 'waiting',
      text: 'ProofPay protocol paused: Waiting for human payer to approve PayPal sandbox authorization hold.',
      data: {
        approval_url: fundingRes.approvalUrl,
        order_id: fundingRes.orderId,
        amount_usd: ((contract.total_minor || 10000) / 100).toFixed(2),
      },
    })
  }

  // Check if now funded
  const refreshed = await ctx.buyerClient.getContract(ctx.contractId)
  if (
    refreshed.status === 'FUNDED' ||
    refreshed.status === 'IN_PROGRESS' ||
    refreshed.status === 'COMPLETED'
  ) {
    await ctx.emit({
      actor: 'protocol',
      kind: 'step',
      text: `PayPal authorization hold confirmed ($${((refreshed.total_minor || 10000) / 100).toFixed(2)} USD). Contract active in IN_PROGRESS.`,
      data: {
        contract_id: ctx.contractId,
        authorization_id: refreshed.authorization_id,
        status: refreshed.status,
      },
    })
    return { next: 'continue' }
  }

  // Still waiting for human approval
  return { next: 'wait', pollDelayMs: 2500 }
}
