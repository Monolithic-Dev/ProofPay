# ProofPay — Data Model

> Database: **Postgres 16**. ORM: Drizzle. All IDs are UUID v4 unless stated. All times are `timestamptz`. All money is **integer minor units** (cents), USD only.

## 1. Entities (one line each)

| Entity | Purpose |
|---|---|
| `users` | Humans and agents (buyers, sellers, admin); demo personas are seeded users |
| `api_keys` | Hashed API keys so agents can call the REST API and MCP |
| `contracts` | One job: the canonical contract JSON, status, and PayPal hold identifiers |
| `milestones` | Materialized from the contract at **accept**; track status, revisions, capture |
| `criteria` | Materialized acceptance criteria per milestone |
| `submissions` | Immutable deliverables (text/JSON) with SHA-256 |
| `verifications` | Result of the 4-stage pipeline for one submission |
| `ledger_events` | Append-only, hash-chained audit log per contract |
| `paypal_events` | Raw PayPal webhooks, deduplicated by event id |
| `jobs` | Transactional outbox for async work |
| `llm_calls` | Every LLM call with token and cost accounting (budget cap) |
| `demo_runs` | Scenario runs and their event stream (Judge Mode, Agent Console) |
| `disputes` | `[C]` PayPal dispute and evidence submission tracking |

## 2. Enums

```sql
CREATE TYPE user_role AS ENUM ('buyer','seller','admin');

CREATE TYPE contract_status AS ENUM
 ('DRAFT','PROPOSED','ACCEPTED','FUNDING','FUNDED','IN_PROGRESS','COMPLETED','FAILED','CANCELLED','EXPIRED');

CREATE TYPE milestone_status AS ENUM
 ('PENDING','SUBMITTED','VERIFYING','PASSED','REJECTED','ESCALATED','RELEASING','RELEASED','RELEASE_FAILED','FAILED_FINAL','VOIDED');

CREATE TYPE criterion_type AS ENUM ('deterministic','rubric','human');

CREATE TYPE verification_decision AS ENUM ('PASS','REJECT','ESCALATE');

CREATE TYPE job_type AS ENUM
 ('VERIFY_SUBMISSION','RELEASE_MILESTONE','AUTO_RELEASE','REAUTH_CHECK','RECONCILE_PAYPAL','EXPIRE_CONTRACT','PURGE_DEMO_DATA','DEMO_STEP');

CREATE TYPE job_status AS ENUM ('PENDING','RUNNING','DONE','FAILED');
```

## 3. Tables

### 3.1 `users`
```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  role          user_role NOT NULL,
  is_agent      boolean NOT NULL DEFAULT false,
  persona_key   text UNIQUE,             -- 'buyer','seller','buyer_agent','worker_agent' (demo login)
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### 3.2 `api_keys`
```sql
CREATE TABLE api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id),
  key_prefix   text NOT NULL,            -- first 8 chars shown in UI, e.g. 'pp_k_3fA9'
  key_hash     text NOT NULL,            -- sha256 hex of the full secret
  label        text NOT NULL,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX api_keys_hash_idx ON api_keys(key_hash);
