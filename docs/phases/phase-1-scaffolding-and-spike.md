# Phase 1 — Scaffolding, CI & PayPal Spike Gate

> **Goal (done means):** the repo builds and passes CI; every teammate can run web + Postgres locally; shared types and design tokens exist so other phases can start in parallel; and **the PayPal spike proves AUTHORIZE → partial capture → final capture → void → declined-capture** (or the team pivots to the backup by **Nov 3, 12:00 IST**).
> **Window:** Mon Nov 2 → Tue Nov 3 · **Budget:** 3 person-days · **Owners:** A (spike, env, errors), B (shared types), C (shell/tokens), D (repo, CI, Compose, Render skeleton).

## Plan at a glance (all 10 phases)

| # | Phase | Goal | Window (IST) | Person-days | Lead |
|---|---|---|---|---|---|
| 1 | Scaffolding, CI & PayPal spike gate | Repo builds in CI; spike proves PayPal mechanics or triggers pivot | Nov 2–3 | 3 | D / A |
| 2 | Data layer, ledger & state machines | All tables, triggers, hash-chained ledger, job queue, transitions tested | Nov 3–4 | 3 | A |
| 3 | Auth, API foundation, contract compile & lint | Compile → lint → fix → propose → accept (hash lock) over REST | Nov 3–5 | 4 | A / B |
| 4 | Verification engine & job handlers | Submission → 4-stage verification → decision applied | Nov 4–6 | 6 | B |
| 5 | PayPal funding, release & housekeeping | Fund → authorize → partial capture → void/reauth/reconcile, failure-safe | Nov 4–7 | 6 | A |
| 6 | Frontend core & integration | All screens on the real API with live updates | Nov 3–8 | 7 | C |
| 7 | Agents, scenarios, Judge Mode & MCP | Five one-click scenarios + MCP tools | Nov 6–8 | 3 | D |
| 8 | Testing, eval, chaos & hardening | Measured verifier, 12-case chaos, security checks | Nov 6–10 | 4 | B / A |
| 9 | Deployment & judging-window readiness | Live on Render, monitored, rollback-tested, cost-capped through Dec 15 | Nov 4 (skeleton) → Nov 10 | 1.5 | D |
| 10 | Demo prep, video & submission | Video, README, Devpost submitted by Nov 11 18:00 IST | Nov 9–11 | 2.5 | All |

**Parallel tracks (who is on what, by day):** D1–D2: everyone on Phase 1 then A→P2, B→P3, C→P6, D→P9 skeleton. D3–D5: A→P2/P5, B→P3/P4, C→P6, D→P9/P7 prep. D6–D8: integration (P6, P7), hardening starts (P8). D9–D10: freeze, P9 final, P10. The authoritative day-by-day table is `roadmap.md` §3; this file refines it into runbooks.

**Cross-cutting rules for every phase**
1. Branching: trunk-based; short-lived branches `phase-N/<topic>`; PR into `main`; **one reviewer** for any PR touching `src/server/release/`, `src/server/paypal/`, `src/server/verify/policy.ts`, or migrations.
2. Commit style: `type(scope): message` (e.g., `feat(release): capture only from PASSED`).
3. Each phase ends with a **git tag** named in its Handoff section.
4. Never put a PayPal call inside a DB transaction. Never call the Anthropic SDK outside `src/server/ai/llm.ts`.
5. Every task that handles input, external calls, or shared state includes validation, error handling, and named tests **in the same task**.

## Spec corrections surfaced while planning (applied in the spec files too)

