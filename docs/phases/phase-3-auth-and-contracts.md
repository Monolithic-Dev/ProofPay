# Phase 3 — Auth, API Foundation, Contract Compile & Lint

> **Goal (done means):** over REST, a buyer can compile a plain-English job into a linted contract, apply one-click fixes, propose it to a seller; the seller accepts and the contract locks with a SHA-256 hash and materialized milestones. Auth (demo personas + API keys), error format, rate limiting, security headers, health and the LLM adapter (budget, retries, logging) all exist.
> **Window:** Tue Nov 3 → Thu Nov 5 · **Budget:** 4 person-days · **Owners:** A (auth, HTTP plumbing, routes), B (LLM adapter, compile, lint).

## Preconditions
- Phase 2 complete (tag `phase-2-data-layer`): DB, repos, ledger, transitions, `withIdempotency`, seeds.
- `ANTHROPIC_API_KEY` set with a provider-side hard spend limit; model strings confirmed in Anthropic docs (update `ANTHROPIC_MODEL*` defaults if needed and log in `docs/decision-log.md`).

## Implements
`api-spec.md` §2–§5 · `ai-pipeline.md` §1–§2, §4, §5 (AI-1, AI-2) · `data-model.md` §4 (Contract), §7 (rules 1–2) · `security-privacy.md` §2–§4 (T1, T4, T6, T10) · `prd.md` FR-1…FR-8, FR-37, FR-41 · `edge-cases.md` E-01…E-04, E-11, E-45, E-48, E-50, E-52, E-53.

## Task breakdown

### 3.1 Auth and guards (Owner A)
- [ ] `src/server/auth/session.ts`: `signSession(user: {id, role, is_agent}): Promise<string>` (jose HS256, `exp` 12 h, `iss: 'proofpay'`), `readSession(cookieHeader|Request): Promise<SessionUser|null>` (rejects expired/malformed), `sessionCookie(token)` returning `Set-Cookie` string `pp_session=...; HttpOnly; Secure (prod); SameSite=Lax; Path=/; Max-Age=43200`.
- [ ] `src/server/auth/apikeys.ts`: `createApiKey(userId, label)` → secret `pp_k_` + `base64url(randomBytes(32))`, store `key_prefix` (first 8 chars after `pp_k_`... i.e. first 8 chars of the secret) and `key_hash = sha256Hex(secret)`; `authenticateApiKey(authorizationHeader)` (constant-time compare via hash lookup; updates `last_used_at` at most once/minute; rejects revoked); `revokeApiKey(userId, id)`.
- [ ] `src/server/auth/guards.ts`: `requireUser(req)` (session cookie **or** Bearer key; throws `UNAUTHENTICATED`/`INVALID_API_KEY`), `requireRole(user, ...roles)`, `requireParty(tx, contractId, user)` (returns contract + `partyRole: 'buyer'|'seller'|'admin'`; **throws `NOT_FOUND` 404 for strangers**), `forbidAgent(user)` throws `403 FORBIDDEN_FOR_AGENT` when `user.is_agent` (used by `decision`, `cancel`, `refund`), `assertSameOrigin(req)` for cookie-authenticated state-changing requests (compare `Origin` with `env.APP_BASE_URL`; allow API-key calls).
- [ ] Routes: `src/app/api/v1/auth/demo-login/route.ts` (`POST {persona}`; 404 unless `env.DEMO_MODE`; Zod enum `buyer|seller|buyer_agent|worker_agent`; rate limit 20/h/IP; sets cookie; returns `{user}`), `auth/logout/route.ts` (204), `me/route.ts` (GET), `me/api-keys/route.ts` (POST `{label ≤ 60 chars}` → 201 `{id,key_prefix,secret}`), `me/api-keys/[id]/route.ts` (DELETE → 204).
- [ ] Tests `tests/integration/auth.test.ts`: `demo-login sets HttpOnly cookie`, `demo-login 404 when DEMO_MODE=false`, `expired session rejected`, `tampered JWT rejected`, `API key authenticates and updates last_used_at`, `revoked API key rejected with INVALID_API_KEY`, `secret is shown once and only hash is stored`, `forbidAgent blocks agent users`, `state-changing cookie request with foreign Origin is rejected`.

