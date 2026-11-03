import { z } from 'zod'

// ---------------------------------------------------------------------------
// Strict boolean coercion: only 'true' | 'false' strings accepted
// ---------------------------------------------------------------------------
const boolEnv = z
  .union([z.literal('true'), z.literal('false')])
  .transform((v) => v === 'true')

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),

  // PayPal — must always be sandbox in this codebase
  PAYPAL_ENV: z.literal('sandbox'),
  PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_CLIENT_SECRET: z.string().min(1),
  PAYPAL_WEBHOOK_ID: z.string().optional(),

  // Anthropic & Groq
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-5'),
  ANTHROPIC_MODEL_FAST: z.string().default('claude-haiku-4-5'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('qwen/qwen3.8-27b'),
  LLM_DAILY_BUDGET_USD: z.coerce.number().positive().default(5),

  // Auth
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),

  // Demo / judge mode
  DEMO_MODE: boolEnv.default('true'),
  DEMO_TIME_SCALE: z.coerce.number().min(1).default(1),
  CHAOS_MODE: boolEnv.default('false'),

  // Contract limits
  MAX_CONTRACT_DAYS: z.coerce.number().int().min(1).max(28).default(28),

  // Data retention
  PURGE_ENABLED: boolEnv.default('false'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Process role
  RUN_ROLE: z.enum(['web', 'worker', 'mcp']).default('web'),

  // Sandbox buyer for Judge Mode automation
  SANDBOX_BUYER_EMAIL: z.string().optional(),
  SANDBOX_BUYER_PASSWORD: z.string().optional(),
})

export function parseEnv(raw: NodeJS.ProcessEnv) {
  const result = envSchema.safeParse(raw)

  if (!result.success) {
    // Print every issue with variable names only — no values (security)
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.join('.') || '(root)'
      return `  • ${path}: ${issue.message}`
    })
    console.error('❌ Environment validation failed:\n' + issues.join('\n'))
    if (raw['NODE_ENV'] === 'test' || process.env['NODE_ENV'] === 'test') {
      throw new Error('Environment validation failed:\n' + issues.join('\n'))
    }
    process.exit(1)
  }

  return result.data
}

// Singleton — parsed once at module load time
export const env = parseEnv(process.env)

export type Env = typeof env
