/**
 * Model token pricing and micro-USD cost calculations.
 * Implements phase-3-auth-and-contracts.md §3.5 & ai-pipeline.md §2.
 */

export interface ModelPricing {
  inputPerMillionUsd: number
  outputPerMillionUsd: number
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 3.5 Sonnet / 4.5
  'claude-sonnet-4-5': {
    inputPerMillionUsd: 3.0,
    outputPerMillionUsd: 15.0,
  },
  'claude-3-5-sonnet-20241022': {
    inputPerMillionUsd: 3.0,
    outputPerMillionUsd: 15.0,
  },
  // Claude 3.5 Haiku / 4.5
  'claude-haiku-4-5': {
    inputPerMillionUsd: 0.8,
    outputPerMillionUsd: 4.0,
  },
  'claude-3-5-haiku-20241022': {
    inputPerMillionUsd: 0.8,
    outputPerMillionUsd: 4.0,
  },
  // Groq Fast LPUs
  'qwen/qwen3.8-27b': {
    inputPerMillionUsd: 0.35,
    outputPerMillionUsd: 0.7,
  },
  'groq-fast': {
    inputPerMillionUsd: 0.35,
    outputPerMillionUsd: 0.7,
  },
}

/**
 * Calculate cost in integer micro-USD (1 USD = 1,000,000 micro-USD).
 */
export function costMicroUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['claude-sonnet-4-5']!
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillionUsd
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillionUsd
  return Math.round((inputCost + outputCost) * 1_000_000)
}