| ID | Gap found | Correction (additive; no earlier decision reversed) |
|---|---|---|
| C-1 | `api-spec.md` §3 promises `Idempotency-Key` replays but `data-model.md` has no storage | Add table `idempotency_keys(user_id, route, key, request_hash, response_status, response_body, created_at)` — migration `0002` (Phase 2) |
| C-2 | `deployment.md` §6 needs a worker heartbeat but no table exists | Add `kv(key text pk, value jsonb, updated_at)` — migration `0002` |
| C-3 | `architecture.md` implies SSE events can be pushed in-process, but events are produced by the **worker** process | SSE routes **poll the DB** (ledger by `seq`, demo runs by event index) every 1.5 s; no pub/sub (Phase 6/7) |
| C-4 | Scenario runner execution model unspecified | Scenarios run as `DEMO_STEP` jobs in the worker; `demo_runs.events` is the transcript (Phase 7) |
| C-5 | No job type for voiding the hold after final failure or buyer cancel | Add enum value `VOID_REMAINING` — migration `0003` (separate file: Postgres cannot use a new enum value in the same transaction it is added) (Phase 5) |
| C-6 | `architecture.md` §5 says tx1 moves milestone `SUBMITTED→VERIFYING`; `data-model.md` §6 says the verification job does | **`data-model.md` §6 is authoritative:** tx1 sets `SUBMITTED`; the verify handler sets `VERIFYING` |
| C-7 | UI badge "Verified with PayPal" and "Reconcile now" need endpoints not in `api-spec.md` | Add `GET /contracts/{id}/funding-status` (cached 30 s live read of the authorization) and `POST /admin/reconcile` (admin only) (Phase 5/9) |
| C-8 | Env vars missing for Judge Mode and roles | Add `RUN_ROLE`, `SANDBOX_BUYER_EMAIL`, `SANDBOX_BUYER_PASSWORD` to `env.ts`/`deployment.md` |
| C-9 | Evaluating on the same 30 cases we tune on inflates results | Keep a **held-out** subset untouched until the final run (Phase 8) |

## Preconditions

- Specs read (`prd.md`, `architecture.md`, `project-structure.md`, `paypal-integration.md` §1, §12–13).
- Accounts exist or can be created today: GitHub repo (private until Nov 11, then public), PayPal Developer, Anthropic API key (with a **hard spend limit**), Render account.
- Machines have Node 20 LTS, Docker, Git.

## Implements

`project-structure.md` §1–§5 · `paypal-integration.md` §1, §12, §13 · `deployment.md` §4 (CI), §5 · `architecture.md` §3–§4 (layering rules) · `ux-flows.md` §2 (tokens) · `api-spec.md` §3 (shared types) · `security-privacy.md` §3 (env/secrets).

## Task breakdown

### 1.1 Repository (Owner D)
- [ ] `git init proofpay && cd proofpay`; create `LICENSE` (MIT, year 2026, team name), `.gitignore` (`.env*`, `!.env.example`, `.next/`, `node_modules/`, `*.log`, `coverage/`, `playwright-report/`).
- [ ] Create `docs/spec/` and copy all spec files from `proofpay-spec/`; copy `readme.md` → `README.md`.
- [ ] Push to GitHub; enable **secret scanning + push protection**; protect `main` (PR required, CI must pass).
- [ ] Create `docs/decision-log.md` with the template: `| Date | Decision | Owner | Reason |`.

