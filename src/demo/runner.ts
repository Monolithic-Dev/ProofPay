/**
 * Scenario Runner Engine — implements correction C-4 (as asynchronous, idempotent jobs).
 * Manages demo_runs lifecycle, step execution, and live event emission.
 * Implements phase-7-agents-judge-mode-mcp.md §7.3.
 */
import { eq, and, inArray, lt } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { demo_runs, contracts } from '@/server/db/schema'
import { enqueueJob } from '@/server/jobs/queue'
import { AppError } from '@/server/util/errors'
import { env } from '@/server/config/env'
import { logger } from '@/server/util/logger'
import { getAgentClient } from '@/demo/agents/credentials'
import type {
  DemoEvent,
  ScenarioContext,
  StepResult,
  ScenarioDefinition,
} from './scenarios/types'

import { happyPathScenario } from './scenarios/happy_path'
import { rejectThenPassScenario } from './scenarios/reject_then_pass'
import { injectionAttackScenario } from './scenarios/injection_attack'
import { captureDeclinedScenario } from './scenarios/capture_declined'
import { silentBuyerAutoreleaseScenario } from './scenarios/silent_buyer_autorelease'
import { expressHappyPathScenario } from './scenarios/express_happy_path'

const log = logger.child({ module: 'demo:runner' })

// Registry of available scenarios, populated statically
const SCENARIO_REGISTRY: Record<string, ScenarioDefinition> = {
  happy_path: happyPathScenario,
  reject_then_pass: rejectThenPassScenario,
  injection_attack: injectionAttackScenario,
  capture_declined: captureDeclinedScenario,
  silent_buyer_autorelease: silentBuyerAutoreleaseScenario,
  express_happy_path: expressHappyPathScenario,
}

export function registerScenario(scenario: ScenarioDefinition) {
  SCENARIO_REGISTRY[scenario.name] = scenario
}

export function getScenario(name: string): ScenarioDefinition | undefined {
  return SCENARIO_REGISTRY[name]
}

export function listScenarios(): ScenarioDefinition[] {
  return Object.values(SCENARIO_REGISTRY)
}

/**
 * Starts a scenario run for a user.
 * Enforces DEMO_MODE, single active run per user, and enqueues initial job.
 */
export async function startScenario(params: {
  name: string
  userId: string
}): Promise<{ run_id: string }> {
  const { name, userId } = params
  const db = getDb()

  if (!env.DEMO_MODE) {
    throw new AppError('DEMO_MODE_DISABLED', 'Demo mode is not enabled in this environment', 404)
  }

  const scenario = getScenario(name)
  if (!scenario) {
    throw new AppError('SCENARIO_NOT_FOUND', `Scenario '${name}' does not exist`, 404)
  }

  // 1. Check for active run
  const active = await db
    .select()
    .from(demo_runs)
    .where(
      and(
        eq(demo_runs.created_by, userId),
        inArray(demo_runs.status, ['RUNNING', 'WAITING_FOR_BUYER'])
      )
    )
    .limit(1)

  if (active.length > 0) {
    throw new AppError('RUN_ACTIVE', 'A scenario run is already active for this user', 409)
  }

  // 2. Insert demo_runs record
  const [run] = await db
    .insert(demo_runs)
    .values({
      scenario: name,
      status: 'RUNNING',
      created_by: userId,
      events: [],
    })
    .returning()

  if (!run) {
    throw new AppError('RUN_CREATION_FAILED', 'Failed to create demo run', 500)
  }

  // 3. Emit initial start event
  await emit(run.id, {
    actor: 'protocol',
    kind: 'step',
    text: `Starting scenario: ${scenario.title}`,
    data: { scenario: name },
  })

  // 4. Enqueue first step job (Correction C-4)
  await enqueueJob(
    db,
    'DEMO_STEP',
    {
      run_id: run.id,
      step: 0,
      data: {},
    },
    { dedupeKey: `demo:${run.id}:0` }
  )

  return { run_id: run.id }
}

/**
 * Appends an event to the demo run's event log and syncs status.
 */
export async function emit(runId: string, event: Omit<DemoEvent, 't'>): Promise<void> {
  const db = getDb()
  const fullEvent: DemoEvent = {
    ...event,
    t: new Date().toISOString(),
  }

  const [run] = await db.select().from(demo_runs).where(eq(demo_runs.id, runId)).limit(1)
  if (!run) return

  const currentEvents = (run.events as DemoEvent[]) || []
  const updatedEvents = [...currentEvents, fullEvent].slice(-500) // Cap at 500

  let newStatus = run.status
  let finishedAt = run.finished_at

  if (event.kind === 'waiting') {
    newStatus = 'WAITING_FOR_BUYER'
  } else if (event.kind === 'error') {
    newStatus = 'FAILED'
    finishedAt = new Date()
  } else if (event.kind === 'done') {
    newStatus = 'DONE'
    finishedAt = new Date()
  } else if (run.status === 'WAITING_FOR_BUYER' && event.kind === 'step') {
    newStatus = 'RUNNING'
  }

  await db
    .update(demo_runs)
    .set({
      events: updatedEvents,
      status: newStatus,
      finished_at: finishedAt,
    })
    .where(eq(demo_runs.id, runId))
}

