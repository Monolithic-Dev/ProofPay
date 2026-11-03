/**
 * Scenario: Happy Path — Autonomous End-to-End Execution
 * Implements phase-7-agents-judge-mode-mcp.md §7.3.
 *
 * Flow:
 * 1. Buyer Agent creates and proposes contract
 * 2. Worker Agent accepts
 * 3. Pauses for Human PayPal sandbox approval hold
 * 4. Worker Agent delivers Milestone 1 (25 valid records)
 * 5. Milestone 1 verified and released ($60 USD capture)
 * 6. Worker Agent delivers Milestone 2 (175-word summary)
 * 7. Milestone 2 verified and released ($40 USD capture) -> Contract COMPLETED
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

export const happyPathScenario: ScenarioDefinition = {
  name: 'happy_path',
  title: 'Happy Path: Autonomous End-to-End Execution',
  description:
    'ProcureBot proposes a contract to SynthetixBot, human authorizes PayPal authorization hold once, and both milestones are delivered, verified, and captured autonomously.',
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

    // Step 3: Worker submits Milestone 1
    {
      name: 'submit_milestone_1',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const dataset = generateDataset()
        await ctx.emit({
          actor: 'worker_agent',
          kind: 'message',
          text: 'SynthetixBot submitted Milestone 1 deliverable: 25 structured product catalog records with validated emails and prices.',
          data: { milestone: 'm1', content_type: 'json_records' },
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

    // Step 4: Wait for Milestone 1 release
    {
      name: 'wait_m1_released',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const m1 = await ctx.workerClient.getMilestone(ctx.contractId!, 'm1')

        if (m1.status === 'RELEASED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'step',
            text: 'Milestone 1 PASSED verification! ProofPay protocol captured $60.00 USD from PayPal authorization hold.',
            data: { milestone: 'm1', status: 'RELEASED', amount_minor: 6000 },
          })
          return { next: 'continue' }
        }

        if (m1.status === 'REJECTED' || m1.status === 'RELEASE_FAILED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'error',
            text: `Milestone 1 unexpectedly reached state: ${m1.status}`,
          })
          return { next: 'done' }
        }

        return { next: 'wait', pollDelayMs: 2000 }
      },
    },

    // Step 5: Worker submits Milestone 2
    {
      name: 'submit_milestone_2',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const summary = generateSummary()
        await ctx.emit({
          actor: 'worker_agent',
          kind: 'message',
          text: 'SynthetixBot submitted Milestone 2 deliverable: 175-word executive market synthesis analyzing categories and price distribution.',
          data: { milestone: 'm2', content_type: 'text' },
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

    // Step 6: Wait for Milestone 2 release and completion
    {
      name: 'wait_m2_released',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const m2 = await ctx.workerClient.getMilestone(ctx.contractId!, 'm2')

        if (m2.status === 'RELEASED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'step',
            text: 'Milestone 2 PASSED rubric evaluation! ProofPay protocol captured final $40.00 USD. Contract COMPLETED.',
            data: { milestone: 'm2', status: 'RELEASED', amount_minor: 4000 },
          })
          return { next: 'done' }
        }

        if (m2.status === 'REJECTED' || m2.status === 'RELEASE_FAILED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'error',
            text: `Milestone 2 unexpectedly reached state: ${m2.status}`,
          })
          return { next: 'done' }
        }

        return { next: 'wait', pollDelayMs: 2000 }
      },
    },
  ],
}
