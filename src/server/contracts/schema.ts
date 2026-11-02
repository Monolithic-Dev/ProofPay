/**
 * Canonical Contract JSON schema — Zod source of truth.
 * Implements data-model.md §4 & phase-3-auth-and-contracts.md §3.4.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Deterministic criterion specs
// ---------------------------------------------------------------------------
export const JsonSchemaSpec = z.object({
  schema_ref: z.literal('product_v1'),
})

export const RowCountSpec = z.object({
  min: z.number().int().positive().optional(),
  max: z.number().int().positive().optional(),
})

export const UniqueFieldSpec = z.object({
  field: z.string().min(1),
})

export const RegexFieldSpec = z.object({
  field: z.string().min(1),
  pattern: z.enum(['email', 'url', 'sku']), // named patterns only (ReDoS-safe)
})

export const WordCountSpec = z.object({
  min: z.number().int().positive().optional(),
  max: z.number().int().positive().optional(),
})

export const KeywordsSpec = z.object({
  keywords: z.array(z.string().min(1)).min(1),
  mode: z.enum(['all', 'any']),
  case_sensitive: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// Criterion variants
// ---------------------------------------------------------------------------
const DeterministicCriterion = z.object({
  key: z.string().regex(/^c[1-9]\d*$/, 'criterion key must be c1, c2, …'),
  type: z.literal('deterministic'),
  required: z.boolean(),
  description: z.string().min(1).max(300),
  check: z.enum([
    'json_schema',
    'row_count',
    'unique_field',
    'regex_field',
    'word_count',
    'required_keywords',
  ]),
  spec: z.union([JsonSchemaSpec, RowCountSpec, UniqueFieldSpec, RegexFieldSpec, WordCountSpec, KeywordsSpec]),
})

const RubricCriterion = z.object({
  key: z.string().regex(/^c[1-9]\d*$/),
  type: z.literal('rubric'),
  required: z.boolean(),
  statement: z.string().min(1).max(300),
  pass_threshold: z.number().min(0.5).max(1.0).default(0.7),
  context_milestones: z.array(z.string()).optional(),
})

const HumanCriterion = z.object({
  key: z.string().regex(/^c[1-9]\d*$/),
  type: z.literal('human'),
  required: z.literal(true), // human criteria are always required
  statement: z.string().min(1).max(300),
})

export const Criterion = z.discriminatedUnion('type', [
  DeterministicCriterion,
  RubricCriterion,
  HumanCriterion,
])
export type Criterion = z.infer<typeof Criterion>

// ---------------------------------------------------------------------------
// Milestone
// ---------------------------------------------------------------------------
export const Milestone = z.object({
  key: z.string().regex(/^m[1-5]$/, 'milestone key must be m1–m5'),
  title: z.string().min(1).max(120),
  amount_minor: z.number().int().positive(),
  due_in_days: z.number().int().min(1).max(28),
  deliverable: z.object({
    content_type: z.enum(['json_records', 'text']),
    max_bytes: z.number().int().positive().max(1_048_576),
    description: z.string().max(300),
  }),
  criteria: z
    .array(Criterion)
    .min(1, 'at least one criterion is required')
    .refine(
      (crit) => crit.some((c) => c.required),
      'at least one criterion must be required'
    )
    .refine(
      (crit) => {
        const keys = crit.map((c) => c.key)
        return new Set(keys).size === keys.length
      },
      'criteria keys must be unique within a milestone'
    ),
})
export type Milestone = z.infer<typeof Milestone>

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------
export const DEFAULT_POLICY = {
  max_revisions: 2,
  auto_release_hours: 48,
  on_final_failure: 'void_remaining' as const,
  verifier_confidence_min: 0.6,
}

export const Policy = z.object({
  max_revisions: z.number().int().min(0).max(3).default(DEFAULT_POLICY.max_revisions),
  auto_release_hours: z.number().int().min(1).max(168).default(DEFAULT_POLICY.auto_release_hours),
  on_final_failure: z.literal('void_remaining'),
  verifier_confidence_min: z.number().min(0.5).max(0.95).default(DEFAULT_POLICY.verifier_confidence_min),
})
export type Policy = z.infer<typeof Policy>

// ---------------------------------------------------------------------------
// Contract (root)
// ---------------------------------------------------------------------------
export const ContractSchema = z
  .object({
    schema_version: z.literal(1),
    title: z.string().min(5).max(120),
    summary: z.string().max(500),
    currency: z.literal('USD'),
    total_minor: z
      .number()
      .int()
      .min(1)
      .max(50_000, 'maximum contract value is $500.00'),
    milestones: z
      .array(Milestone)
      .min(1)
      .max(5, 'maximum 5 milestones'),
    policy: Policy.default(DEFAULT_POLICY),
  })
  .superRefine((contract, ctx) => {
    // 1. Check sum of milestone amounts equals total_minor
    const sum = contract.milestones.reduce((acc, m) => acc + m.amount_minor, 0)
    if (sum !== contract.total_minor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `total_minor (${contract.total_minor}) must equal sum of milestone amounts (${sum})`,
        path: ['total_minor'],
      })
    }

    // 2. Check milestone keys are strictly ordered m1, m2, ..., mn
    contract.milestones.forEach((m, idx) => {
      const expectedKey = `m${idx + 1}`
      if (m.key !== expectedKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `milestone at index ${idx} must have key '${expectedKey}', got '${m.key}'`,
          path: ['milestones', idx, 'key'],
        })
      }
    })

    // 3. Check context_milestones reference only earlier milestones
    contract.milestones.forEach((m, idx) => {
      m.criteria.forEach((crit, cIdx) => {
        if ('context_milestones' in crit && crit.context_milestones) {
          const earlierKeys = contract.milestones.slice(0, idx).map((em) => em.key)
          for (const ref of crit.context_milestones) {
            if (!earlierKeys.includes(ref)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `context_milestones can only reference earlier milestones. '${ref}' is invalid for '${m.key}'`,
                path: ['milestones', idx, 'criteria', cIdx, 'context_milestones'],
              })
            }
          }
        }
      })
    })
  })

export type Contract = z.infer<typeof ContractSchema>
export type ContractSchema = Contract

export function parseContract(data: unknown): Contract {
  return ContractSchema.parse(data)
}
