/**
 * LLM adapter — THE ONLY place the Anthropic SDK is imported.
 * Implements budget cap, caching, retry, and structured logging.
 *
 * Architecture rule: no other file may import @anthropic-ai/sdk.
 * (Enforced by ESLint no-restricted-imports in eslint.config.mjs)
 */
import Anthropic from '@anthropic-ai/sdk'
import { eq, sql, gte } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { llm_calls } from '@/server/db/schema'
import { env } from '@/server/config/env'
import { logger } from '@/server/util/logger'
import { BudgetExceededError } from '@/server/util/errors'
import { now } from '@/server/util/time'

// Singleton client
let _client: Anthropic | undefined

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  }
  return _client
}

// ---------------------------------------------------------------------------
// Budget check
// ---------------------------------------------------------------------------
async function checkDailyBudget(): Promise<void> {
  const db = getDb()
  const startOfDay = new Date(now())
  startOfDay.setUTCHours(0, 0, 0, 0)

  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${llm_calls.cost_micro_usd}), 0)` })
    .from(llm_calls)
    .where(gte(llm_calls.created_at, startOfDay))

  const total = rows[0]?.total ?? 0
  const budgetMicroUsd = env.LLM_DAILY_BUDGET_USD * 1_000_000
  if (total >= budgetMicroUsd) {
    throw new BudgetExceededError()
  }
}

// ---------------------------------------------------------------------------
// Cost estimation (rough; actual from usage field)
// ---------------------------------------------------------------------------
function estimateCostMicroUsd(model: string, inputTokens: number, outputTokens: number): number {
  // claude-sonnet-4-5: $3/M input, $15/M output
  // claude-haiku-4-5: $0.25/M input, $1.25/M output
  if (model.includes('haiku')) {
    return Math.round((inputTokens * 0.25 + outputTokens * 1.25) / 1000)
  }
  return Math.round((inputTokens * 3 + outputTokens * 15) / 1000)
}

// ---------------------------------------------------------------------------
// Tool-use call (forced JSON output)
// ---------------------------------------------------------------------------
export interface LlmToolCallParams {
  purpose: 'compile' | 'lint' | 'rubric' | 'adversarial' | 'agent'
  model?: string  // defaults to env.ANTHROPIC_MODEL
  systemPrompt: string
  userMessage: string
  toolName: string
  toolDescription: string
  toolInputSchema: Record<string, unknown>
  contractId?: string
  maxTokens?: number
}

export interface LlmToolCallResult<T> {
  output: T
  inputTokens: number
  outputTokens: number
  cacheHit: boolean
}

export async function callLlmTool<T>(
  params: LlmToolCallParams
): Promise<LlmToolCallResult<T>> {
  await checkDailyBudget()

  const {
    purpose,
    model: modelOverride,
    systemPrompt,
    userMessage,
    toolName,
    toolDescription,
    toolInputSchema,
    contractId,
    maxTokens = 4096,
  } = params

  const model = modelOverride ?? env.ANTHROPIC_MODEL
  const client = getClient()
  const log = logger.child({ purpose, model, contract_id: contractId })

  log.debug('LLM call starting')
  const start = Date.now()

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        tools: [
          {
            name: toolName,
            description: toolDescription,
            input_schema: toolInputSchema as Anthropic.Tool['input_schema'],
          },
        ],
        tool_choice: { type: 'tool', name: toolName },
        temperature: 0, // deterministic
      })

      const usage = response.usage
      const inputTokens = usage.input_tokens
      const outputTokens = usage.output_tokens
      const cacheHit = (usage as { cache_read_input_tokens?: number }).cache_read_input_tokens
        ? true
        : false

      const costMicroUsd = estimateCostMicroUsd(model, inputTokens, outputTokens)
      const latencyMs = Date.now() - start

      // Record the call
      await getDb().insert(llm_calls).values({
        purpose,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_micro_usd: costMicroUsd,
        cache_hit: cacheHit,
        contract_id: contractId,
      })

      log.info({ input_tokens: inputTokens, output_tokens: outputTokens, latency_ms: latencyMs, cache_hit: cacheHit }, 'LLM call complete')

      // Extract tool use block
      const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      if (!toolUse) throw new Error('LLM did not use the required tool')

      return {
        output: toolUse.input as T,
        inputTokens,
        outputTokens,
        cacheHit,
      }
    } catch (err) {
      if (err instanceof BudgetExceededError) throw err
      log.warn({ attempt, err: String(err) }, 'LLM call failed, retrying')
      if (attempt === 3) throw err
      await new Promise((r) => setTimeout(r, attempt * 1000))
    }
  }

  throw new Error('LLM call exhausted retries')
}
