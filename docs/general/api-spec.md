# ProofPay — API Specification

> Base path: `/api/v1`. JSON over HTTPS. Types below are TypeScript notation; the Zod schemas in `src/shared/types.ts` are the source of truth. `Contract` is defined in `data-model.md` §4.

## 1. API style and why

**REST + JSON, plus two Server-Sent Events (SSE) streams.** REST is the simplest surface for agents, MCP wrappers, and curl-based judges; SSE gives live timelines without WebSockets. No GraphQL/gRPC (time box).

## 2. Authentication and authorization

| Caller | Mechanism |
|---|---|
| Browser (humans, Judge Mode) | `pp_session` cookie: signed JWT (HS256, `jose`), `HttpOnly; Secure; SameSite=Lax`, 12 h. Created by `POST /auth/demo-login`. |
| Agents / MCP / scripts | `Authorization: Bearer pp_k_<secret>`; secret hashed (sha256) in `api_keys`. |
| PayPal webhooks | No auth header; **signature verification** via PayPal's verify endpoint (see `paypal-integration.md` §6). |

**Authorization rules**
- A user may read/act on a contract only if `user.id ∈ {buyer_id, seller_id}` (admin: all). Violations return `404` (not `403`) to avoid ID probing.
- Buyer-only: `propose`, `fund`, `cancel`, `decision`, `chaos`. Seller-only: `accept`, `submissions`, `refund`. Either: reads, ledger, proof-pack.
- Judge Mode personas (`buyer`, `seller`, `buyer_agent`, `worker_agent`) exist only when `DEMO_MODE=true`.

## 3. Conventions

**Errors** (all non-2xx):
```json
{ "error": { "code": "LINT_ERRORS_PRESENT", "message": "Resolve 2 lint errors before proposing.", "details": {"issue_ids": ["i1","i2"]}, "request_id": "req_01HF…" } }
```

| HTTP | `code` examples |
|---|---|
| 400 | `VALIDATION_FAILED`, `LINT_ERRORS_PRESENT`, `CONTENT_TYPE_MISMATCH`, `ARTIFACT_TOO_LARGE`, `DURATION_EXCEEDS_AUTH_WINDOW` |
| 401 | `UNAUTHENTICATED`, `INVALID_API_KEY` |
| 402 | `PAYMENT_REQUIRED` (reserved; not used) |
| 404 | `NOT_FOUND` |
| 409 | `INVALID_STATE`, `IDEMPOTENCY_CONFLICT`, `REVISIONS_EXHAUSTED`, `ALREADY_ACCEPTED` |
| 422 | `PAYPAL_ERROR` (details include PayPal `name`, `issue`, `debug_id`), `CAPTURE_DECLINED` |
| 429 | `RATE_LIMITED`, `LLM_BUDGET_EXHAUSTED` (verification still runs in degraded mode; compile/lint return this) |
| 502/503 | `UPSTREAM_PAYPAL`, `UPSTREAM_LLM`, `DB_UNAVAILABLE` |

**Idempotency:** `Idempotency-Key: <uuid>` is accepted on `fund`, `submissions`, `decision`, `retry-release`, `refund`. Replays within 24 h return the original response. A different body with the same key → `409 IDEMPOTENCY_CONFLICT`.

**IDs/time/money:** UUIDs; ISO-8601 UTC; money as integer `*_minor` (cents) with `currency: "USD"`.

**Rate limits** (per IP unless noted): `compile` 10/h/user, `submissions` 30/h/user, `demo/scenarios/*/run` 5/h, `auth/demo-login` 20/h, others 300/min. Headers: `X-RateLimit-Remaining`.