```

### 3.3 `contracts`
```sql
CREATE TABLE contracts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id          uuid NOT NULL REFERENCES users(id),
  seller_id         uuid REFERENCES users(id),
  title             text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  status            contract_status NOT NULL DEFAULT 'DRAFT',
  contract_json     jsonb NOT NULL,                       -- canonical Contract (see §4); immutable once ACCEPTED
  contract_hash     text,                                  -- sha256 hex of canonical JSON, set at ACCEPTED
  lint_json         jsonb NOT NULL DEFAULT '{"issues":[]}',
  version           int  NOT NULL DEFAULT 1,
  currency          char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  total_minor       int  NOT NULL CHECK (total_minor BETWEEN 1 AND 50000),
  paypal_order_id   text,
  authorization_id  text,                                  -- current (latest) authorization id
  auth_created_at   timestamptz,                           -- of the ORIGINAL authorization (29-day window anchor)
  honor_until       timestamptz,                           -- current honor period end (3d after latest (re)auth)
  auth_expires_at   timestamptz,                           -- auth_created_at + 29 days
  funded_at         timestamptz,
  funding_at_risk   boolean NOT NULL DEFAULT false,
  chaos_mock_code   text,                                  -- sandbox only; consumed by next PayPal POST
  demo_run_id       uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  accepted_at       timestamptz,
  completed_at      timestamptz
);
CREATE INDEX contracts_buyer_idx  ON contracts(buyer_id, created_at DESC);
CREATE INDEX contracts_seller_idx ON contracts(seller_id, created_at DESC);
CREATE INDEX contracts_status_idx ON contracts(status);
```

### 3.4 `milestones`
```sql
CREATE TABLE milestones (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  milestone_key     text NOT NULL,                         -- 'm1','m2',…
  idx               smallint NOT NULL,                     -- 1-based order
  title             text NOT NULL,
  amount_minor      int NOT NULL CHECK (amount_minor > 0),
  due_in_days       smallint NOT NULL CHECK (due_in_days BETWEEN 1 AND 28),
  due_at            timestamptz,                           -- set at funding: funded_at + due_in_days
  status            milestone_status NOT NULL DEFAULT 'PENDING',
  revisions_used    smallint NOT NULL DEFAULT 0,
  max_revisions     smallint NOT NULL DEFAULT 2,
  deliverable_json  jsonb NOT NULL,                        -- {content_type, max_bytes, description}
  capture_id        text,
  captured_at       timestamptz,
  release_attempts  smallint NOT NULL DEFAULT 0,
  escalated_at      timestamptz,
  auto_release_at   timestamptz,
  UNIQUE (contract_id, milestone_key),
  UNIQUE (contract_id, idx),
  CONSTRAINT capture_only_when_releasing CHECK (capture_id IS NULL OR status IN ('RELEASING','RELEASED'))
);
CREATE INDEX milestones_status_idx ON milestones(status);
CREATE INDEX milestones_auto_release_idx ON milestones(auto_release_at) WHERE status = 'ESCALATED';
```

### 3.5 `criteria`
```sql
CREATE TABLE criteria (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id        uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  criterion_key       text NOT NULL,                       -- 'c1'…
  type                criterion_type NOT NULL,
  required            boolean NOT NULL DEFAULT true,
  check_name          text,                                -- deterministic only
  spec_json           jsonb NOT NULL DEFAULT '{}',         -- deterministic spec
  statement           text,                                -- rubric statement or human prompt
  pass_threshold      numeric(3,2),                        -- rubric only, 0.00–1.00
  context_milestones  text[],                              -- rubric: prior milestone keys whose ACCEPTED artifact is given as context
  UNIQUE (milestone_id, criterion_key),
  CHECK ((type = 'deterministic') = (check_name IS NOT NULL))
);
```

### 3.6 `submissions`
```sql
CREATE TABLE submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id  uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  attempt       smallint NOT NULL,                         -- 1-based
  submitted_by  uuid NOT NULL REFERENCES users(id),
  content_type  text NOT NULL CHECK (content_type IN ('json_records','text')),
  content_text  text NOT NULL,                             -- JSON serialized as text for json_records
  size_bytes    int  NOT NULL CHECK (size_bytes BETWEEN 1 AND 1048576),
  sha256        text NOT NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (milestone_id, attempt)
);
```

### 3.7 `verifications`
```sql
CREATE TABLE verifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id         uuid NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  status                text NOT NULL CHECK (status IN ('RUNNING','COMPLETE','FAILED')),
  decision              verification_decision,
  reasons               jsonb NOT NULL DEFAULT '[]',       -- [{code, criterion_key?, message}]
  stage1_json           jsonb,                             -- deterministic results
  stage2_json           jsonb,                             -- rubric results (after quote verification)
  stage3_json           jsonb,                             -- adversarial results
  confidence            numeric(3,2),
  manipulation_severity text CHECK (manipulation_severity IN ('none','low','high')),
  degraded              boolean NOT NULL DEFAULT false,    -- LLM unavailable/over budget
  cache_hit             boolean NOT NULL DEFAULT false,
  model                 text,
  model_fast            text,
  prompt_version        text,
  input_hash            text,                              -- sha256(artifact)+criteria_hash+prompt_version+model
  latency_ms            int,
  created_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz
);
CREATE INDEX verifications_input_hash_idx ON verifications(input_hash);
```

### 3.8 `ledger_events` (append-only, hash-chained)
```sql
CREATE TABLE ledger_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id),
  seq         int  NOT NULL,                               -- 1-based per contract
  type        text NOT NULL,                               -- see §5 event types
  actor_type  text NOT NULL CHECK (actor_type IN ('buyer','seller','system','paypal','verifier')),
  actor_id    uuid,
  payload     jsonb NOT NULL,
  prev_hash   text NOT NULL,                               -- 64 zeros for seq=1
  hash        text NOT NULL,
  created_at  timestamptz NOT NULL,                        -- set by app, ms precision, same string used in hash
  UNIQUE (contract_id, seq)
);
CREATE INDEX ledger_contract_idx ON ledger_events(contract_id, seq);

