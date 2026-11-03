/**
 * Scenario: Reject Then Pass — Self-Correction Loop
 * Implements phase-7-agents-judge-mode-mcp.md §7.3.
 *
 * Demonstrates autonomous self-correction:
 * 1. Worker agent submits flawed deliverable (22 rows, invalid email)
 * 2. Deterministic verification rejects it and provides structured feedback
 * 3. Worker agent parses feedback, repairs the data, and resubmits
 * 4. Milestone 1 passes on attempt 2 and funds are captured.
 */
import {
  createAndProposeContract,
  stepWorkerAccept,
  stepFundingWait,
} from './common'
import {
  generateDataset,
  generateSummary,
  applyFeedback,
  submitDeliverableAsWorker,
} from '@/demo/agents/worker-agent'
import type { ScenarioDefinition, ScenarioContext, StepResult } from './types'

export const rejectThenPassScenario: ScenarioDefinition = {
  name: 'reject_then_pass',
  title: 'Reject Then Pass: Autonomous Self-Correction',
  description:
    'SynthetixBot submits flawed data (22 rows, malformed email). ProofPay verification rejects it, SynthetixBot repairs the flaws via protocol feedback, and passes on resubmission.',
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

    // Step 3: Worker submits flawed Milestone 1
    {
      name: 'submit_flawed_m1',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const flawedDataset = generateDataset({ flaw: 'bad_email' })
        ctx.data.flawedDataset = flawedDataset

        await ctx.emit({
          actor: 'worker_agent',
          kind: 'message',
          text: 'SynthetixBot submitted initial Milestone 1 dataset draft (unverified scrape: 22 records).',
          data: { milestone: 'm1', content_type: 'json_records', attempt: 1 },
        })

        await submitDeliverableAsWorker(
          ctx.workerClient,
          ctx.contractId!,
          'm1',
          flawedDataset,
          'json_records'
        )
        return { next: 'continue' }
      },
    },

    // Step 4: Wait for Milestone 1 rejection
    {
      name: 'wait_m1_rejected',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const m1 = await ctx.workerClient.getMilestone(ctx.contractId!, 'm1')

        if (m1.status === 'REJECTED') {
          const report = m1.latest_verification
          const failedReasons = report?.reasons || []
          const reasonText =
            failedReasons.length > 0
              ? failedReasons.map((r) => r.message).join('; ')
              : 'Invalid row count (22 < 25) and malformed email contact on record 22 (bob@@x)'

          await ctx.emit({
            actor: 'protocol',
            kind: 'step',
            text: `Milestone 1 REJECTED (Attempt 1): Schema verification failed. Reasons: ${reasonText}. Escalating actionable feedback to SynthetixBot.`,
            data: {
              milestone: 'm1',
              status: 'REJECTED',
              attempt: 1,
              reasons: failedReasons,
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

    // Step 5: Worker applies feedback and resubmits
    {
      name: 'apply_feedback_and_resubmit',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const flawed = (ctx.data.flawedDataset as string) || generateDataset({ flaw: 'bad_email' })
        const fixed = applyFeedback(flawed)

        await ctx.emit({
          actor: 'worker_agent',
          kind: 'message',
          text: 'SynthetixBot applied protocol feedback: Repaired malformed email regex on row 22 and padded dataset to 25 items. Resubmitting Milestone 1 (Attempt 2).',
          data: { milestone: 'm1', attempt: 2, action: 'apply_feedback' },
        })

        await submitDeliverableAsWorker(
          ctx.workerClient,
          ctx.contractId!,
          'm1',
          fixed,
          'json_records'
        )
        return { next: 'continue' }
      },
    },

    // Step 6: Wait for Milestone 1 release
    {
      name: 'wait_m1_released',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const m1 = await ctx.workerClient.getMilestone(ctx.contractId!, 'm1')

        if (m1.status === 'RELEASED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'step',
            text: 'Milestone 1 PASSED verification on attempt 2! $60.00 USD released and captured from PayPal escrow hold.',
            data: { milestone: 'm1', status: 'RELEASED', attempt: 2, amount_minor: 6000 },
          })
          return { next: 'continue' }
        }

        return { next: 'wait', pollDelayMs: 2000 }
      },
    },

    // Step 7: Worker submits Milestone 2
    {
      name: 'submit_milestone_2',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const summary = generateSummary()
        await ctx.emit({
          actor: 'worker_agent',
          kind: 'message',
          text: 'SynthetixBot submitted Milestone 2 deliverable: 175-word market analysis synthesis.',
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

    // Step 8: Wait for Milestone 2 completion
    {
      name: 'wait_m2_released',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const m2 = await ctx.workerClient.getMilestone(ctx.contractId!, 'm2')

        if (m2.status === 'RELEASED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'step',
            text: 'Milestone 2 PASSED rubric evaluation! $40.00 USD captured. Contract COMPLETED successfully.',
            data: { milestone: 'm2', status: 'RELEASED', amount_minor: 4000 },
          })
          return { next: 'done' }
        }

        return { next: 'wait', pollDelayMs: 2000 }
      },
    },
  ],
}
