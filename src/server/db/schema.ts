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
    buyer_org_id: uuid('buyer_org_id'),
    seller_org_id: uuid('seller_org_id'),
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
// 3.12.1 demo_pool (AIP-13: Pre-authorized demo contracts for 90s express judge lane)
// ---------------------------------------------------------------------------
export const demo_pool = pgTable('demo_pool', {
  id: uuid('id').primaryKey().defaultRandom(),
  contract_id: uuid('contract_id').references(() => contracts.id).notNull(),
  status: text('status').notNull().default('AVAILABLE'), // AVAILABLE | IN_USE | CONSUMED
  authorization_expires_at: timestamptz('authorization_expires_at'),
  claimed_by: uuid('claimed_by').references(() => users.id),
  claimed_at: timestamptz('claimed_at'),
  created_at: timestamptz('created_at').notNull().defaultNow(),
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
// 3.14 organizations (v2)
// ---------------------------------------------------------------------------
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo_url: text('logo_url'),
  funding_approval_threshold_minor: integer('funding_approval_threshold_minor'),
  members_can_accept_contracts: boolean('members_can_accept_contracts').notNull().default(false),
  default_auto_release_hours: integer('default_auto_release_hours').notNull().default(48),
  created_at: timestamptz('created_at').notNull().defaultNow(),
  updated_at: timestamptz('updated_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// 3.15 org_members (v2 RBAC)
// ---------------------------------------------------------------------------
export const org_members = pgTable(
  'org_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // 'owner' | 'admin' | 'finance' | 'member' | 'viewer'
    created_at: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('org_members_org_user_uniq').on(t.org_id, t.user_id),
    index('org_members_user_idx').on(t.user_id),
  ]
)

// ---------------------------------------------------------------------------
// 3.16 org_invitations (v2)
// ---------------------------------------------------------------------------
export const org_invitations = pgTable('org_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull().default('member'),
  token_hash: text('token_hash').notNull().unique(),
  invited_by_id: uuid('invited_by_id')
    .notNull()
    .references(() => users.id),
  expires_at: timestamptz('expires_at').notNull(),
  accepted_at: timestamptz('accepted_at'),
  created_at: timestamptz('created_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// 3.17 contract_comments (v2 Collaboration)
// ---------------------------------------------------------------------------
export const contract_comments = pgTable(
  'contract_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contract_id: uuid('contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'cascade' }),
    milestone_id: uuid('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    created_at: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('contract_comments_contract_idx').on(t.contract_id, t.created_at)]
)

// ---------------------------------------------------------------------------
// 3.18 contract_invitations (v2 Counterparties)
// ---------------------------------------------------------------------------
export const contract_invitations = pgTable('contract_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  contract_id: uuid('contract_id')
    .notNull()
    .references(() => contracts.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull().default('seller'),
  token_hash: text('token_hash').notNull().unique(),
  expires_at: timestamptz('expires_at').notNull(),
  accepted_at: timestamptz('accepted_at'),
  created_at: timestamptz('created_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// 3.19 audit_events (v2 Org Activity & Governance)
// ---------------------------------------------------------------------------
export const audit_events = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
    actor_type: text('actor_type').notNull(),
    actor_id: text('actor_id').notNull(),
    action: text('action').notNull(),
    target_type: text('target_type'),
    target_id: text('target_id'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    ip: text('ip'),
    user_agent: text('user_agent'),
    request_id: text('request_id'),
    created_at: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('audit_events_org_idx').on(t.org_id, t.created_at)]
)

// ---------------------------------------------------------------------------
// 3.20 notifications (v2 In-App Alerts)
// ---------------------------------------------------------------------------
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    org_id: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    link: text('link'),
    type: text('type').notNull(),
    read_at: timestamptz('read_at'),
    created_at: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.user_id, t.read_at)]
)

// ---------------------------------------------------------------------------
// 3.21 counterparties (v2 Directory)
// ---------------------------------------------------------------------------
export const counterparties = pgTable(
  'counterparties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    notes: text('notes'),
    linked_organization_id: uuid('linked_organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('counterparties_org_email_uniq').on(t.organization_id, t.email),
    index('counterparties_org_idx').on(t.organization_id),
  ]
)

// ---------------------------------------------------------------------------
// 3.22 contract_versions (v2 Versioning)
// ---------------------------------------------------------------------------
export const contract_versions = pgTable(
  'contract_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contract_id: uuid('contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    contract_json: jsonb('contract_json').notNull(),
    contract_hash: text('contract_hash').notNull(),
    change_note: text('change_note'),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('contract_versions_contract_version_uniq').on(t.contract_id, t.version),
    index('contract_versions_contract_idx').on(t.contract_id),
  ]
)

// ---------------------------------------------------------------------------
// 3.23 funding_approvals (v2 Four-Eyes Governance)
// ---------------------------------------------------------------------------
export const funding_approvals = pgTable(
  'funding_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contract_id: uuid('contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'cascade' }),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    requested_by: uuid('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    total_minor: integer('total_minor').notNull(),
    status: text('status').notNull().default('PENDING'), // 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'
    decided_by: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decision_note: text('decision_note'),
    created_at: timestamptz('created_at').notNull().defaultNow(),
    decided_at: timestamptz('decided_at'),
  },
  (t) => [
    index('funding_approvals_contract_idx').on(t.contract_id),
    index('funding_approvals_org_idx').on(t.organization_id, t.status),
  ]
)