### 1.2 Next.js + TypeScript scaffold (Owner C)
- [ ] `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` (answer yes to overwrite; keep spec docs).
- [ ] `tsconfig.json`: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": false`, `"paths": {"@/*": ["./src/*"]}`.
- [ ] Install runtime deps: `npm i drizzle-orm postgres zod ajv ajv-formats @anthropic-ai/sdk jose pino fast-json-patch zod-to-json-schema pdfkit ag-grid-react ag-grid-community lucide-react clsx tailwind-merge class-variance-authority @tanstack/react-query @modelcontextprotocol/sdk`.
- [ ] Install dev deps: `npm i -D drizzle-kit vitest @vitest/coverage-v8 msw tsx @playwright/test @axe-core/playwright fast-check @types/pdfkit @types/node pino-pretty prettier`.
- [ ] shadcn init: `npx shadcn@latest init` (style default, base color neutral, CSS variables yes).

### 1.3 Environment config (Owner A) — implements `deployment.md` §3, C-8
- [ ] `src/server/config/env.ts`: Zod schema + `export const env = parseEnv(process.env)`; fields: `NODE_ENV`, `APP_BASE_URL`, `DATABASE_URL`, `PAYPAL_ENV` (`z.literal('sandbox')`), `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` (optional until Phase 5), `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), `ANTHROPIC_MODEL_FAST` (default `claude-haiku-5-5`), `LLM_DAILY_BUDGET_USD` (coerce number, default 5), `SESSION_SECRET` (min 32 chars), `DEMO_MODE`, `DEMO_TIME_SCALE` (default 1, min 1), `CHAOS_MODE`, `MAX_CONTRACT_DAYS` (default 28, max 28), `PURGE_ENABLED` (default false), `LOG_LEVEL`, `RUN_ROLE` (`web|worker|mcp`), `SANDBOX_BUYER_EMAIL`, `SANDBOX_BUYER_PASSWORD`.
- [ ] Booleans parsed strictly (`'true'|'false'`); on failure print every issue (variable name only, never values) and `process.exit(1)`.
- [ ] `.env.example` with all keys, placeholder values, comments.
- [ ] Tests `tests/unit/env.test.ts`: `rejects PAYPAL_ENV=live`; `rejects short SESSION_SECRET`; `applies defaults`; `caps MAX_CONTRACT_DAYS at 28`; `does not echo secret values in error output`.

### 1.4 Core utilities (Owner A)
- [ ] `src/server/util/errors.ts`: `class AppError extends Error { code; httpStatus; details? }`, `toErrorResponse(err, requestId)` returning `{error:{code,message,details?,request_id}}` per `api-spec.md` §3; unknown errors → `500 INTERNAL` with generic message.
- [ ] `src/server/util/logger.ts`: `logger` (pino, JSON in prod, `pino-pretty` in dev), `childLogger({request_id, contract_id?})`, redaction paths `['*.password','*.secret','*.authorization','req.headers.authorization','req.headers.cookie']`.
- [ ] `src/server/util/time.ts`: `now(): Date` (overridable via `setNowForTests`), `addDays`, `addHours`, `isoMs(d)`, `scaledMs(ms)` = `ms / env.DEMO_TIME_SCALE` (rounded, min 1000).
- [ ] `src/server/util/ids.ts`: `newRequestId()` (`req_` + 20 chars), `shortId(uuid)` (first 8 hex).
- [ ] Tests: `errors.test.ts` (`maps AppError to response shape`, `hides internal error messages`), `time.test.ts` (`scaledMs divides by DEMO_TIME_SCALE`, `scaledMs never below 1000ms`, `isoMs has millisecond precision`).

### 1.5 Local Postgres (Owner D)
- [ ] `docker-compose.yml`: `postgres:16`, port 5432, env `POSTGRES_USER=proofpay POSTGRES_PASSWORD=proofpay POSTGRES_DB=proofpay`, named volume, healthcheck `pg_isready -U proofpay`. Second DB `proofpay_test` created by `docker/init-test-db.sql`.
- [ ] Scripts in `package.json`: `db:up` (`docker compose up -d`), `db:down`, `db:reset` (`docker compose down -v && docker compose up -d`).

### 1.6 Shared types from the API spec (Owner B) — implements `api-spec.md` §3
- [ ] `src/shared/types.ts`: Zod schemas + inferred types for `LintIssue`, `CriterionResult`, `VerificationView`, `MilestoneView`, `ContractView`, `LedgerEvent`, `ApiError`, enums `ContractStatus`, `MilestoneStatus`, `CriterionType`, `Decision` (values exactly as `data-model.md` §2).
- [ ] `src/shared/api-client.ts`: `createApiClient({ baseUrl, apiKey? })` returning typed methods **stubs** (throw `NotImplemented`) for every endpoint in `api-spec.md` §4–§8; shared `request<T>()` doing: JSON parse, error mapping to `ApiClientError(code, status, requestId)`, `Idempotency-Key` support.
- [ ] Tests `tests/unit/shared-types.test.ts`: `parses ContractView sample from api-spec §10`, `parses VerificationView REJECT sample`, `rejects unknown milestone status`.

### 1.7 Boundary lint rules (Owner A) — implements `architecture.md` §3 layering rules
- [ ] `eslint.config.mjs`: `no-restricted-imports` patterns: (a) `@/server/paypal/capture|void|refund` allowed only in `src/server/release/**`; (b) `@anthropic-ai/sdk` allowed only in `src/server/ai/llm.ts`; (c) `src/app/**` may not import `@/server/paypal/*` or `@/server/ai/*`; (d) `src/server/verify/policy.ts` may import only from `@/shared/*` and local type files.
- [ ] Test `tests/unit/lint-boundaries.test.ts` using ESLint Node API: `rejects importing capture from an API route`, `rejects Anthropic SDK import outside llm.ts`, `allows capture import inside release/service.ts`.

### 1.8 CI and scripts (Owner D) — implements `deployment.md` §4, `project-structure.md` §5
- [ ] `package.json` scripts exactly: `dev`, `build`, `start`, `worker` (`tsx watch src/worker/index.ts`), `worker:start` (`tsx src/worker/index.ts`), `mcp`, `mcp:start`, `db:generate`, `db:migrate` (`tsx scripts/migrate.ts`), `seed` (`tsx scripts/seed.ts`), `test`, `test:unit`, `test:integration`, `test:e2e`, `eval`, `chaos`, `lint`, `typecheck` (`tsc --noEmit`), `spike:paypal`.
- [ ] `vitest.config.ts`: projects `unit` (`tests/unit/**`) and `integration` (`tests/integration/**`, `globalSetup` added in Phase 2), alias `@` → `src`.
- [ ] `.github/workflows/ci.yml`: jobs `lint-typecheck-unit` (Node 20, `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:unit`), `secrets` (`gitleaks/gitleaks-action`), `build` (`npm run build`).
- [ ] Verify CI is green on an empty PR.

### 1.9 Design tokens and shell (Owner C) — implements `ux-flows.md` §2
- [ ] `src/app/globals.css`: CSS variables `--bg --surface --text --muted --brand --ok --warn --bad --void` for light and dark exactly as `ux-flows.md` §2; map into `tailwind.config.ts` (`colors.brand: 'var(--brand)'`, etc.); load Inter + JetBrains Mono via `next/font`.
- [ ] `src/app/layout.tsx`: `<html lang="en">`, theme provider (system + manual toggle stored in `localStorage`), skip-to-content link, header with wordmark "ProofPay", `ThemeToggle`.
- [ ] `src/app/page.tsx`: placeholder landing with tagline and the honesty line.
- [ ] Playwright config + `tests/e2e/smoke.spec.ts`: `landing renders in light mode`, `landing renders in dark mode`, `skip link is first focusable element`.

### 1.10 PayPal accounts and the spike (Owner A) — implements `paypal-integration.md` §1, §12
- [ ] Create sandbox **Business** and **Personal** accounts; create a Sandbox REST app under the Business account; put credentials in `.env`; note buyer email/password in a password manager (not git).
- [ ] `scripts/paypal-spike.ts` (standalone, **not** the final adapter): helper functions `getToken()`, `pp(method, path, body?, {requestId, mock?})`, `redact(obj)`, `log(step, req, res)` appending to `docs/spike-log.md`; random suffix on every `invoice_id` (`PP-SPIKE-<nanoid6>`).
- [ ] Implement steps from `paypal-integration.md` §12 as functions `step1CreateOrder`, `step2WaitForApproval` (prints URL, waits for Enter), `step3Authorize`, `step4CapturePartial(60.00)`, `step5GetAuthorization`, `step6CaptureFinal(40.00)`, `step7VoidFlow`, `step8ReauthorizeProbe`, `step9DeclinedCapture` (header `PayPal-Mock-Response: {"mock_application_codes":"INSTRUMENT_DECLINED"}`), `step10WebhookCheck` (only if `WEBHOOK_URL` env set).
- [ ] Each step asserts and prints `PASS`/`FAIL` with PayPal `debug_id` on failure. Exit code non-zero if steps 1–7 or 9 fail.
- [ ] Record answers to the **⚠ verify list** (`paypal-integration.md` §13) in `docs/spike-log.md` under "Findings": approval link relation, `expiration_time` presence, reauthorize response, honored mock codes, webhook payload fields (`invoice_id`/`custom_id`), `final_capture` leftover behavior.
- [ ] **Gate (Nov 3, 12:00 IST):** write the result in `docs/decision-log.md`: `GATE PASS` or `GATE FAIL → pivot to Trust-gated Payouts (roadmap.md §6)`.

### 1.11 Render skeleton (Owner D) — implements `deployment.md` §1–§2
- [ ] Create Render Postgres (paid non-expiring tier; confirm plan), web service from the repo (`npm run build`/`npm run start`), env group `proofpay-shared` with placeholder secrets.
- [ ] `src/app/api/v1/health/route.ts` returns `{status:'ok', version: process.env.RENDER_GIT_COMMIT ?? 'dev'}` (full health in Phase 3/9).
- [ ] Confirm the hosted URL serves the landing page. Record the URL and Render credit balance in `docs/decision-log.md`.

## Real-world engineering concerns (this phase)
- **Secrets:** nothing sensitive in git; `.env.example` only; gitleaks in CI; spike log redacts tokens and secrets.
- **Idempotency in the spike:** unique `invoice_id` suffix and unique `PayPal-Request-Id` per step so re-runs don't collide.
- **Observability hook:** logger with `request_id` exists before any route does.
- **Failure handling in the spike:** every call has a timeout (15 s) and prints the response body on non-2xx.

## Definition of done (objectively checkable)
- [ ] `npm ci && npm run lint && npm run typecheck && npm run test:unit && npm run build` passes locally and in CI on `main`.
- [ ] `docker compose up -d` gives a reachable Postgres; `npm run dev` serves `http://localhost:3000` in light and dark.
- [ ] `npm run test:unit` includes the named tests above (env, errors, time, shared-types, lint-boundaries) and all pass.
- [ ] `tests/e2e/smoke.spec.ts` passes.
- [ ] `docs/spike-log.md` shows steps 1–7 and 9 **PASS** with real PayPal IDs; "Findings" section filled.
- [ ] `docs/decision-log.md` contains the gate decision, the Render URL, and the credit balance.
- [ ] Hosted `GET /api/v1/health` returns `200 {"status":"ok"}`.
- [ ] All nine spec corrections C-1…C-9 are reflected in the spec files (or logged as pending with an owner).

## Risks & blockers
| Risk | Likelihood | Mitigation |
|---|---|---|
| PayPal sandbox setup/approval slow or flaky | Medium | Start the spike first thing on Nov 2; keep a second sandbox buyer account ready |
| Partial capture not allowed on the account | Low–Medium | Check dashboard settings; try a different Business account type; else execute the pivot (`roadmap.md` §6) |
| `create-next-app` overwrites docs | Low | Scaffold in a temp folder, then move files; commit before scaffolding |
| Windows/WSL path or Docker issues | Medium | Standardize on WSL2 or devcontainer; document in README |
| Render credit uncertainty | Medium | Record balance; fall back to smallest paid tier |

## Time budget
**3 person-days** (A 1.0 spike + env + utils; B 0.5 shared types; C 0.75 shell/tokens; D 0.75 repo/CI/Compose/Render). **Cut first if long:** theme toggle, Render skeleton (move to Phase 9), lint-boundary tests.

## Handoff
Next phases can assume: strict TypeScript project builds; `env` validated; `AppError` and `logger` available; shared Zod types exist; Postgres via Compose; CI green; spike results known and the go/no-go decision made.
**Tag:** `git tag phase-1-scaffolding && git push --tags`