CREATE FUNCTION ledger_no_mutate() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'ledger_events is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER ledger_events_no_update BEFORE UPDATE OR DELETE ON ledger_events
  FOR EACH ROW EXECUTE FUNCTION ledger_no_mutate();
```
**Hash definition (canonical):**
`hash = sha256_hex( prev_hash + "|" + contract_id + "|" + seq + "|" + type + "|" + canonical_json(payload) + "|" + created_at_iso )`
where `canonical_json` sorts object keys recursively, uses no whitespace, and `created_at_iso` is `YYYY-MM-DDTHH:mm:ss.SSSZ`.

### 3.9 `paypal_events`
```sql
CREATE TABLE paypal_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        text NOT NULL UNIQUE,                    -- PayPal's WH-... id
  event_type      text NOT NULL,
  resource_id     text,
  contract_id     uuid REFERENCES contracts(id),
  raw             jsonb NOT NULL,
  signature_valid boolean NOT NULL,
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### 3.10 `jobs` (outbox)
```sql
CREATE TABLE jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         job_type NOT NULL,
  payload      jsonb NOT NULL,
  status       job_status NOT NULL DEFAULT 'PENDING',
  run_at       timestamptz NOT NULL DEFAULT now(),
  attempts     smallint NOT NULL DEFAULT 0,
  max_attempts smallint NOT NULL DEFAULT 5,
  locked_at    timestamptz,
  last_error   text,
  dedupe_key   text UNIQUE,                                -- e.g. 'release:{milestone_id}:1' prevents duplicate enqueue
  created_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);
CREATE INDEX jobs_poll_idx ON jobs(run_at) WHERE status = 'PENDING';
```
Backoff on failure: `run_at = now() + (2^attempts) * 5s` (capped 10 min). A `RUNNING` job with `locked_at < now() - interval '5 minutes'` is reclaimed.

### 3.11 `llm_calls`
```sql
CREATE TABLE llm_calls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose         text NOT NULL,                           -- 'compile','lint','rubric','adversarial','agent'
  model           text NOT NULL,
  input_tokens    int  NOT NULL,
  output_tokens   int  NOT NULL,
  cost_micro_usd  int  NOT NULL,
  cache_hit       boolean NOT NULL DEFAULT false,
  contract_id     uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX llm_calls_day_idx ON llm_calls(created_at);
```
Budget check: `SELECT coalesce(sum(cost_micro_usd),0) FROM llm_calls WHERE created_at >= date_trunc('day', now())` compared to `LLM_DAILY_BUDGET_USD * 1_000_000`.