// ---------------------------------------------------------------------------
// 3.24 templates (v2 Contract Templates Library)
// ---------------------------------------------------------------------------
export const templates = pgTable(
  'templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }), // NULL = system template
    slug: text('slug'),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull(),
    contract_json: jsonb('contract_json').notNull(),
    variables: jsonb('variables').notNull().default(sql`'[]'::jsonb`),
    version: integer('version').notNull().default(1),
    is_active: boolean('is_active').notNull().default(true),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('templates_org_idx').on(t.organization_id),
    index('templates_category_idx').on(t.category),
  ]
)

// ---------------------------------------------------------------------------
// 3.25 service_accounts (v2 AI Agents & Machine Identities)
// ---------------------------------------------------------------------------
export const service_accounts = pgTable(
  'service_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    scopes: jsonb('scopes').notNull().default(sql`'[]'::jsonb`),
    max_contract_total_minor: integer('max_contract_total_minor'),
    max_open_holds_minor: integer('max_open_holds_minor'),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamptz('created_at').notNull().defaultNow(),
    disabled_at: timestamptz('disabled_at'),
  },
  (t) => [
    uniqueIndex('service_accounts_org_name_uniq').on(t.organization_id, t.name),
  ]
)

// ---------------------------------------------------------------------------
// 3.26 support_tickets (v2 Customer Support)
// ---------------------------------------------------------------------------
export const support_tickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    organization_id: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    contract_id: uuid('contract_id').references(() => contracts.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull().default('OPEN'),
    created_at: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('support_tickets_status_idx').on(t.status)]
)

// ---------------------------------------------------------------------------
// 3.27 paypal_connections (v2 PayPal Merchant Connections)
// ---------------------------------------------------------------------------
export const paypal_connections = pgTable(
  'paypal_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    mode: text('mode').notNull().default('PLATFORM_ACCOUNT'),
    status: text('status').notNull().default('ACTIVE'),
    paypal_merchant_id: text('paypal_merchant_id'),
    paypal_email: text('paypal_email'),
    connected_at: timestamptz('connected_at'),
    created_at: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('paypal_connections_org_uniq').on(t.organization_id)]
)

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type OrgMember = typeof org_members.$inferSelect
export type NewOrgMember = typeof org_members.$inferInsert
export type OrgInvitation = typeof org_invitations.$inferSelect
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
export type ContractComment = typeof contract_comments.$inferSelect
export type NewContractComment = typeof contract_comments.$inferInsert
export type AuditEvent = typeof audit_events.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type Counterparty = typeof counterparties.$inferSelect
export type NewCounterparty = typeof counterparties.$inferInsert
export type ContractVersion = typeof contract_versions.$inferSelect
export type FundingApproval = typeof funding_approvals.$inferSelect
export type NewFundingApproval = typeof funding_approvals.$inferInsert
export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert
export type ServiceAccount = typeof service_accounts.$inferSelect
export type NewServiceAccount = typeof service_accounts.$inferInsert
export type SupportTicket = typeof support_tickets.$inferSelect
export type PaypalConnection = typeof paypal_connections.$inferSelect


export type DemoPool = typeof demo_pool.$inferSelect
export type NewDemoPool = typeof demo_pool.$inferInsert
