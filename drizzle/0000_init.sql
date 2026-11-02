-- Phase 2 Initial Schema Migration (data-model.md §2–§3)

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM (
    'DRAFT', 'PROPOSED', 'ACCEPTED', 'FUNDING', 'FUNDED',
    'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE milestone_status AS ENUM (
    'PENDING', 'SUBMITTED', 'VERIFYING', 'PASSED', 'REJECTED',
    'ESCALATED', 'RELEASING', 'RELEASED', 'RELEASE_FAILED', 'FAILED_FINAL', 'VOIDED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE criterion_type AS ENUM ('deterministic', 'rubric', 'human');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE verification_decision AS ENUM ('PASS', 'REJECT', 'ESCALATE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE job_type AS ENUM (
    'VERIFY_SUBMISSION', 'RELEASE_MILESTONE', 'AUTO_RELEASE',
    'REAUTH_CHECK', 'RECONCILE_PAYPAL', 'EXPIRE_CONTRACT', 'PURGE_DEMO_DATA', 'DEMO_STEP', 'VOID_REMAINING'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3.1 users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  role user_role NOT NULL,
  is_agent boolean NOT NULL DEFAULT false,
  persona_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.2 api_keys
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prefix text NOT NULL,
  hash text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

-- 3.3 contracts
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES users(id),
  seller_id uuid REFERENCES users(id),
  title text NOT NULL,
  status contract_status NOT NULL DEFAULT 'DRAFT',
  contract_json jsonb NOT NULL,
  contract_hash text,
  lint_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  total_minor integer NOT NULL CHECK (total_minor BETWEEN 0 AND 50000),
  paypal_order_id text UNIQUE,
  authorization_id text UNIQUE,
  auth_created_at timestamptz,
  honor_until timestamptz,
  auth_expires_at timestamptz,
  funded_at timestamptz,
  funding_at_risk boolean NOT NULL DEFAULT false,
  chaos_mock_code text,
  demo_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

-- 3.4 milestones
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  milestone_key text NOT NULL,
  idx smallint NOT NULL,
  title text NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  due_in_days smallint NOT NULL CHECK (due_in_days BETWEEN 1 AND 28),
  due_at timestamptz,
  status milestone_status NOT NULL DEFAULT 'PENDING',
  revisions_used smallint NOT NULL DEFAULT 0,
  max_revisions smallint NOT NULL DEFAULT 2,
  deliverable_json jsonb NOT NULL,
  capture_id text,
  captured_at timestamptz,
  release_attempts smallint NOT NULL DEFAULT 0,
  escalated_at timestamptz,
  auto_release_at timestamptz,
  CONSTRAINT milestones_contract_key UNIQUE(contract_id, milestone_key),
  CONSTRAINT milestones_contract_idx UNIQUE(contract_id, idx),
  CONSTRAINT capture_only_when_releasing CHECK (
    capture_id IS NULL OR status IN ('RELEASING', 'RELEASED', 'RELEASE_FAILED')
  )
);

-- 3.5 criteria
CREATE TABLE IF NOT EXISTS criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  criterion_key text NOT NULL,
  type criterion_type NOT NULL,
  required boolean NOT NULL DEFAULT true,
  check_name text,
  spec_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  statement text,
  pass_threshold numeric(3, 2),
  context_milestones text[],
  CONSTRAINT criteria_milestone_key UNIQUE(milestone_id, criterion_key)
);

-- 3.6 submissions
CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  attempt smallint NOT NULL,
  submitted_by uuid NOT NULL REFERENCES users(id),
  content_type text NOT NULL,
  content_text text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 1048576),
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT submissions_milestone_attempt UNIQUE(milestone_id, attempt)
);

-- 3.7 verifications
CREATE TABLE IF NOT EXISTS verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'RUNNING',
  decision verification_decision,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  stage1_results jsonb,
  stage2_results jsonb,
  stage3_results jsonb,
  confidence numeric(3, 2),
  manipulation_severity text,
  degraded boolean NOT NULL DEFAULT false,
  cache_hit boolean NOT NULL DEFAULT false,
  model text,
  prompt_version text,
  latency_ms integer,
  input_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- 3.8 ledger_events
CREATE TABLE IF NOT EXISTS ledger_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  type text NOT NULL,
  actor_type text NOT NULL,
  actor_id text,
  payload jsonb NOT NULL,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT ledger_events_contract_seq UNIQUE(contract_id, seq)
);

-- 3.9 paypal_events
CREATE TABLE IF NOT EXISTS paypal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  resource_id text,
  contract_id uuid REFERENCES contracts(id),
  raw jsonb NOT NULL,
  signature_valid boolean NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.10 jobs
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type job_type NOT NULL,
  payload jsonb NOT NULL,
  status job_status NOT NULL DEFAULT 'PENDING',
  run_at timestamptz NOT NULL DEFAULT now(),
  attempts smallint NOT NULL DEFAULT 0,
  max_attempts smallint NOT NULL DEFAULT 5,
  locked_at timestamptz,
  last_error text,
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- 3.11 llm_calls
CREATE TABLE IF NOT EXISTS llm_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id uuid REFERENCES verifications(id),
  stage smallint NOT NULL,
  model text NOT NULL,
  prompt_tokens integer NOT NULL,
  completion_tokens integer NOT NULL,
  cost_micro_usd integer NOT NULL,
  latency_ms integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.12 demo_runs
CREATE TABLE IF NOT EXISTS demo_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario text NOT NULL,
  status text NOT NULL,
  contract_id uuid REFERENCES contracts(id),
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- 3.13 disputes
CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id),
  milestone_id uuid REFERENCES milestones(id),
  paypal_dispute_id text NOT NULL UNIQUE,
  status text NOT NULL,
  evidence_submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