### 3.2 HTTP plumbing (Owner A)
- [ ] `src/server/http/handler.ts`: `apiHandler(config, fn)` wrapper for route handlers: generates `request_id`, child logger, auth per `config.auth` (`'none'|'user'|'party'`), rate limit per `config.rateLimit`, JSON body size guard (`config.maxBytes`, default 50 KB; 1.2 MiB for submissions) returning `400 VALIDATION_FAILED`, Zod parsing (`config.body`, `config.query`), idempotency via `withIdempotency` when `config.idempotent`, maps `AppError`/`ZodError`/unknown to the error format of `api-spec.md` §3, adds `X-Request-Id`.
- [ ] `src/server/util/rate-limit.ts`: `rateLimit({ key, limit, windowMs })` in-memory sliding window (Map with periodic cleanup); returns `{ok, remaining, resetAt}`; helper `clientIp(req)` (first of `x-forwarded-for`). Document that this is per-instance (single web instance assumed; `security-privacy.md` SP-1).
- [ ] `next.config.ts` `headers()`: CSP (`default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' (dev only) ; connect-src 'self'; frame-ancestors 'none'; form-action 'self' https://www.sandbox.paypal.com`), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Strict-Transport-Security` (prod only). Note: AG Grid injects inline styles (hence `'unsafe-inline'` for styles).
- [ ] Tests `tests/integration/http.test.ts`: `returns standard error shape with request_id`, `rejects oversized body`, `429 with X-RateLimit-Remaining`, `ZodError becomes VALIDATION_FAILED with field paths`, `unknown error hides internals`, `security headers present`.

### 3.3 Health endpoint (Owner A) — `deployment.md` §6
- [ ] `src/app/api/v1/health/route.ts`: returns `{ status:'ok'|'degraded', db:{ok}, paypal:{ok:null|boolean}, llm:{ok, budget_remaining_usd}, worker_lag_seconds, stuck:{releasing, jobs_pending_old}, version }`; `db` via `SELECT 1`; `llm` from `getBudgetStatus()`; `worker_lag_seconds` from `kv('worker:heartbeat')` (null until Phase 4); `paypal.ok` is `null` until Phase 5 supplies the cached token check. Always `200` unless DB is down (`503`).
- [ ] Test: `health reports degraded when LLM budget exhausted`, `health 503 when DB unreachable`.

### 3.4 Contract schema (Owner B) — `data-model.md` §4
- [ ] `src/server/contracts/schema.ts`: Zod `ContractSchema` with discriminated union for `Criterion` (`type`), per-check `spec` schemas (`JsonSchemaSpec`, `RowCountSpec`, `UniqueFieldSpec`, `RegexFieldSpec`, `WordCountSpec`, `KeywordsSpec`), `MilestoneSchema`, `PolicySchema` with defaults; `.superRefine` rules: keys `m1..m5` unique and ordered; `criteria` keys unique per milestone; ≥1 `required` criterion per milestone; `Σ amount_minor === total_minor`; `total_minor ≤ 50000`; `due_in_days ≤ env.MAX_CONTRACT_DAYS`; rubric `statement ≤ 300`; `context_milestones` reference **earlier** keys only; deliverable `max_bytes ≤ 1_048_576`; `human` criteria `required: true`.
- [ ] Export `type Contract`, `parseContract(unknown)`, `DEFAULT_POLICY`.
- [ ] Tests `tests/unit/contract-schema.test.ts` (≥ 15): `accepts the demo contract`, `rejects 6 milestones`, `rejects sum mismatch`, `rejects total over 50000`, `rejects due_in_days 29`, `rejects unknown check name`, `rejects regex_field with a custom pattern`, `rejects context_milestones pointing forward`, `rejects duplicate criterion keys`, `rejects milestone with no required criterion`, `rejects rubric statement over 300 chars`, `applies default policy`, `rejects human criterion with required=false`, `rejects negative amount`, `rejects currency EUR`.

### 3.5 LLM adapter (Owner B) — `ai-pipeline.md` §2, §4
- [ ] `src/server/ai/pricing.ts`: `MODEL_PRICING` map (per-million-token input/output USD; **mark ⚠ verify; read actual usage from API**) and `costMicroUsd(model, inTok, outTok)`.
- [ ] `src/server/ai/llm.ts`: `callTool<T>({ purpose, model, system, user, tool: {name, input_schema}, parse: (raw)=>T, contractId?, timeoutMs=25000, temperature=0 })` doing: (1) `getBudgetStatus()` → throw `LlmBudgetError` (`429 LLM_BUDGET_EXHAUSTED`) if spend ≥ `LLM_DAILY_BUDGET_USD`; (2) call Anthropic Messages API with `tool_choice: {type:'tool', name}`; (3) extract the `tool_use` block; (4) `parse` (Zod) — on failure retry **once** appending the validation error to the user message; (5) retry up to 2× on 429/5xx with jitter 500–1500 ms; (6) insert `llm_calls` row (purpose, model, tokens, cost, contract_id); (7) return `{ data, usage }`. Throw `LlmUnavailableError` (`502 UPSTREAM_LLM`) on exhaustion/timeouts.
- [ ] `export function setLlmTransport(t | null)` for tests (`FakeLLM`) and `export async function getBudgetStatus()` → `{ spent_usd, limit_usd, remaining_usd, exhausted }`.
- [ ] `tests/integration/fake-llm.ts`: `FakeLLM` keyed by `purpose` + fixture id returning canned tool outputs.
- [ ] Tests `tests/integration/llm.test.ts`: `refuses call when daily budget exhausted`, `retries once on schema-invalid output with error appended`, `retries on 429 then succeeds`, `throws LlmUnavailableError after retries`, `logs llm_calls with cost`, `uses forced tool_choice`, `times out after 25s` (fake timers).

### 3.6 Prompts and tool schemas (Owner B) — `ai-pipeline.md` §5
- [ ] `src/server/ai/prompts/compile.v1.ts`: `export const PROMPT_VERSION = 'compile.v1'`; `buildCompilePrompt({ prompt, nonce, budgetCapMinor? })` using the system text from `ai-pipeline.md` §5 and the nonce-delimited user block.
- [ ] `src/server/ai/prompts/lint.v1.ts`: `buildLintPrompt({ contract, detIssues })`.
- [ ] `src/server/ai/tools.ts`: `contractTool` built from `zod-to-json-schema(ContractSchema)`; if the union schema is rejected by the API, fall back to a **flat** tool schema (criterion = object with `type` + optional fields) and re-validate with Zod (decision logged in `docs/decision-log.md`); `lintTool`.
- [ ] Test: `tool schemas are valid JSON Schema (Ajv compile)`.

### 3.7 Deterministic lint (Owner B) — `ai-pipeline.md` §5, PRD FR-4…FR-7
- [ ] `src/server/contracts/lint/vague-terms.ts`: `VAGUE_TERMS` (≥ 25: "good", "high quality", "professional", "nice", "better", "engaging", "appropriate", "soon", "asap", "etc", "and so on", "polished", "creative", "clean", "amazing", …), `findVagueTerms(text): {term, index}[]` (word-boundary, case-insensitive).
- [ ] `src/server/contracts/lint/rules.ts`: `runDeterministicLint(contract): LintIssue[]` with stable ids `sha256Hex(code + path).slice(0,10)`; rules: `LINT_NO_REQUIRED_CRITERION` (error), `LINT_SUM_MISMATCH` (error, fix = replace `/total_minor`), `LINT_DURATION` (error, fix = set `due_in_days` to `MAX_CONTRACT_DAYS`), `LINT_RUBRIC_TOO_LONG` (error), `LINT_RUBRIC_NO_THRESHOLD` (warn, fix adds 0.7), `LINT_VAGUE_TERM` (error on rubric/human/description text in **criteria**; warn elsewhere), `LINT_UNKNOWN_CHECK` (error), `LINT_MISSING_DELIVERABLE_SPEC` (error), `LINT_BUDGET_EXCEEDS_CAP` (error when `budget_cap_minor` supplied), `LINT_HUMAN_BLOCKS_AUTORELEASE` (info).
- [ ] Tests `tests/unit/lint-rules.test.ts`: one test per code (`flags sum mismatch and offers fix`, `flags duration 30 days`, `flags "high quality" in a rubric statement`, `does not flag vague words outside criteria as errors`, `info for human criterion`, `stable issue ids across runs`).

### 3.8 AI lint and safe patching (Owner B)
- [ ] `src/server/contracts/lint/patch.ts`: `applyPatchSafe(contract, patch): {ok:boolean; contract?:Contract; reason?:string}` using `fast-json-patch` with `validate`, then `ContractSchema.safeParse`.
- [ ] `src/server/contracts/lint/ai-lint.ts`: `runAiLint(contract, detIssues, { contractId })` → calls `callTool` (fast-path skipped if budget exhausted → returns `[]` plus `info` issue `LINT_AI_UNAVAILABLE`); each suggested fix passes `applyPatchSafe` **and** must reduce the count of `error` issues when re-linted deterministically; otherwise the suggestion is dropped (issue kept without fix).
- [ ] Tests `tests/integration/ai-lint.test.ts` (FakeLLM): `keeps fix that clears a vague-term error`, `drops patch that breaks the schema`, `drops patch that creates a sum mismatch`, `returns info issue when LLM unavailable`.

### 3.9 Compile (Owner B)
- [ ] `src/server/contracts/compile.ts`: `compileContract({ prompt, userId, sellerEmail?, budgetCapMinor? })`: validate prompt (trimmed, 1–2000 chars, strip control chars except `\n\t`); generate nonce; **LLM call outside any DB transaction**; `parseContract`; on Zod failure retry once with errors; run `runDeterministicLint` + `runAiLint`; then `withTx`: `insertDraftContract` + ledger `CONTRACT_CREATED {title,total_minor,prompt_sha256}` + `CONTRACT_LINTED {issue_counts}`; return `{ contract_id, contract, lint }`.
- [ ] Prompt-injection safety: the buyer prompt is wrapped in nonce delimiters and the system prompt states it is untrusted; a post-check rejects contracts whose text fields contain grader-addressed strings (reuse `heuristicScan` from Phase 4 once available; for now a local regex list `/ignore (all|previous)|mark .* pass/i` → drop field text and add `info` issue).
- [ ] Tests `tests/integration/compile.test.ts` (FakeLLM): `compiles demo prompt into valid contract`, `rejects empty prompt (400)`, `rejects 2001-char prompt`, `retries once on invalid contract JSON`, `returns 502 UPSTREAM_LLM after two invalid outputs`, `LLM call happens outside DB transaction` (assert no open tx via test hook), `writes CONTRACT_CREATED and CONTRACT_LINTED ledger events`, `neutralizes grader-addressed text in prompt`.

### 3.10 Contract service and routes (Owner A) — `api-spec.md` §5
- [ ] `src/server/contracts/service.ts`:
  - `lintContract(contractId, user)` (buyer; DRAFT/PROPOSED; re-runs both lints; saves `lint_json`).
  - `applyLintFix(contractId, user, issueId)` (find issue → `applyPatchSafe` → save → re-lint; `409 INVALID_STATE` if not DRAFT/PROPOSED).
  - `patchContract(contractId, user, contract)` (Zod-validate; PROPOSED→DRAFT transition; re-lint).
  - `proposeContract(contractId, user, sellerEmail)` (blocks on `error` issues with `LINT_ERRORS_PRESENT` listing ids; resolves seller by email; transition DRAFT→PROPOSED; ledger `CONTRACT_PROPOSED`).
  - `acceptContract(contractId, user)` (seller only; in one `withTx`: lock, transition PROPOSED→ACCEPTED, `contract_hash = contractHash(contract_json)`, `accepted_at`, `materializeMilestonesAndCriteria`, ledger `CONTRACT_ACCEPTED {contract_hash}`; second call returns `409 ALREADY_ACCEPTED`).
  - `cancelContract(contractId, user)` (pre-funding states only in this phase; funded cancel arrives in Phase 5).
  - `buildContractView(tx, contract)` in `src/server/contracts/view.ts` producing `ContractView` (milestones from rows after ACCEPTED, else derived from JSON; `funding` totals computed from milestone statuses).
- [ ] Routes (all via `apiHandler`): `contracts/compile/route.ts` (POST; rate limit 10/h/user), `contracts/route.ts` (GET list; `status`, `limit ≤ 50`), `contracts/[id]/route.ts` (GET, PATCH), `contracts/[id]/lint/route.ts`, `contracts/[id]/lint/apply/route.ts`, `contracts/[id]/propose/route.ts`, `contracts/[id]/accept/route.ts`, `contracts/[id]/cancel/route.ts`.
- [ ] Tests `tests/integration/contracts.test.ts`: `compile → lint → apply fix → propose → accept happy path`, `accept computes hash equal to contractHash(contract_json)`, `accept materializes milestones m1,m2 and 7 criteria`, `PATCH after ACCEPTED returns 409`, `propose blocked while error issues exist`, `buyer edit of PROPOSED returns to DRAFT`, `stranger gets 404 for GET/PATCH/accept`, `seller cannot propose`, `buyer cannot accept`, `agent-flagged user cannot cancel`, `double accept returns 409 ALREADY_ACCEPTED`, `list returns only my contracts`.
- [ ] IDOR matrix scaffold `tests/integration/idor.test.ts`: table of `{method, path, allowedRoles}` for every route so far; asserts 404/403 for strangers (extended in later phases).

## Real-world engineering concerns
- **No LLM or network call inside a DB transaction** (compile, lint).
- **Untrusted input:** buyer prompt and contract text are data; sizes/char sets validated before LLM calls; JSON depth/size limits enforced in Zod.
- **Budget and abuse:** per-user compile rate limit, global LLM budget; budget exhaustion returns `429 LLM_BUDGET_EXHAUSTED` (UI offers manual template; Phase 6).
- **Idempotency:** `accept` is naturally idempotent via state guard; `compile` is not idempotent by design (each call creates a draft) but is rate-limited.
- **Observability:** log `purpose`, `model`, tokens, `cost_micro_usd`, `contract_id` for each LLM call (no prompt text); log lint issue counts.
- **Graceful degradation:** AI lint failure never blocks deterministic lint; compile failure returns `502` with a clear message.

## Definition of done
- [ ] `curl` flow works against `npm run dev` with the seeded personas: demo-login buyer → `POST /contracts/compile` (FakeLLM or real LLM) → `POST .../lint/apply` → `POST .../propose` → demo-login seller → `POST .../accept` returns `contract_hash`, and `GET /contracts/{id}` shows `milestones` with status `PENDING`.
- [ ] All named tests in 3.1–3.10 pass; contract-schema unit tests ≥ 15; IDOR scaffold runs.
- [ ] `GET /api/v1/health` returns the documented shape; LLM budget shown.
- [ ] Real-LLM smoke: compiling "25 product records for $60, then a high quality summary for $40" yields a valid contract and at least one `LINT_VAGUE_TERM` error with a working one-click fix (manual check, recorded in `docs/decision-log.md`).
- [ ] `ledger/verify` returns `valid:true` for the contract created in the smoke run.
- [ ] No route imports PayPal or Anthropic modules directly (lint passes).

## Risks & blockers
| Risk | Mitigation |
|---|---|
| Tool schema rejected for union types | Flat tool schema + Zod re-validation (task 3.6) |
| LLM produces vague/odd contracts | Deterministic lint + AI lint + buyer review; keep `compile.v1` examples in prompt |
| Budget burn during development | Dev uses `FakeLLM` by default (`LLM_TRANSPORT=fake` env in tests), real calls only for smoke |
| In-memory rate limit resets on deploy | Acceptable; documented |
| Time overrun on AI lint | Ship deterministic lint first; AI lint behind a flag |

## Time budget
**4 person-days** (A 2.0: auth/HTTP/routes/health; B 2.0: LLM/compile/lint). **Cut first if long:** AI lint suggestions beyond vague-term fixes; API-key routes (agents can use session cookie temporarily); `LINT_RUBRIC_NO_THRESHOLD`.

## Handoff
Next phases can assume: authenticated REST with the standard error format; `requireParty`/`forbidAgent` guards; `callTool` LLM adapter with budget/logging and `setLlmTransport`; `ContractSchema`; accepted contracts have a hash and materialized `milestones`/`criteria`; ledger events `CONTRACT_*` flow; health endpoint; IDOR test scaffold.
**Tag:** `git tag phase-3-contracts && git push --tags`