### 3.12 `demo_runs`
```sql
CREATE TABLE demo_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario     text NOT NULL CHECK (scenario IN ('happy_path','reject_then_pass','injection_attack','capture_declined','silent_buyer_autorelease')),
  status       text NOT NULL CHECK (status IN ('RUNNING','WAITING_FOR_BUYER','DONE','FAILED')),
  contract_id  uuid REFERENCES contracts(id),
  events       jsonb NOT NULL DEFAULT '[]',                -- [{t, actor, kind, text, data?}]
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);
```

### 3.13 `disputes` `[C]`
```sql
CREATE TABLE disputes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id           uuid NOT NULL REFERENCES contracts(id),
  milestone_id          uuid REFERENCES milestones(id),
  paypal_dispute_id     text NOT NULL UNIQUE,
  status                text NOT NULL,
  evidence_submitted_at timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);
```

## 4. Canonical Contract JSON (Zod schema is the source of truth: `src/server/contracts/schema.ts`)

```ts
type Contract = {
  schema_version: 1;
  title: string;                       // 5–120
  summary: string;                     // ≤ 500
  currency: 'USD';
  total_minor: number;                 // = sum(milestones.amount_minor), 1..50000
  milestones: Milestone[];             // 1..5
  policy: {
    max_revisions: number;             // 0..3, default 2
    auto_release_hours: number;        // 1..168, default 48 (applies to ESCALATED)
    on_final_failure: 'void_remaining';
    verifier_confidence_min: number;   // 0.5..0.95, default 0.6
  };
};

type Milestone = {
  key: string;                         // /^m[1-5]$/
  title: string;
  amount_minor: number;                // > 0
  due_in_days: number;                 // 1..28 (relative to funding)
  deliverable: {
    content_type: 'json_records' | 'text';
    max_bytes: number;                 // ≤ 1_048_576
    description: string;               // ≤ 300
  };
  criteria: Criterion[];               // ≥ 1 required criterion
};

type Criterion =
  | { key: string; type: 'deterministic'; required: boolean; description: string;
      check: 'json_schema' | 'row_count' | 'unique_field' | 'regex_field' | 'word_count' | 'required_keywords';
      spec: JsonSchemaSpec | RowCountSpec | UniqueFieldSpec | RegexFieldSpec | WordCountSpec | KeywordsSpec }
  | { key: string; type: 'rubric'; required: boolean; statement: string;           // ≤ 300 chars
      pass_threshold: number;          // 0.5..1.0, default 0.7
      context_milestones?: string[] }  // e.g. ['m1']
  | { key: string; type: 'human'; required: true; statement: string };

type JsonSchemaSpec  = { schema_ref: 'product_v1' };
type RowCountSpec    = { min?: number; max?: number };
type UniqueFieldSpec = { field: string };
type RegexFieldSpec  = { field: string; pattern: 'email' | 'url' | 'sku' };   // named patterns only (ReDoS-safe)
type WordCountSpec   = { min?: number; max?: number };
type KeywordsSpec    = { keywords: string[]; mode: 'all' | 'any'; case_sensitive?: boolean };
```

Named schema `product_v1` (stored at `src/server/verify/schemas/product_v1.json`): array of objects with
`sku` (string, `^[A-Z]{3}-\d{4}$`), `name` (3–80), `category` (enum `Electronics|Home|Fitness|Beauty|Toys`), `price_usd` (number > 0), `contact_email` (email), `description` (string 40–400); all required, no additional properties.

Named patterns: `email` = `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`, `url` = `^https?://[^\s]+$`, `sku` = `^[A-Z]{3}-\d{4}$`.

## 5. Ledger event types and payloads