**Shared view types**
```ts
type LintIssue = {
  id: string; code: string; severity: 'error'|'warn'|'info';
  path: string;                     // JSON Pointer into Contract, e.g. "/milestones/0/criteria/2"
  message: string;
  suggested_fix?: { description: string; patch: JsonPatchOp[] };   // RFC 6902
};

type CriterionResult = {
  criterion_key: string; type: 'deterministic'|'rubric'|'human';
  status: 'pass'|'fail'|'cannot_verify'|'needs_human';
  message: string; observed?: unknown; expected?: unknown;
  score?: number; confidence?: number;
  evidence?: { quote: string; verified: boolean; hint?: string }[];
};

type VerificationView = {
  id: string; submission_id: string; milestone_key: string;
  decision: 'PASS'|'REJECT'|'ESCALATE'|null; status: 'RUNNING'|'COMPLETE'|'FAILED';
  reasons: { code: string; criterion_key?: string; message: string }[];
  criteria: CriterionResult[];
  manipulation: { severity: 'none'|'low'|'high'; spans: { quote: string; reason: string }[] };
  degraded: boolean; cache_hit: boolean; model: string|null; prompt_version: string|null;
  created_at: string; completed_at: string|null;
};

type MilestoneView = {
  key: string; title: string; amount_minor: number;
  status: MilestoneStatus; due_at: string|null;
  revisions_used: number; max_revisions: number;
  capture_id: string|null; auto_release_at: string|null;
  latest_verification: VerificationView|null;
};

type ContractView = {
  id: string; status: ContractStatus; title: string; total_minor: number; currency: 'USD';
  buyer: { id: string; display_name: string }; seller: { id: string; display_name: string }|null;
  contract: Contract; contract_hash: string|null;
  lint: { issues: LintIssue[] };
  funding: { authorization_id: string|null; funded_at: string|null; honor_until: string|null;
             auth_expires_at: string|null; at_risk: boolean;
             authorized_minor: number; captured_minor: number; voided_minor: number; remaining_minor: number };
  milestones: MilestoneView[];
  created_at: string; updated_at: string;
};
```

## 4. Auth and session

| Method & path | Purpose | Request | Response |
|---|---|---|---|
| `POST /auth/demo-login` | Sign in as a seeded persona (`DEMO_MODE` only) | `{ persona: 'buyer'\|'seller'\|'buyer_agent'\|'worker_agent' }` | `200 { user: { id, display_name, role, is_agent } }` + cookie |
| `POST /auth/logout` | Clear session | – | `204` |
| `GET /me` | Current user | – | `200 { user }` |
| `POST /me/api-keys` | Create API key (secret shown once) | `{ label: string }` | `201 { id, key_prefix, secret }` |
| `DELETE /me/api-keys/{id}` | Revoke | – | `204` |

## 5. Contracts

| Method & path | Who | Purpose |
|---|---|---|
| `POST /contracts/compile` | buyer | Prompt → draft contract + lint |
| `GET /contracts` | any | List my contracts (`?status=`, `?limit=` ≤ 50) |
| `GET /contracts/{id}` | party | `ContractView` |
| `PATCH /contracts/{id}` | buyer (DRAFT/PROPOSED) | Replace `contract` JSON; re-lints; PROPOSED → DRAFT |
| `POST /contracts/{id}/lint` | buyer | Re-run lint (deterministic + AI) |
| `POST /contracts/{id}/lint/apply` | buyer | Apply one suggested fix |
| `POST /contracts/{id}/propose` | buyer | Send to seller |
| `POST /contracts/{id}/accept` | seller | Lock contract, compute hash, materialize milestones |
| `POST /contracts/{id}/cancel` | buyer | Cancel; voids remaining hold if funded (FR-29) |

### `POST /contracts/compile`
```ts
// Request
{ prompt: string /* ≤2000 */, seller_email?: string, budget_cap_minor?: number /* ≤ 50000 */ }
// 201
{ contract_id: string, contract: Contract, lint: { issues: LintIssue[] } }
// Errors: 400 VALIDATION_FAILED, 429 RATE_LIMITED | LLM_BUDGET_EXHAUSTED, 502 UPSTREAM_LLM
```

### `POST /contracts/{id}/lint/apply`
```ts
{ issue_id: string }  →  200 { contract: Contract, lint: { issues: LintIssue[] } }
// 409 INVALID_STATE if contract is not DRAFT/PROPOSED
```

### `POST /contracts/{id}/propose`
```ts
{ seller_email: string }  →  200 ContractView   // 400 LINT_ERRORS_PRESENT | DURATION_EXCEEDS_AUTH_WINDOW
```

### `POST /contracts/{id}/accept`
```ts
{}  →  200 ContractView   // sets contract_hash; 409 ALREADY_ACCEPTED if repeated with a different state
```

## 6. Funding and PayPal

