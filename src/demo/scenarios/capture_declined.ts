/**
 * Scenario: Capture Declined — Chaos Engineering & Payment Recovery
 * Implements phase-7-agents-judge-mode-mcp.md §7.3.
 *
 * Demonstrates payment resilience:
 * 1. Simulates PayPal payment instrument decline during Milestone 1 capture.
 * 2. ProofPay records RELEASE_FAILED without losing authorization hold or failing contract.
 * 3. Once instrument issue is resolved, release retry captures successfully.
 */
import {
  createAndProposeContract,
  stepWorkerAccept,
  stepFundingWait,
} from './common'
import {
  generateDataset,
  generateSummary,
  submitDeliverableAsWorker,
} from '@/demo/agents/worker-agent'
import type { ScenarioDefinition, ScenarioContext, StepResult } from './types'

export const captureDeclinedScenario: ScenarioDefinition = {
  name: 'capture_declined',
  title: 'Capture Declined: Payment Decline Resilience',
  description:
    'Injects a PayPal INSTRUMENT_DECLINED error during capture. ProofPay flags RELEASE_FAILED without voiding the authorization hold, clears the decline, and successfully retries capture.',
  steps: [
    // Step 0: Create and propose contract
    {
      name: 'create_and_propose',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        await createAndProposeContract(ctx, 'contract-demo.json')
        return { next: 'continue' }
      },
    },

    // Step 1: Worker Agent accepts
    {
      name: 'worker_accept',
      run: stepWorkerAccept,
    },

    // Step 2: Request PayPal funding and wait for human hold
    {
      name: 'funding_wait',
      run: stepFundingWait,
    },

    // Step 3: Buyer injects Chaos Header (INSTRUMENT_DECLINED)
    {
      name: 'inject_chaos',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        await ctx.buyerClient.setChaos(ctx.contractId!, 'INSTRUMENT_DECLINED')

        await ctx.emit({
          actor: 'buyer_agent',
          kind: 'message',
          text: 'Chaos Mode active: Injected PayPal INSTRUMENT_DECLINED simulation mock header into contract context.',
          data: { chaos_mock_code: 'INSTRUMENT_DECLINED' },
        })

        return { next: 'continue' }
      },
    },

    // Step 4: Worker submits valid Milestone 1
    {
      name: 'submit_m1_valid',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const dataset = generateDataset()
        await ctx.emit({
          actor: 'worker_agent',
          kind: 'message',
          text: 'SynthetixBot submitted Milestone 1 product dataset (25 records).',
          data: { milestone: 'm1' },
        })

        await submitDeliverableAsWorker(
          ctx.workerClient,
          ctx.contractId!,
          'm1',
          dataset,
          'json_records'
        )
        return { next: 'continue' }
      },
    },

    // Step 5: Wait for capture failure
    {
      name: 'wait_release_failed',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const m1 = await ctx.workerClient.getMilestone(ctx.contractId!, 'm1')

        if (m1.status === 'RELEASE_FAILED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'step',
            text: 'CAPTURE DECLINED: PayPal returned INSTRUMENT_DECLINED. Hold remains safely reserved with PayPal; funds are NOT forfeited. Status marked RELEASE_FAILED for operator remediation.',
            data: {
              milestone: 'm1',
              status: 'RELEASE_FAILED',
              error_code: 'INSTRUMENT_DECLINED',
            },
          })
          return { next: 'continue' }
        }

        if (m1.status === 'RELEASED') {
          // If already released somehow, continue
          return { next: 'continue' }
        }

        return { next: 'wait', pollDelayMs: 2000 }
      },
    },

    // Step 6: Clear chaos and retry release
    {
      name: 'clear_chaos_and_retry',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        await ctx.buyerClient.setChaos(ctx.contractId!, undefined)

        await ctx.emit({
          actor: 'buyer_agent',
          kind: 'message',
          text: 'Remediated payment instrument: Cleared chaos simulation header and requested capture retry via retry-release endpoint.',
          data: { action: 'retry_release', milestone: 'm1' },
        })

        await ctx.buyerClient.retryRelease(ctx.contractId!, 'm1')
        return { next: 'continue' }
      },
    },

    // Step 7: Wait for Milestone 1 release after retry
    {
      name: 'wait_m1_released_retry',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const m1 = await ctx.workerClient.getMilestone(ctx.contractId!, 'm1')

        if (m1.status === 'RELEASED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'step',
            text: 'Retry capture SUCCEEDED! $60.00 USD released to SynthetixBot. Audit ledger reflects successful recovery.',
            data: { milestone: 'm1', status: 'RELEASED', recovered: true },
          })
          return { next: 'continue' }
        }

        return { next: 'wait', pollDelayMs: 2000 }
      },
    },

    // Step 8: Worker submits Milestone 2
    {
      name: 'submit_milestone_2',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const summary = generateSummary()
        await ctx.emit({
          actor: 'worker_agent',
          kind: 'message',
          text: 'SynthetixBot submitted Milestone 2 summary.',
          data: { milestone: 'm2' },
        })

        await submitDeliverableAsWorker(
          ctx.workerClient,
          ctx.contractId!,
          'm2',
          summary,
          'text'
        )
        return { next: 'continue' }
      },
    },

    // Step 9: Wait for Milestone 2 completion
    {
      name: 'wait_m2_released',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const m2 = await ctx.workerClient.getMilestone(ctx.contractId!, 'm2')

        if (m2.status === 'RELEASED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'step',
            text: 'Milestone 2 PASSED rubric evaluation! $40.00 USD captured. Contract COMPLETED.',
            data: { milestone: 'm2', status: 'RELEASED' },
          })
          return { next: 'done' }
        }

        return { next: 'wait', pollDelayMs: 2000 }
      },
    },
  ],
}
