/**
 * Scenario: Silent Buyer Auto-Release — Worker Compensation Protection
 * Implements phase-7-agents-judge-mode-mcp.md §7.3.
 *
 * Demonstrates protocol protection against unresponsive buyers:
 * 1. Milestone 2 contains a human escalation criterion ("Buyer confirms tone").
 * 2. Deliverable passes deterministic & rubric criteria, but enters ESCALATED for buyer review.
 * 3. Buyer remains silent.
 * 4. Protocol triggers AUTO_RELEASE after the review window, automatically capturing funds
 *    for the worker.
 */
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { milestones } from '@/server/db/schema'
import { handleAutoRelease } from '@/server/jobs/handlers/auto-release'
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

export const silentBuyerAutoreleaseScenario: ScenarioDefinition = {
  name: 'silent_buyer_autorelease',
  title: 'Silent Buyer Auto-Release: Worker Protection Protocol',
  description:
    'Milestone 2 enters ESCALATED status awaiting manual buyer review. When the buyer remains silent, ProofPay automatically triggers auto-release to ensure the worker is paid.',
  steps: [
    // Step 0: Create and propose contract with escalation criterion
    {
      name: 'create_and_propose_escalation',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        await createAndProposeContract(ctx, 'contract-escalation.json')
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

    // Step 3: Worker submits valid Milestone 1
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

    // Step 4: Wait for Milestone 1 release
    {
      name: 'wait_m1_released',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const m1 = await ctx.workerClient.getMilestone(ctx.contractId!, 'm1')

        if (m1.status === 'RELEASED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'step',
            text: 'Milestone 1 PASSED verification. $60.00 USD released from PayPal authorization hold.',
            data: { milestone: 'm1', status: 'RELEASED' },
          })
          return { next: 'continue' }
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
          text: 'SynthetixBot submitted Milestone 2 deliverable (summary report subject to buyer review).',
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

    // Step 6: Wait for Milestone 2 escalation
    {
      name: 'wait_m2_escalated',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const m2 = await ctx.workerClient.getMilestone(ctx.contractId!, 'm2')

        if (m2.status === 'ESCALATED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'step',
            text: 'Milestone 2 ESCALATED: Deterministic and rubric checks PASSED, but human criterion "Buyer confirms tone" requires approval. Auto-release timer initiated (review window active).',
            data: {
              milestone: 'm2',
              status: 'ESCALATED',
              auto_release_at: m2.auto_release_at,
            },
          })
          return { next: 'continue' }
        }

        if (m2.status === 'RELEASED') {
          return { next: 'continue' }
        }

        return { next: 'wait', pollDelayMs: 2000 }
      },
    },

    // Step 7: Simulate buyer silence and execute auto-release
    {
      name: 'simulate_silence_and_autorelease',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const db = getDb()
        const [mRow] = await db
          .select()
          .from(milestones)
          .where(
            and(
              eq(milestones.contract_id, ctx.contractId!),
              eq(milestones.milestone_key, 'm2')
            )
          )

        if (!mRow) throw new Error('Milestone m2 not found in db')

        if (mRow.status === 'RELEASED') {
          return { next: 'continue' }
        }

        await ctx.emit({
          actor: 'buyer_agent',
          kind: 'message',
          text: 'ProcureBot remained silent past the review deadline with no disputes filed.',
          data: { buyer_action: 'none', silent: true },
        })

        // In demo mode, expire the deadline if still in future so auto-release can fire
        if (mRow.auto_release_at && new Date() < new Date(mRow.auto_release_at)) {
          await db
            .update(milestones)
            .set({ auto_release_at: new Date(Date.now() - 1000) })
            .where(eq(milestones.id, mRow.id))
        }

        // Trigger auto release
        await handleAutoRelease({
          contract_id: ctx.contractId!,
          milestone_id: mRow.id,
        })

        await ctx.emit({
          actor: 'protocol',
          kind: 'step',
          text: 'AUTO-RELEASE APPLIED: Review deadline expired without buyer rejection. Protocol automatically approved Milestone 2 and enqueued PayPal capture.',
          data: { milestone: 'm2', action: 'auto_release_applied' },
        })

        return { next: 'continue' }
      },
    },

    // Step 8: Wait for Milestone 2 release and completion
    {
      name: 'wait_m2_released',
      run: async (ctx: ScenarioContext): Promise<StepResult> => {
        const m2 = await ctx.workerClient.getMilestone(ctx.contractId!, 'm2')

        if (m2.status === 'RELEASED') {
          await ctx.emit({
            actor: 'protocol',
            kind: 'step',
            text: 'Milestone 2 $40.00 USD captured and released to SynthetixBot! Contract COMPLETED via auto-release protection.',
            data: { milestone: 'm2', status: 'RELEASED', auto_released: true },
          })
          return { next: 'done' }
        }

        return { next: 'wait', pollDelayMs: 2000 }
      },
    },
  ],
}