| Type | Actor | Payload (keys) |
|---|---|---|
| `CONTRACT_CREATED` | buyer | `title`, `total_minor`, `prompt_sha256` |
| `CONTRACT_LINTED` | system | `issue_counts{error,warn,info}` |
| `CONTRACT_PROPOSED` | buyer | `version` |
| `CONTRACT_ACCEPTED` | seller | `contract_hash` |
| `FUNDING_STARTED` | buyer | `paypal_order_id`, `total_minor` |
| `AUTHORIZATION_CREATED` | paypal | `authorization_id`, `honor_until`, `auth_expires_at` |
| `SUBMISSION_RECEIVED` | seller | `milestone_key`, `attempt`, `sha256`, `size_bytes` |
| `VERIFICATION_COMPLETED` | verifier | `milestone_key`, `decision`, `reasons[]`, `degraded`, `cache_hit`, `input_hash` |
| `INJECTION_FLAGGED` | verifier | `milestone_key`, `severity`, `spans[]` |
| `MILESTONE_PASSED` / `MILESTONE_REJECTED` / `MILESTONE_ESCALATED` | system | `milestone_key`, `revisions_used` |
| `BUYER_DECISION` | buyer | `milestone_key`, `decision`, `note` |
| `AUTO_RELEASE_APPLIED` | system | `milestone_key`, `hours_waited` |
| `CAPTURE_REQUESTED` | system | `milestone_key`, `amount_minor`, `idempotency_key`, `final_capture` |
| `CAPTURE_COMPLETED` | paypal | `milestone_key`, `capture_id`, `amount_minor` |
| `CAPTURE_FAILED` | paypal | `milestone_key`, `paypal_error`, `mock` |
| `REAUTHORIZED` | system | `old_authorization_id`, `new_authorization_id`, `honor_until` |
| `AUTHORIZATION_VOIDED` | system | `authorization_id`, `remaining_minor`, `reason` |
| `REFUND_ISSUED` | seller | `milestone_key`, `capture_id`, `refund_id`, `amount_minor` |
| `WEBHOOK_RECEIVED` | paypal | `event_id`, `event_type` |
| `DISPUTE_OPENED` / `EVIDENCE_SUBMITTED` `[C]` | paypal/seller | `paypal_dispute_id` |
| `CONTRACT_COMPLETED` / `CONTRACT_FAILED` / `CONTRACT_CANCELLED` / `CONTRACT_EXPIRED` | system | `reason` |

## 6. State transition tables (enforced in `src/server/contracts/transitions.ts`)

### Contract
| From | To | Trigger | Actor |
|---|---|---|---|
| DRAFT | PROPOSED | propose (no lint errors, seller set) | buyer |
| PROPOSED | DRAFT | buyer edits | buyer |
| PROPOSED | ACCEPTED | accept (hash computed; milestones/criteria materialized) | seller |
| ACCEPTED | FUNDING | fund started (order created) | buyer |
| FUNDING | ACCEPTED | PayPal approval cancelled/expired | system |
| FUNDING | FUNDED | order authorized | system |
| FUNDED | IN_PROGRESS | first submission | seller |
| IN_PROGRESS | COMPLETED | all milestones RELEASED | system |
| IN_PROGRESS | FAILED | a milestone FAILED_FINAL (remaining voided) | system |
| FUNDED / IN_PROGRESS | CANCELLED | buyer cancel (allowed states only, FR-29) | buyer |
| FUNDED / IN_PROGRESS | EXPIRED | `auth_expires_at` passed with uncaptured funds | system |
| DRAFT / PROPOSED / ACCEPTED | CANCELLED | either party withdraws | buyer/seller |