/**
 * Background worker handler for DEMO_STEP jobs.
 * Idempotently executes scenario step, manages polling, or triggers next step.
 */
export async function handleDemoStep(payload: {
  run_id: string
  step: number
  data?: Record<string, unknown>
}): Promise<void> {
  const { run_id: runId, step, data = {} } = payload
  const db = getDb()

  const [run] = await db.select().from(demo_runs).where(eq(demo_runs.id, runId)).limit(1)
  if (!run || run.status === 'DONE' || run.status === 'FAILED') {
    return
  }

  // Check 15-minute wait timeout
  const elapsedMs = Date.now() - new Date(run.created_at).getTime()
  const maxWaitMs = 15 * 60 * 1000

  if (run.status === 'WAITING_FOR_BUYER' && elapsedMs > maxWaitMs) {
    await emit(runId, {
      actor: 'protocol',
      kind: 'error',
      text: 'Timed out waiting for buyer action after 15 minutes',
      data: { code: 'TIMEOUT_WAITING_FOR_BUYER' },
    })
    return
  }

  const scenario = getScenario(run.scenario)
  if (!scenario) {
    await emit(runId, {
      actor: 'protocol',
      kind: 'error',
      text: `Scenario ${run.scenario} not registered in runner`,
    })
    return
  }

  // If past final step
  if (step >= scenario.steps.length) {
    await emit(runId, {
      actor: 'protocol',
      kind: 'done',
      text: `Scenario ${scenario.title} completed successfully`,
    })
    return
  }

  const currentStep = scenario.steps[step]
  if (!currentStep) return

  // Build context
  const { client: buyerClient } = await getAgentClient('buyer_agent')
  const { client: workerClient } = await getAgentClient('worker_agent')

  const ctx: ScenarioContext = {
    runId,
    scenarioName: run.scenario,
    userId: run.created_by || '',
    contractId: (data.contractId as string) || run.contract_id || undefined,
    buyerClient,
    workerClient,
    data: { ...data },
    emit: (ev) => emit(runId, ev),
  }

  try {
    const result: StepResult = await currentStep.run(ctx)

    // Update contract_id if discovered
    if (ctx.contractId && ctx.contractId !== run.contract_id) {
      await db
        .update(demo_runs)
        .set({ contract_id: ctx.contractId })
        .where(eq(demo_runs.id, runId))
    }

    if (result.next === 'continue') {
      // Re-enable RUNNING if was WAITING
      if (run.status === 'WAITING_FOR_BUYER') {
        await db
          .update(demo_runs)
          .set({ status: 'RUNNING' })
          .where(eq(demo_runs.id, runId))
      }

      // Small readable pacing delay between agent steps (e.g. 500ms)
      await new Promise((r) => setTimeout(r, 400))

      // Enqueue next step
      const nextStepIndex = step + 1
      await enqueueJob(
        db,
        'DEMO_STEP',
        {
          run_id: runId,
          step: nextStepIndex,
          data: ctx.data,
        },
        { dedupeKey: `demo:${runId}:${nextStepIndex}` }
      )
    } else if (result.next === 'wait') {
      // Check 15-minute wait timeout
      const elapsedMs = Date.now() - new Date(run.created_at).getTime()
      const maxWaitMs = 15 * 60 * 1000

      if (elapsedMs > maxWaitMs) {
        await emit(runId, {
          actor: 'protocol',
          kind: 'error',
          text: 'Timed out waiting for buyer action after 15 minutes',
          data: { code: 'TIMEOUT_WAITING_FOR_BUYER' },
        })
        return
      }

      // Re-enqueue same step to poll after delay
      const pollDelay = result.pollDelayMs || 3000
      await enqueueJob(
        db,
        'DEMO_STEP',
        {
          run_id: runId,
          step,
          data: ctx.data,
        },
        {
          runAt: new Date(Date.now() + pollDelay),
          dedupeKey: `demo:${runId}:${step}:${Date.now()}`,
        }
      )
    } else if (result.next === 'done') {
      await emit(runId, {
        actor: 'protocol',
        kind: 'done',
        text: `Scenario ${scenario.title} finished`,
        data: ctx.data,
      })
    }
  } catch (err: any) {
    log.error({ err, runId, step, scenario: run.scenario }, 'Error executing scenario step')
    await emit(runId, {
      actor: 'protocol',
      kind: 'error',
      text: `Step '${currentStep.name}' failed: ${err.message || 'Unknown error'}`,
      data: { error: err.message, stack: err.stack },
    })
  }
}

/**
 * Periodic sweep for orphan/stuck demo runs (> 30 min old).
 */
export async function sweepOrphanRuns(): Promise<number> {
  const db = getDb()
  const cutoff = new Date(Date.now() - 30 * 60 * 1000)

  const updated = await db
    .update(demo_runs)
    .set({
      status: 'FAILED',
      finished_at: new Date(),
    })
    .where(
      and(
        inArray(demo_runs.status, ['RUNNING', 'WAITING_FOR_BUYER']),
        lt(demo_runs.created_at, cutoff)
      )
    )
    .returning()

  return updated.length
}
