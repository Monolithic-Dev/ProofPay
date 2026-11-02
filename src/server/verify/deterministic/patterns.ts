/**
 * Named regex patterns for deterministic validation (ReDoS safe).
 * Implements data-model.md §4 & phase-4-verification-engine.md §4.2.
 */
export const NAMED_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  url: /^https?:\/\/[^\s]+$/,
  sku: /^[A-Z]{3}-\d{4}$/,
} as const

export type NamedPattern = keyof typeof NAMED_PATTERNS