### Milestone
| From | To | Trigger |
|---|---|---|
| PENDING | SUBMITTED | submission received |
| REJECTED | SUBMITTED | resubmission while `revisions_used <= max_revisions` |
| SUBMITTED | VERIFYING | verification job claimed |
| VERIFYING | PASSED / REJECTED / ESCALATED | `policy.decide()` result |
| REJECTED | FAILED_FINAL | `revisions_used > max_revisions` (no more attempts) |
| ESCALATED | PASSED | buyer approves or `AUTO_RELEASE` |
| ESCALATED | REJECTED | buyer rejects |
| PASSED | RELEASING | release job claimed (**only entry to capture**) |
| RELEASING | RELEASED | capture completed |
| RELEASING | RELEASE_FAILED | capture failed |
| RELEASE_FAILED | RELEASING | retry (manual or job) |
| FAILED_FINAL | VOIDED | remaining authorization voided |

`revisions_used` increments on every `REJECTED`. A milestone allows `max_revisions + 1` submissions.

## 7. Validation rules

1. `contracts.total_minor` = Σ `milestones.amount_minor` (checked in service on propose/accept).
2. Contract JSON must pass the Zod schema **and** have zero `error` lint issues to propose.
3. Submission `content_type` must equal the milestone's `deliverable.content_type`; size ≤ `min(deliverable.max_bytes, 1 MiB)`.
4. `json_records` content must parse as a JSON array of objects (≤ 5,000 items).
5. `text` content must be valid UTF-8, with null bytes stripped and zero-width characters **preserved** (they are evidence for the adversarial pass).
6. Only the seller may submit; only the buyer may decide on escalations; both are checked against `contracts.buyer_id/seller_id`.
7. `due_in_days` ≤ 28 ⇒ every `due_at` ≤ `auth_created_at + 28 days`.
8. Capture amounts must equal `milestones.amount_minor`; Σ captured ≤ `total_minor`.
9. **Milestones are strictly sequential:** milestone *n* accepts submissions only when milestone *n−1* is `RELEASED` (this makes `final_capture` unambiguous; see `paypal-integration.md` §5).

## 8. Sample records

**contracts** (abbreviated)
```json
{"id":"9c1f2a7e-3b0d-4c2e-8f55-1d7a6e2b9a10","buyer_id":"u-buyer","seller_id":"u-seller","title":"Product dataset + summary",
 "status":"IN_PROGRESS","total_minor":10000,"currency":"USD","paypal_order_id":"5O190127TN364715T",
 "authorization_id":"6BP34502DM8654321","auth_created_at":"2026-11-08T10:02:11.000Z",
 "honor_until":"2026-11-11T10:02:11.000Z","auth_expires_at":"2026-12-07T10:02:11.000Z",
 "contract_hash":"b7e1…c04d"}
```

**contract_json** (the demo contract)
```json
{
  "schema_version": 1,
  "title": "Product dataset + summary",
  "summary": "25 validated product records and a 150–200 word category summary.",
  "currency": "USD",
  "total_minor": 10000,
  "milestones": [
    {
      "key": "m1", "title": "Dataset", "amount_minor": 6000, "due_in_days": 3,
      "deliverable": {"content_type": "json_records", "max_bytes": 1048576, "description": "JSON array of product objects per product_v1"},
      "criteria": [
        {"key":"c1","type":"deterministic","required":true,"description":"Matches product_v1 schema","check":"json_schema","spec":{"schema_ref":"product_v1"}},
        {"key":"c2","type":"deterministic","required":true,"description":"At least 25 records","check":"row_count","spec":{"min":25}},
        {"key":"c3","type":"deterministic","required":true,"description":"SKUs are unique","check":"unique_field","spec":{"field":"sku"}},
        {"key":"c4","type":"deterministic","required":true,"description":"Emails are well formed","check":"regex_field","spec":{"field":"contact_email","pattern":"email"}},
        {"key":"c5","type":"rubric","required":false,"statement":"Each description is specific to its product and not a copied template.","pass_threshold":0.7}
      ]
    },
    {
      "key": "m2", "title": "Summary", "amount_minor": 4000, "due_in_days": 5,
      "deliverable": {"content_type": "text", "max_bytes": 20000, "description": "150–200 word summary"},
      "criteria": [
        {"key":"c6","type":"deterministic","required":true,"description":"150–200 words","check":"word_count","spec":{"min":150,"max":200}},
        {"key":"c7","type":"rubric","required":true,"statement":"The summary names at least three distinct product categories that appear in the m1 dataset.","pass_threshold":0.8,"context_milestones":["m1"]}
      ]
    }
  ],
  "policy": {"max_revisions": 2, "auto_release_hours": 48, "on_final_failure": "void_remaining", "verifier_confidence_min": 0.6}
}
```

