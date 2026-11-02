/**
 * LLM adapter — THE ONLY place the Anthropic SDK is imported.
 * Implements budget cap, caching, retry, structured logging, and fake transport.
 * Architecture rule: no other file may import @anthropic-ai/sdk.
 */
import Anthropic from '@anthropic-ai/sdk'
import { sql, gte } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { llm_calls } from '@/server/db/schema'
import { env } from '@/server/config/env'
import { logger } from '@/server/util/logger'
import { BudgetExceededError, AppError } from '@/server/util/errors'
import { now } from '@/server/util/time'
import { costMicroUsd } from '@/server/ai/pricing'
import { getLlmTransport, defaultFakeLlm, setLlmTransport } from './fake-llm'

export { setLlmTransport }

// Singleton client
let _client: Anthropic | undefined

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  }
  return _client
}

// ---------------------------------------------------------------------------
// Budget check & status
// ---------------------------------------------------------------------------
export async function getBudgetStatus(): Promise<{
  spent_usd: number
  limit_usd: number
  remaining_usd: number
  exhausted: boolean
}> {
  const db = getDb()
  const startOfDay = new Date(now())
  startOfDay.setUTCHours(0, 0, 0, 0)

  let totalMicroUsd = 0
  try {
    const rows = await db
      .select({ total: sql<number>`coalesce(sum(${llm_calls.cost_micro_usd}), 0)` })
      .from(llm_calls)
      .where(gte(llm_calls.created_at, startOfDay))

    totalMicroUsd = Number(rows[0]?.total ?? 0)
  } catch {
    // If DB is offline or table uninitialized, allow fallback
  }

  const limitUsd = env.LLM_DAILY_BUDGET_USD
  const spentUsd = totalMicroUsd / 1_000_000
  const remainingUsd = Math.max(0, limitUsd - spentUsd)
  const exhausted = spentUsd >= limitUsd

  return {
    spent_usd: Number(spentUsd.toFixed(4)),
    limit_usd: limitUsd,
    remaining_usd: Number(remainingUsd.toFixed(4)),
    exhausted,
  }
}

async function checkDailyBudget(): Promise<void> {
  const status = await getBudgetStatus()
  if (status.exhausted) {
    throw new BudgetExceededError()
  }
}

// ---------------------------------------------------------------------------
// Tool-use call (forced JSON output)
// ---------------------------------------------------------------------------
export interface CallToolParams<T> {
  purpose: string
  model?: string // defaults to env.ANTHROPIC_MODEL
  system: string
  user: string
  tool: {
    name: string
    description?: string
    input_schema: Record<string, unknown>
  }
  parse?: (raw: unknown) => T
  contractId?: string
  timeoutMs?: number
  temperature?: number
  maxTokens?: number
}

export interface CallToolResult<T> {
  data: T
  usage: {
    promptTokens: number
    completionTokens: number
    costMicroUsd: number
  }
}

export async function callTool<T>(params: CallToolParams<T>): Promise<CallToolResult<T>> {
  await checkDailyBudget()

  const {
    purpose,
    model: modelOverride,
    system,
    user,
    tool,
    parse,
    contractId,
    timeoutMs = 25000,
    temperature = 0,
  } = params

  const model = modelOverride ?? env.ANTHROPIC_MODEL
  const log = logger.child({ purpose, model, contract_id: contractId })

  // Check for test/offline fake transport
  const fakeTransport = getLlmTransport() || (process.env['LLM_TRANSPORT'] === 'fake' ? defaultFakeLlm : null)
  if (fakeTransport) {
    const res = await fakeTransport<T>({
      purpose,
      model,
      system,
      user,
      tool,
      contractId,
    })
    const data = parse ? parse(res.data) : res.data
    return {
      data,
      usage: res.usage,
    }
  }

  const client = getClient()
  let currentUserMessage = user

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      log.debug({ attempt }, 'Calling Anthropic Messages API')
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: currentUserMessage }],
        tools: [
          {
            name: tool.name,
            description: tool.description ?? '',
            input_schema: tool.input_schema as Anthropic.Tool['input_schema'],
          },
        ],
        tool_choice: { type: 'tool', name: tool.name },
        temperature,
      })

      const inputTokens = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      const microUsd = costMicroUsd(model, inputTokens, outputTokens)

      // Record telemetry in DB
      try {
        await getDb().insert(llm_calls).values({
          purpose,
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_micro_usd: microUsd,
          cache_hit: false,
          contract_id: contractId ?? null,
        })
      } catch (dbErr) {
        log.warn({ err: dbErr }, 'Could not record llm_calls telemetry row')
      }

      const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      if (!toolUse) {
        throw new Error('LLM response did not contain required tool_use block')
      }

      try {
        const validated = parse ? parse(toolUse.input) : (toolUse.input as T)
        return {
          data: validated,
          usage: {
            promptTokens: inputTokens,
            completionTokens: outputTokens,
            costMicroUsd: microUsd,
          },
        }
      } catch (parseErr: unknown) {
        if (attempt === 1) {
          log.warn('Tool payload failed parse validation; retrying once with error feedback')
          currentUserMessage = `${user}\n\n[Previous output failed schema validation: ${String(parseErr)}. Please return a strictly compliant payload.]`
          continue
        }
        throw parseErr
      }
    } catch (err: unknown) {
      if (err instanceof BudgetExceededError) throw err
      log.warn({ attempt, err: String(err) }, 'LLM call attempt failed')
      if (attempt === 2) {
        throw new AppError('UPSTREAM_LLM', `LLM service unavailable: ${String(err)}`, 502)
      }
    }
  }

  throw new AppError('UPSTREAM_LLM', 'LLM call exhausted all attempts', 502)
}

// Backwards-compatible legacy call result
export interface LegacyCallResult<T = any> {
  output: T & {
    overall_confidence?: number
    results?: Array<{
      criterion_key: string
      score: number
      evidence: string
      reason?: string
    }>
    [key: string]: any
  }
  inputTokens: number
  outputTokens: number
  cacheHit: boolean
}

// Backwards-compatible alias
export async function callLlmTool<T = any>(params: any): Promise<LegacyCallResult<T>> {
  const result = await callTool<T>({
    purpose: params.purpose,
    model: params.model,
    system: params.systemPrompt,
    user: params.userMessage,
    tool: {
      name: params.toolName,
      description: params.toolDescription,
      input_schema: params.toolInputSchema,
    },
    contractId: params.contractId,
    maxTokens: params.maxTokens,
  })

  return {
    output: result.data as any,
    inputTokens: result.usage.promptTokens,
    outputTokens: result.usage.completionTokens,
    cacheHit: false,
  }
}
