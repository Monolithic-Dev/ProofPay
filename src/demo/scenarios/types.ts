/**
 * Scenario Types & Context Definitions — implements phase-7-agents-judge-mode-mcp.md §7.3.
 */
import type { ApiClient } from '@/shared/api-client'

export type DemoActor = 'buyer_agent' | 'worker_agent' | 'protocol' | 'human'
export type DemoEventKind = 'message' | 'step' | 'waiting' | 'error' | 'done'

export interface DemoEvent {
  actor: DemoActor
  kind: DemoEventKind
  text: string
  data?: Record<string, unknown>
  t?: string
}

export type StepNextAction = 'continue' | 'wait' | 'done'

export interface StepResult {
  next: StepNextAction
  note?: string
  pollDelayMs?: number
}

export interface ScenarioContext {
  runId: string
  scenarioName: string
  userId: string
  contractId?: string
  buyerClient: ApiClient
  workerClient: ApiClient
  data: Record<string, unknown>
  emit: (event: Omit<DemoEvent, 't'>) => Promise<void>
}

export interface ScenarioStep {
  name: string
  run: (ctx: ScenarioContext) => Promise<StepResult>
}

export interface ScenarioDefinition {
  name: string
  title: string
  description: string
  steps: ScenarioStep[]
}
