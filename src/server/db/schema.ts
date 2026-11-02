/**
 * Drizzle ORM schema — implements data-model.md §2–§3.
 * All tables use snake_case, all money in integer minor units.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  smallint,
  numeric,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const userRoleEnum = pgEnum('user_role', ['buyer', 'seller', 'admin'])

export const contractStatusEnum = pgEnum('contract_status', [
  'DRAFT',
  'PROPOSED',
  'ACCEPTED',
  'FUNDING',
  'FUNDED',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
])

export const milestoneStatusEnum = pgEnum('milestone_status', [
  'PENDING',
  'SUBMITTED',
  'VERIFYING',
  'PASSED',
  'REJECTED',
  'ESCALATED',
  'RELEASING',
  'RELEASED',
  'RELEASE_FAILED',
  'FAILED_FINAL',
  'VOIDED',
])

export const criterionTypeEnum = pgEnum('criterion_type', [
  'deterministic',
  'rubric',
  'human',
])

export const verificationDecisionEnum = pgEnum('verification_decision', [
  'PASS',
  'REJECT',
  'ESCALATE',
])

export const jobTypeEnum = pgEnum('job_type', [
  'VERIFY_SUBMISSION',
  'RELEASE_MILESTONE',
  'AUTO_RELEASE',
  'REAUTH_CHECK',
  'RECONCILE_PAYPAL',
  'EXPIRE_CONTRACT',
  'PURGE_DEMO_DATA',
  'DEMO_STEP',
  'VOID_REMAINING', // C-5: added per spec correction
])

export const jobStatusEnum = pgEnum('job_status', [
  'PENDING',
  'RUNNING',
  'DONE',
  'FAILED',
])

// ---------------------------------------------------------------------------
// 3.1 users
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  display_name: text('display_name').notNull(),
  role: userRoleEnum('role').notNull(),
  is_agent: boolean('is_agent').notNull().default(false),
  persona_key: text('persona_key').unique(), // 'buyer','seller','buyer_agent','worker_agent'
  created_at: timestamptz('created_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// 3.2 api_keys
// ---------------------------------------------------------------------------
export const api_keys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    key_prefix: text('key_prefix').notNull(), // first 8 chars shown in UI
    key_hash: text('key_hash').notNull(), // sha256 hex of full secret
    label: text('label').notNull(),
    last_used_at: timestamptz('last_used_at'),
    revoked_at: timestamptz('revoked_at'),
    created_at: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('api_keys_hash_idx').on(t.key_hash)]
)

// ---------------------------------------------------------------------------
// 3.3 contracts
// ---------------------------------------------------------------------------
export const contracts = pgTable(
  'contracts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    buyer_id: uuid('buyer_id')
      .notNull()
      .references(() => users.id),
    seller_id: uuid('seller_id').references(() => users.id),
    title: text('title').notNull(),
    status: contractStatusEnum('status').notNull().default('DRAFT'),
    contract_json: jsonb('contract_json').notNull(),
    contract_hash: text('contract_hash'),
    lint_json: jsonb('lint_json').notNull().default(sql`'{"issues":[]}'`),
    version: integer('version').notNull().default(1),
    currency: text('currency').notNull().default('USD'),
    total_minor: integer('total_minor').notNull(),
    paypal_order_id: text('paypal_order_id'),
    authorization_id: text('authorization_id'),
    auth_created_at: timestamptz('auth_created_at'),
    honor_until: timestamptz('honor_until'),
    auth_expires_at: timestamptz('auth_expires_at'),
    funded_at: timestamptz('funded_at'),
    funding_at_risk: boolean('funding_at_risk').notNull().default(false),
    chaos_mock_code: text('chaos_mock_code'),
    demo_run_id: uuid('demo_run_id'),
    created_at: timestamptz('created_at').notNull().defaultNow(),
    updated_at: timestamptz('updated_at').notNull().defaultNow(),
    accepted_at: timestamptz('accepted_at'),
    completed_at: timestamptz('completed_at'),
  },
  (t) => [
    index('contracts_buyer_idx').on(t.buyer_id, t.created_at),
    index('contracts_seller_idx').on(t.seller_id, t.created_at),
    index('contracts_status_idx').on(t.status),
  ]
)

// ---------------------------------------------------------------------------
// 3.4 milestones
// ---------------------------------------------------------------------------
export const milestones = pgTable(
  'milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contract_id: uuid('contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'cascade' }),
    milestone_key: text('milestone_key').notNull(), // 'm1','m2',…
    idx: smallint('idx').notNull(), // 1-based order
    title: text('title').notNull(),
    amount_minor: integer('amount_minor').notNull(),
    due_in_days: smallint('due_in_days').notNull(),
    due_at: timestamptz('due_at'),
    status: milestoneStatusEnum('status').notNull().default('PENDING'),
    revisions_used: smallint('revisions_used').notNull().default(0),
    max_revisions: smallint('max_revisions').notNull().default(2),
    deliverable_json: jsonb('deliverable_json').notNull(),
    capture_id: text('capture_id'),
    captured_at: timestamptz('captured_at'),
    release_attempts: smallint('release_attempts').notNull().default(0),
    escalated_at: timestamptz('escalated_at'),
    auto_release_at: timestamptz('auto_release_at'),
  },
  (t) => [
    uniqueIndex('milestones_contract_key_idx').on(t.contract_id, t.milestone_key),
    uniqueIndex('milestones_contract_idx_idx').on(t.contract_id, t.idx),
    index('milestones_status_idx').on(t.status),
    index('milestones_auto_release_idx').on(t.auto_release_at),
  ]
)

// ---------------------------------------------------------------------------
// 3.5 criteria
// ---------------------------------------------------------------------------
export const criteria = pgTable(
  'criteria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    milestone_id: uuid('milestone_id')
      .notNull()
      .references(() => milestones.id, { onDelete: 'cascade' }),
    criterion_key: text('criterion_key').notNull(), // 'c1'…
    type: criterionTypeEnum('type').notNull(),
    required: boolean('required').notNull().default(true),
    check_name: text('check_name'), // deterministic only
    spec_json: jsonb('spec_json').notNull().default(sql`'{}'`),
    statement: text('statement'), // rubric or human
    pass_threshold: numeric('pass_threshold', { precision: 3, scale: 2 }),
    context_milestones: text('context_milestones').array(),
  },
  (t) => [
    uniqueIndex('criteria_milestone_key_idx').on(t.milestone_id, t.criterion_key),
  ]
)

// ---------------------------------------------------------------------------
// 3.6 submissions
// ---------------------------------------------------------------------------
export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    milestone_id: uuid('milestone_id')
      .notNull()
      .references(() => milestones.id, { onDelete: 'cascade' }),
    attempt: smallint('attempt').notNull(), // 1-based
    submitted_by: uuid('submitted_by')
      .notNull()
      .references(() => users.id),
    content_type: text('content_type').notNull(),
    content_text: text('content_text').notNull(),
    size_bytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    note: text('note'),
    created_at: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('submissions_milestone_attempt_idx').on(t.milestone_id, t.attempt),
  ]
)

// ---------------------------------------------------------------------------
// 3.7 verifications
// ---------------------------------------------------------------------------
export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submission_id: uuid('submission_id')
      .notNull()
      .unique()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    status: text('status').notNull(), // 'RUNNING'|'COMPLETE'|'FAILED'
    decision: verificationDecisionEnum('decision'),
    reasons: jsonb('reasons').notNull().default(sql`'[]'`),
    stage1_json: jsonb('stage1_json'),
    stage2_json: jsonb('stage2_json'),
    stage3_json: jsonb('stage3_json'),
    confidence: numeric('confidence', { precision: 3, scale: 2 }),
    manipulation_severity: text('manipulation_severity'),
    degraded: boolean('degraded').notNull().default(false),
    cache_hit: boolean('cache_hit').notNull().default(false),
    model: text('model'),
    model_fast: text('model_fast'),
    prompt_version: text('prompt_version'),
    input_hash: text('input_hash'),
    latency_ms: integer('latency_ms'),
    created_at: timestamptz('created_at').notNull().defaultNow(),
    completed_at: timestamptz('completed_at'),
  },
  (t) => [index('verifications_input_hash_idx').on(t.input_hash)]
)

// ---------------------------------------------------------------------------
// 3.8 ledger_events (append-only, hash-chained)
// ---------------------------------------------------------------------------
export const ledger_events = pgTable(
  'ledger_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contract_id: uuid('contract_id')
      .notNull()
      .references(() => contracts.id),
    seq: integer('seq').notNull(), // 1-based per contract
    type: text('type').notNull(),
    actor_type: text('actor_type').notNull(),
    actor_id: uuid('actor_id'),
    payload: jsonb('payload').notNull(),
    prev_hash: text('prev_hash').notNull(),
    hash: text('hash').notNull(),
    created_at: timestamptz('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('ledger_contract_seq_idx').on(t.contract_id, t.seq),
    index('ledger_contract_idx').on(t.contract_id, t.seq),
  ]
)

// ---------------------------------------------------------------------------
// 3.9 paypal_events
// ---------------------------------------------------------------------------
export const paypal_events = pgTable('paypal_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  event_id: text('event_id').notNull().unique(),
  event_type: text('event_type').notNull(),
  resource_id: text('resource_id'),
  contract_id: uuid('contract_id').references(() => contracts.id),
  raw: jsonb('raw').notNull(),
  signature_valid: boolean('signature_valid').notNull(),
  processed_at: timestamptz('processed_at'),
  created_at: timestamptz('created_at').notNull().defaultNow(),
})
export const paypalEvents = paypal_events

// ---------------------------------------------------------------------------
// 3.10 jobs (transactional outbox)
// ---------------------------------------------------------------------------
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: jobTypeEnum('type').notNull(),
    payload: jsonb('payload').notNull(),
    status: jobStatusEnum('status').notNull().default('PENDING'),
    run_at: timestamptz('run_at').notNull().defaultNow(),
    attempts: smallint('attempts').notNull().default(0),
    max_attempts: smallint('max_attempts').notNull().default(5),
    locked_at: timestamptz('locked_at'),
    last_error: text('last_error'),
    dedupe_key: text('dedupe_key').unique(),
    created_at: timestamptz('created_at').notNull().defaultNow(),
    finished_at: timestamptz('finished_at'),
  },
  (t) => [index('jobs_poll_idx').on(t.run_at)]
)

// ---------------------------------------------------------------------------
// 3.11 llm_calls
// ---------------------------------------------------------------------------
export const llm_calls = pgTable(
  'llm_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purpose: text('purpose').notNull(),
    model: text('model').notNull(),
    input_tokens: integer('input_tokens').notNull(),
    output_tokens: integer('output_tokens').notNull(),
    cost_micro_usd: integer('cost_micro_usd').notNull(),
    cache_hit: boolean('cache_hit').notNull().default(false),
    contract_id: uuid('contract_id'),
    created_at: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('llm_calls_day_idx').on(t.created_at)]
)

// ---------------------------------------------------------------------------
// 3.12 demo_runs
// ---------------------------------------------------------------------------
export const demo_runs = pgTable('demo_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  scenario: text('scenario').notNull(),
  status: text('status').notNull(),
  contract_id: uuid('contract_id').references(() => contracts.id),
  events: jsonb('events').notNull().default(sql`'[]'`),
  created_by: uuid('created_by').references(() => users.id),
  created_at: timestamptz('created_at').notNull().defaultNow(),
  finished_at: timestamptz('finished_at'),
})

// ---------------------------------------------------------------------------
// 3.13 disputes [C]
// ---------------------------------------------------------------------------
export const disputes = pgTable('disputes', {
  id: uuid('id').primaryKey().defaultRandom(),
  contract_id: uuid('contract_id')
    .notNull()
    .references(() => contracts.id),
  milestone_id: uuid('milestone_id').references(() => milestones.id),
  paypal_dispute_id: text('paypal_dispute_id').notNull().unique(),
  status: text('status').notNull(),
  evidence_submitted_at: timestamptz('evidence_submitted_at'),
  created_at: timestamptz('created_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// C-1: idempotency_keys table
// ---------------------------------------------------------------------------
export const idempotency_keys = pgTable('idempotency_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id),
  route: text('route').notNull(),
  key: text('key').notNull().unique(),
  request_hash: text('request_hash').notNull(),
  response_status: integer('response_status').notNull(),
  response_body: jsonb('response_body').notNull(),
  created_at: timestamptz('created_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// C-2: kv store for worker heartbeat and misc
// ---------------------------------------------------------------------------
export const kv = pgTable('kv', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updated_at: timestamptz('updated_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Contract = typeof contracts.$inferSelect
export type ContractRow = Contract
export type NewContract = typeof contracts.$inferInsert
export type Milestone = typeof milestones.$inferSelect
export type MilestoneRow = Milestone
export type NewMilestone = typeof milestones.$inferInsert
export type Criterion = typeof criteria.$inferSelect
export type CriterionRow = Criterion
export type NewCriterion = typeof criteria.$inferInsert
export type Submission = typeof submissions.$inferSelect
export type SubmissionRow = Submission
export type NewSubmission = typeof submissions.$inferInsert
export type Verification = typeof verifications.$inferSelect
export type VerificationRow = Verification
export type NewVerification = typeof verifications.$inferInsert
export type LedgerEvent = typeof ledger_events.$inferSelect
export type NewLedgerEvent = typeof ledger_events.$inferInsert
export type PaypalEvent = typeof paypal_events.$inferSelect
export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert
export type LlmCall = typeof llm_calls.$inferSelect
export type LlmCallRow = LlmCall
export type NewLlmCall = typeof llm_calls.$inferInsert
export type DemoRun = typeof demo_runs.$inferSelect
export type Dispute = typeof disputes.$inferSelect
export type IdempotencyKey = typeof idempotency_keys.$inferSelect
export type Kv = typeof kv.$inferSelect