| Method & path | Who | Purpose |
|---|---|---|
| `POST /contracts/{id}/fund` | buyer | Create PayPal `AUTHORIZE` order; return approval URL |
| `GET /paypal/return?token={orderId}&contract_id={id}` | browser redirect | Authorize order, store hold, redirect to `/contracts/{id}?funded=1` |
| `GET /paypal/cancel?contract_id={id}` | browser redirect | Return to ACCEPTED, redirect to `/contracts/{id}?cancelled=1` |
| `POST /webhooks/paypal` | PayPal | Receive signed events; `200` immediately after storing |
| `POST /contracts/{id}/chaos` | buyer (`CHAOS_MODE` only) | `{ mock_code: 'INSTRUMENT_DECLINED'\|'TRANSACTION_REFUSED'\|'INTERNAL_SERVER_ERROR'\|null }` applies to the next capture |
| `POST /contracts/{id}/milestones/{key}/retry-release` | buyer/system | Retry after `RELEASE_FAILED` |
| `POST /contracts/{id}/milestones/{key}/refund` `[S]` | seller | `{ amount_minor?: number, reason: string }` full/partial refund of a capture |

### `POST /contracts/{id}/fund`
```ts
// Request: {}   Headers: Idempotency-Key
// 200
{ paypal_order_id: string, approval_url: string }
// Errors: 409 INVALID_STATE (must be ACCEPTED), 422 PAYPAL_ERROR, 400 DURATION_EXCEEDS_AUTH_WINDOW
```

## 7. Milestones, submissions, verification

| Method & path | Who | Purpose |
|---|---|---|
| `GET /contracts/{id}/milestones/{key}` | party | `MilestoneView` + submissions list |
| `POST /contracts/{id}/milestones/{key}/submissions` | seller | Submit deliverable |
| `GET /verifications/{vid}` | party | `VerificationView` |
| `POST /contracts/{id}/milestones/{key}/decision` | buyer | Approve/reject an `ESCALATED` milestone |

### `POST .../submissions`
```ts
// Request  (Headers: Idempotency-Key)
{ content_type: 'json_records'|'text', content: unknown /* array for json_records, string for text */, note?: string }
// 202
{ submission_id: string, verification_id: string, attempt: number, status: 'VERIFYING' }
// Errors: 400 CONTENT_TYPE_MISMATCH | ARTIFACT_TOO_LARGE | VALIDATION_FAILED
//         409 INVALID_STATE (milestone not PENDING/REJECTED) | REVISIONS_EXHAUSTED
```

### `POST .../decision`
```ts
{ decision: 'approve'|'reject', note?: string }  →  200 MilestoneView   // 409 INVALID_STATE unless ESCALATED
```

## 8. Ledger, Proof Pack, realtime, demo, ops

| Method & path | Purpose |
|---|---|
| `GET /contracts/{id}/ledger?limit=&after_seq=` | `{ events: LedgerEvent[], head_hash }` |
| `GET /contracts/{id}/ledger/verify` | `{ valid: boolean, checked: number, broken_at_seq: number\|null }` |
| `GET /contracts/{id}/proof-pack?format=json\|pdf` | Proof Pack download (JSON `[M]`, PDF `[S]`) |
| `GET /contracts/{id}/events` | **SSE** stream for the contract |
| `POST /demo/scenarios/{name}/run` | Start scenario (`happy_path`, `reject_then_pass`, `injection_attack`, `capture_declined`, `silent_buyer_autorelease`) → `202 { run_id }` |
| `GET /demo/runs/{id}` | `{ id, scenario, status, contract_id, events[] }` |
| `GET /demo/runs/{id}/events` | **SSE** stream for the Agent Console |
| `GET /health` | `{ status:'ok'\|'degraded', db, paypal, llm:{ ok, budget_remaining_usd }, version }` |

```ts
type LedgerEvent = { seq: number; type: string; actor_type: string; payload: object; prev_hash: string; hash: string; created_at: string };
```

**SSE formats**
```
event: contract.updated
data: {"contract_id":"…","type":"MILESTONE_PASSED","milestone_key":"m1","status":"IN_PROGRESS"}

event: run.step
data: {"t":"2026-11-08T10:05:01.120Z","actor":"worker_agent","kind":"message","text":"Submitting m1 (attempt 1)…"}

event: run.waiting_for_buyer
data: {"approval_url":"https://www.sandbox.paypal.com/checkoutnow?token=…","message":"Approve the hold in PayPal sandbox to continue."}

event: run.done
data: {"outcome":"COMPLETED","contract_id":"…"}
```
Heartbeat comment `: ping` every 15 s. Clients fall back to polling `GET /contracts/{id}` every 5 s if SSE drops.

