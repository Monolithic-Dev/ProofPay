/**
 * Canonical Contract JSON schema — Zod source of truth.
 * Implements data-model.md §4.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Deterministic criterion specs
// ---------------------------------------------------------------------------
const JsonSchemaSpec = z.object({
  schema_ref: z.literal('product_v1'),
})

const RowCountSpec = z.object({
  min: z.number().int().positive().optional(),
  max: z.number().int().positive().optional(),
})

const UniqueFieldSpec = z.object({
  field: z.string().min(1),
})

const RegexFieldSpec = z.object({
  field: z.string().min(1),
  pattern: z.enum(['email', 'url', 'sku']), // named patterns only (ReDoS-safe)
})

const WordCountSpec = z.object({
  min: z.number().int().positive().optional(),
  max: z.number().int().positive().optional(),
})

const KeywordsSpec = z.object({
  keywords: z.array(z.string()).min(1),
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
  description: z.string().min(1),
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
  statement: z.string().max(300),
  pass_threshold: z.number().min(0.5).max(1.0).default(0.7),
  context_milestones: z.array(z.string()).optional(),
})

const HumanCriterion = z.object({
  key: z.string().regex(/^c[1-9]\d*$/),
  type: z.literal('human'),
  required: z.literal(true), // human criteria are always required
  statement: z.string().min(1),
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
    max_bytes: z.number().int().max(1_048_576),
    description: z.string().max(300),
  }),
  criteria: z
    .array(Criterion)
    .min(1, 'at least one criterion is required')
    .refine(
      (crit) => crit.some((c) => c.required),
      'at least one criterion must be required'
    ),
})
export type Milestone = z.infer<typeof Milestone>

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------
export const Policy = z.object({
  max_revisions: z.number().int().min(0).max(3).default(2),
  auto_release_hours: z.number().int().min(1).max(168).default(48),
  on_final_failure: z.literal('void_remaining'),
  verifier_confidence_min: z.number().min(0.5).max(0.95).default(0.6),
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
    policy: Policy,
  })
  .refine(
    (c) => c.total_minor === c.milestones.reduce((s, m) => s + m.amount_minor, 0),
    {
      message: 'total_minor must equal the sum of all milestone amounts',
      path: ['total_minor'],
    }
  )
  .refine(
    (c) => {
      const keys = c.milestones.map((m) => m.key)
      return new Set(keys).size === keys.length
    },
    { message: 'milestone keys must be unique', path: ['milestones'] }
  )

export type ContractSchema = z.infer<typeof ContractSchema>
