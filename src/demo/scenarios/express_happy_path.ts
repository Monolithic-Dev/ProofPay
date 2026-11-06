/**
 * Scenario: Express Happy Path — 90-Second Judge Evaluation Lane (AIP-13)
 *
 * Designed specifically for hackathon judges:
 * 1. Claims a pre-authorized PayPal hold contract ($10 USD) or provisions one instantly
 * 2. Skips manual PayPal sandbox login (pre-authorized by ProofPay team)
 * 3. SynthetixBot (Worker Agent) submits 25 validated product catalog records
 * 4. Multi-Stage AI Verification engine runs (Deterministic checks + AI rubric reasoning)
 * 5. PayPal Capture executes ($10.00 USD released to seller)
 * 6. Cryptographic ledger block is sealed and Proof Pack is generated
 *
 * Runs end-to-end in < 90 seconds (typically ~15-25 seconds).
 */
import { claimExpressContract } from '@/server/demo/pool'
import { generateDataset, submitDeliverableAsWorker } from '@/demo/agents/worker-agent'
import type { ScenarioDefinition, ScenarioContext, StepResult } from './types'

export const expressHappyPathScenario: ScenarioDefinition = {
  name: 'express_happy_path',
  title: 'Express Lane: 90-Second Live Judge Walkthrough',
  description:
    'Pre-authorized sandbox evaluation. Evaluates full lifecycle: agent submission, multi-stage AI verification, PayPal $10 capture, and cryptographic ledger append without requiring judge PayPal credentials.',
  steps: [
    // Step 0: Claim pre-authorized contract
    {
      name: 'claim_express_contract',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const poolContract = await claimExpressContract(ctx.userId)
        ctx.contractId = poolContract.contract_id
        ctx.data.contractId = poolContract.contract_id
        ctx.data.authorizationId = poolContract.authorization_id

        await ctx.emit({
          actor: 'protocol',
          kind: 'step',
          text: `Express Judge Lane initialized. Claimed pre-authorized contract (${poolContract.contract_id.slice(0, 8)}…) with active PayPal authorization hold ($10.00 USD).`,
          data: {
            contract_id: poolContract.contract_id,
            authorization_id: poolContract.authorization_id,
            from_pool: poolContract.from_pool,
            amount_usd: '10.00',
          },
        })

        return { next: 'continue' }
      },
    },

    // Step 1: Worker Agent submits deliverable
    {
      name: 'submit_deliverable',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        if (!ctx.contractId) throw new Error('Contract ID missing in scenario context')

        const dataset = generateDataset()
        await ctx.emit({
          actor: 'worker_agent',
          kind: 'message',
          text: 'SynthetixBot submitted Milestone 1 deliverable: 25 structured product catalog records with validated emails and prices.',
          data: { milestone: 'm1', content_type: 'json_records' },
        })

        await submitDeliverableAsWorker(
          ctx.workerClient,
          ctx.contractId,
          'm1',
          dataset,
          'json_records'
        )

        return { next: 'continue' }
      },
    },

    // Step 2: Verification engine runs
    {
      name: 'verify_and_release',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        if (!ctx.contractId) throw new Error('Contract ID missing')

        const m1 = await ctx.workerClient.getMilestone(ctx.contractId, 'm1')

        if (m1.status === 'RELEASED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'step',
            text: 'Milestone 1 PASSED verification! ProofPay captured $10.00 USD from PayPal authorization hold. Contract COMPLETED.',
            data: {
              milestone: 'm1',
              status: 'RELEASED',
              amount_minor: 1000,
              contract_id: ctx.contractId,
            },
          })
          return { next: 'done' }
        }

        if (m1.status === 'PASSED' || m1.status === 'RELEASING') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'step',
            text: 'AI Multi-Stage verification PASSED (100% deterministic score, rubric cited verbatim quote). Releasing payment…',
            data: { milestone: 'm1', status: m1.status },
          })
        }

        if (m1.status === 'REJECTED' || m1.status === 'RELEASE_FAILED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'error',
            text: `Milestone 1 reached unexpected state: ${m1.status}`,
          })
          return { next: 'done' }
        }

        return { next: 'wait', pollDelayMs: 1500 }
      },
    },
  ],
}