### Proof Pack JSON shape
```ts
{ version: 1, generated_at: string, disclaimer: string,
  contract: { id, title, hash, canonical: Contract, buyer, seller },
  paypal: { order_id, authorization_ids: string[], captures: {id, milestone_key, amount_minor}[], voids: {…}[], refunds: {…}[] },
  milestones: { key, status, submissions: { attempt, sha256, received_at }[], verifications: VerificationView[] }[],
  ledger: LedgerEvent[], chain: { valid: boolean, head_hash: string } }
```

## 9. MCP tools (`src/mcp/server.ts`; wraps REST with `PROOFPAY_API_KEY`)

| Tool | Input | Output | Maps to |
|---|---|---|---|
| `create_contract` | `{ prompt: string, seller_email?: string }` | `{ contract_id, contract, lint_issues }` | `POST /contracts/compile` (+ propose if `seller_email`) |
| `accept_contract` | `{ contract_id }` | `{ status, contract_hash }` | `POST /contracts/{id}/accept` |
| `get_funding_link` | `{ contract_id }` | `{ approval_url, note: "A human payer must open this link and approve in PayPal." }` | `POST /contracts/{id}/fund` |
| `submit_deliverable` | `{ contract_id, milestone_key, content_type, content, note? }` | `{ submission_id, verification_id, attempt }` | `POST …/submissions` |
| `get_verification_report` | `{ verification_id }` | `VerificationView` | `GET /verifications/{id}` |
| `get_contract_status` | `{ contract_id }` | `{ status, funds, milestones[] }` | `GET /contracts/{id}` |

Agents **cannot** approve escalations or move money: there is intentionally no MCP tool for `decision`, `cancel`, or `refund`.

## 10. Example flows

**Compile → fix → propose**
```http
POST /api/v1/contracts/compile
{ "prompt": "I need 25 product records as JSON (sku, name, category, price_usd, contact_email, description) for $60, then a high quality summary for $40." }

201 { "contract_id": "9c1f…", "contract": { … }, "lint": { "issues": [
  { "id":"i1","code":"LINT_VAGUE_TERM","severity":"error","path":"/milestones/1/criteria/1",
    "message":"'high quality' is not measurable.",
    "suggested_fix":{"description":"Require 150–200 words and ≥3 categories from the dataset.","patch":[ … ]}} ] } }

POST /api/v1/contracts/9c1f…/lint/apply   { "issue_id": "i1" }   →  200 { "lint": { "issues": [] }, … }
POST /api/v1/contracts/9c1f…/propose      { "seller_email": "maya@demo.proofpay" }
```

**Submit → rejected with feedback**
```http
POST /api/v1/contracts/9c1f…/milestones/m1/submissions
{ "content_type": "json_records", "content": [ {…22 items…} ] }
202 { "submission_id":"…","verification_id":"v-77…","attempt":1,"status":"VERIFYING" }

GET /api/v1/verifications/v-77…   →   200 { "decision":"REJECT",
  "reasons":[{"code":"DET_FAIL","criterion_key":"c2","message":"Expected ≥ 25 records, found 22."},
             {"code":"DET_FAIL","criterion_key":"c4","message":"Row 22: contact_email 'bob@@x' invalid."}], … }
```

**Pass → capture**
```http
SSE: event: contract.updated  data: {"type":"MILESTONE_PASSED","milestone_key":"m1"}
SSE: event: contract.updated  data: {"type":"CAPTURE_COMPLETED","milestone_key":"m1","status":"IN_PROGRESS"}
```

## 11. Versioning

Not versioned beyond the `/v1` prefix during the hackathon. After: additive changes only within `v1`; breaking changes under `/v2`; OpenAPI 3.1 generated from Zod (`zod-to-openapi`) and published for SDK generation (APIMatic `[C]`).

## 12. Assumptions

| # | Assumption |
|---|---|
| AP-1 | `GET` return/cancel endpoints are browser redirects and are exempt from JSON error format (they redirect with `?error=` on failure). |
| AP-2 | `seller_email` must match a seeded or registered user in `DEMO_MODE`; otherwise `400 VALIDATION_FAILED`. |
| AP-3 | SSE works through Render's proxy with `Cache-Control: no-cache` and `X-Accel-Buffering: no`. |