**milestones**
```json
{"id":"…","contract_id":"9c1f…","milestone_key":"m1","idx":1,"title":"Dataset","amount_minor":6000,"due_in_days":3,
 "status":"RELEASED","revisions_used":1,"max_revisions":2,"capture_id":"3C679366HH908993F","captured_at":"2026-11-08T10:09:40.000Z"}
```

**verifications** (abbreviated)
```json
{"id":"…","submission_id":"…","status":"COMPLETE","decision":"REJECT",
 "reasons":[{"code":"DET_FAIL","criterion_key":"c2","message":"Expected ≥ 25 records, found 22."},
            {"code":"DET_FAIL","criterion_key":"c4","message":"Row 22: contact_email 'bob@@x' does not match email pattern."}],
 "manipulation_severity":"none","degraded":false,"cache_hit":false,"model":"claude-sonnet-5-5","prompt_version":"rubric.v1","latency_ms":6120}
```

**ledger_events**
```json
{"seq":1,"type":"CONTRACT_CREATED","actor_type":"buyer","payload":{"title":"Product dataset + summary","total_minor":10000,"prompt_sha256":"aa31…"},
 "prev_hash":"0000000000000000000000000000000000000000000000000000000000000000","hash":"5d2c…e9","created_at":"2026-11-08T09:41:07.113Z"}
{"seq":9,"type":"CAPTURE_COMPLETED","actor_type":"paypal","payload":{"milestone_key":"m1","capture_id":"3C679366HH908993F","amount_minor":6000},
 "prev_hash":"41fe…0b","hash":"c8a7…52","created_at":"2026-11-08T10:09:40.502Z"}
```

**jobs**
```json
{"type":"RELEASE_MILESTONE","payload":{"contract_id":"9c1f…","milestone_key":"m1"},"status":"PENDING","dedupe_key":"release:9c1f…:m1","attempts":0}
```

## 9. Indexing and hot queries

| Query | Index / note |
|---|---|
| Contract list for a user | `contracts_buyer_idx`, `contracts_seller_idx` |
| Poll next job | `jobs_poll_idx` partial index on `PENDING` |
| Ledger for a contract in order | `ledger_contract_idx (contract_id, seq)` |
| Auto-release sweep | `milestones_auto_release_idx` (partial, `ESCALATED`) |
| Verification cache lookup | `verifications_input_hash_idx` |
| Daily LLM spend | `llm_calls_day_idx` |

## 10. Migration approach

- Drizzle-kit generates SQL into `drizzle/`; `0001_ledger_trigger.sql` is hand-written (trigger, CHECK constraints).
- Hackathon rule: **additive migrations only** after Nov 6 (no destructive changes). Seed script is idempotent (`ON CONFLICT DO NOTHING`).
- Local reset: `docker compose down -v && docker compose up -d && npm run db:migrate && npm run seed`.

## 11. Assumptions

| # | Assumption |
|---|---|
| DM-1 | All demo contracts are small (≤ $500, ≤ 5 milestones); no partitioning needed. |
| DM-2 | Milestones/criteria rows are created at **accept**; before that the UI works from `contract_json`. |
| DM-3 | Artifacts are text ≤ 1 MiB stored in Postgres; no object storage. |
| DM-4 | Demo data older than 30 days is purged by `PURGE_DEMO_DATA`, **except** during judging (disabled until Dec 16). |
