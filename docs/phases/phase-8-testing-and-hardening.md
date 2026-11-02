# Phase 8 — Testing, Eval, Chaos & Hardening

> **Goal (done means):** the claims in the README are backed by generated results: verifier eval numbers (with a held-out split and honest statistics), a PayPal chaos suite with **0 double captures**, an IDOR/CSRF/header security matrix, degraded-mode drills, and E2E/a11y suites green in CI.
> **Window:** Fri Nov 6 → Tue Nov 10 (three eval/chaos runs: Nov 6 baseline, Nov 8 after tuning, Nov 10 final) · **Budget:** 4 person-days · **Owners:** B (eval, prompts), A (chaos, security matrix), C (E2E/a11y), D (CI, drills, smoke load).

## Preconditions
- Phases 4, 5, 6, 7 tagged (eval and chaos need the real pipeline, release service, UI and scenarios).
- A funded sandbox contract capacity for chaos runs (see 8.3), real `ANTHROPIC_API_KEY` with a budget ≥ $10 for eval iterations (separate from the demo's daily cap; set `LLM_DAILY_BUDGET_USD` higher locally).

## Implements
`testing.md` §1–§7 · `ai-pipeline.md` §7 (evaluation) · `paypal-integration.md` §9 (chaos) · `security-privacy.md` §4, §7 · `edge-cases.md` (all P0 items) · `prd.md` §9 (success metrics) · correction **C-9** (held-out split).

## Task breakdown

### 8.1 Eval harness and fixtures (Owner B) — `testing.md` §4
- [ ] `tests/eval/generate-fixtures.ts`: deterministic (seeded PRNG `mulberry32(seed)`) generator exporting `makeDataset({ rows, duplicateSku?, badEmailAt?, negativePriceAt?, badCategoryAt?, templateDescriptions?, injectionIn?: 'description'|'name' })` and `makeSummary({ words, categories, injection?: 'plain'|'zero_width'|'fake_role'|'spanish'|'reveal_rubric'|'keyword_dump', longPad? })`; writes `tests/eval/cases/*.json` for **P01–P10, F01–F10, A01–A10** exactly as the `testing.md` §4 tables (fields: `id, group, milestone, artifact, expected, notes`).
- [ ] `tests/eval/contracts/demo.json` (copy of `tests/fixtures/demo-contract.json`) and `tests/eval/m1-context.json` (the accepted m1 dataset used as context for all m2 cases).
- [ ] `tests/eval/HELDOUT.md` — **freeze the held-out list before any tuning (C-9):** `P03, P09, F04, F09, A02, A03, A04, A06, A07, A09` (10 cases, covering all groups). Rule: prompts/thresholds are tuned **only** using the other 20 (dev set); the held-out set is run once on Nov 8 and once on Nov 10, and **results are reported separately**.
- [ ] `tests/eval/run.ts` (`npm run eval [-- --case P01 --set dev|heldout|all --no-cache]`): for each case run `runVerification` against a throwaway contract/milestone (created via repos, funded flag irrelevant) with **cache disabled**; record `decision`, reasons, `manipulation_severity`, latency, token cost (from `llm_calls`), raw/verified quote counts; compute metrics (definitions in `testing.md` §4): **false passes** over F01–F09 + A01–A10 (F10 excluded as the documented optional-criterion case), false rejects over P01–P10, escalation rate, verified-quote rate, raw hallucination rate, p50/p95 latency, mean cost; evaluate `REJECT_OR_ESCALATE` expectations as satisfied by either; write `docs/eval-results.md` with per-case table, aggregates for `dev`, `heldout`, `all`, the rule-of-three caveat (`3/n` upper bound), model and `PROMPT_VERSION`s, git SHA, timestamp.
- [ ] Unit tests `tests/unit/eval-metrics.test.ts`: `false pass counts PASS on a non-PASS expectation`, `REJECT_OR_ESCALATE accepts either`, `F10 excluded from false-pass denominator`, `rule of three computed as 3/n`, `p95 latency computed`.

### 8.2 Baseline, tuning loop and failure triage (Owner B)
- [ ] **Baseline (Nov 6):** run `npm run eval -- --set dev --no-cache` → commit `docs/eval-results.md` as `eval-baseline-dev`.
- [ ] Triage table in `docs/eval-triage.md`: for each unexpected result record `case`, `stage that failed` (det/rubric/adversarial/policy), `root cause`, `fix type` (`policy rule` > `heuristic` > `prompt wording` > `threshold`), `owner`. **Policy/code fixes are preferred over prompt tweaks**; any prompt change bumps `PROMPT_VERSION` (`rubric.v2`, `adversarial.v2`) and invalidates cache keys.
- [ ] Re-run dev set after each change (budget guard: ≤ 6 full dev runs).
- [ ] **Held-out runs:** Nov 8 (`--set heldout`) and Nov 10 final (`--set all`). If a held-out false pass appears, fix the **policy/heuristic** root cause (not a case-specific hack), re-run **only** the dev set, then run held-out one final time on Nov 10 and report the history honestly in `docs/eval-results.md` ("held-out run 1: x; after fix: y").
- [ ] Update README "Evaluation results" table with the real numbers and the caveat sentence.

### 8.3 PayPal chaos suite (Owner A) — `testing.md` §5
- [ ] `tests/chaos/harness.ts`: `createChaosContract()` builds a contract with **5 milestones of $1.00 each** (total $5.00; text deliverables with a single deterministic `word_count` criterion so verification is cheap and LLM-free), runs propose/accept via API, funds it via the real sandbox (operator approves **once** when prompted), returns handles `{contractId, buyerClient, sellerClient}`; `passMilestone(key)` submits the fixture and waits for `PASSED/RELEASING`; `waitFor(status, timeout)`; helpers to count captures via `getOrder`.
- [ ] `scripts/run-chaos.ts` (`npm run chaos`): executes C01–C13 (`testing.md` §5) and writes `docs/chaos-results.md` (case, method, expected, observed, pass/fail, ledger excerpt, PayPal debug ids, notes on unsupported mock codes):
  - **Real sandbox (uses milestones m1–m4 of the chaos contract):** C01 `INSTRUMENT_DECLINED` on m1 → `RELEASE_FAILED` → retry → `RELEASED`; C02 `TRANSACTION_REFUSED` on m2; C03 `INTERNAL_SERVER_ERROR` on m3 → same-key retries → reconcile → at most one capture; C04 `DUPLICATE_INVOICE_ID` on m4 (or forced by reusing invoice id) → no double capture; m5 is the **clean final capture** (`final_capture:true`) proving the authorization closes.
  - **MSW/DB-based:** C05 timeout, C06 429, C07 duplicate webhook, C08 webhook-before-commit race (delay commit hook), C09 bad signature, C10 worker `kill -9` mid-release (spawn worker as child process, kill after `CAPTURE_REQUESTED`, restart, assert one capture), C11 expired authorization (set `auth_expires_at` in the past), C12 over-capture guard (direct service call), C13 reauth failure.
- [ ] If a mock code is **not honored** by the sandbox for capture, mark that case `UNSUPPORTED_BY_SANDBOX` in the results (honest) and cover the behavior with MSW instead; the pass criterion "≥ 10 of 12 + 0 double captures" counts MSW-covered cases.
- [ ] Unit/integration tests for harness helpers: `countCaptures counts only COMPLETED`, `waitFor times out with a helpful error`.

### 8.4 Security and abuse matrix (Owner A) — `security-privacy.md` §4, §7
- [ ] `tests/integration/idor.test.ts` (complete from Phase 3 scaffold): generated from a route table `ROUTES: {method, path, roles, bodyFactory}` covering **every** route in `api-spec.md`; for each, assert: stranger → 404 (or 403 for role-only routes), wrong role → 403/404, agent-flagged on `decision|cancel|refund|retry-release` → 403 `FORBIDDEN_FOR_AGENT`, unauthenticated → 401. Test `route table covers every route file under src/app/api/v1` (walks the filesystem so new routes can't be forgotten).
- [ ] `tests/integration/security.test.ts`: `CSRF: cookie-auth POST with foreign Origin rejected`, `API-key POST without Origin accepted`, `security headers present on pages and API`, `webhook invalid signature does not change state`, `oversized body rejected before parsing`, `JSON depth 21 rejected`, `chaos endpoints 404 when CHAOS_MODE=false`, `demo endpoints 404 when DEMO_MODE=false`, `rate limits trigger 429`, `API key secrets absent from logs` (capture pino output), `PayPal client secret absent from logs and error responses`.
- [ ] Repo hygiene: run `gitleaks detect --redact` locally and in CI; verify `.env` untracked (`git ls-files | grep -E "^\.env$"` empty); confirm Anthropic provider-side hard limit and PayPal app secret rotation procedure written in `docs/runbook.md`.
- [ ] Dependency audit: `npm audit --omit=dev` (document accepted risks), lockfile committed.

### 8.5 Degraded-mode and failure drills (Owner D + B)
- [ ] `tests/integration/degraded.test.ts`: `budget exhausted: compile returns 429, verification escalates with VERIFIER_UNAVAILABLE`, `LLM transport throws: deterministic reject still works`, `LLM invalid output twice: stage treated unavailable`, `DB restart mid-request returns 503 and recovers`, `worker restart resumes queued jobs`.
- [ ] Manual drills recorded in `docs/drills.md` (date, who, result): (1) set `LLM_DAILY_BUDGET_USD=0.01` and run `reject_then_pass`; (2) revoke the Anthropic key and run a verification; (3) `kill -9` the worker during a release (live sandbox); (4) block outbound PayPal (hosts file) during funding; (5) PayPal webhook disabled → ensure reconcile finishes the release within 5 minutes.

### 8.6 E2E, accessibility and smoke load (Owner C, D)
- [ ] Ensure all specs from Phase 6/7 run in CI nightly and on PRs to `main` (`npm run test:e2e` against a test server with stubbed PayPal); add `tests/e2e/scenarios.spec.ts` (`all five scenarios reach DONE in test mode`).
- [ ] `scripts/smoke-load.ts`: with `FakeLLM`, 20 concurrent compile requests, 10 concurrent submissions across 10 contracts, 5 concurrent decisions; assert no 5xx, no deadlocks (`lock_timeout` errors = 0), job queue drains within 60 s, ledger chains valid for all contracts.
- [ ] Coverage report: `vitest --coverage` thresholds: `src/server/verify/policy.ts` 100% branches, `src/server/release/service.ts` ≥ 95% branches, overall statements ≥ 70%.

### 8.7 Results publication (Owner B/A)
- [ ] Commit `docs/eval-results.md`, `docs/chaos-results.md`, `docs/drills.md`, `docs/a11y-check.md`; update `README.md` tables with real numbers; link the three docs from the README and the Devpost text.

## Real-world engineering concerns
- **Honest statistics:** state sample sizes, the rule-of-three upper bound, the dev/held-out split and any tuning history; do not claim "100% accurate".
- **Test isolation:** eval and chaos use dedicated users/contracts and unique `invoice_id` suffixes so re-runs don't collide; cache disabled for eval.
- **Real-sandbox rate limits and flakiness:** serialize chaos steps; retry harness-level waits, **not** assertions on money invariants.
- **Cost:** eval runs ≈ 30 cases × (≈ 2 LLM calls) per run; track spend in `llm_calls`; stop at the budget.
- **Observability in tests:** capture pino logs per test; attach PayPal `debug_id`s to chaos results for support escalation.
- **Time zones/clock:** use injectable `now()` in tests; never `sleep` for scheduled behavior — advance the fake clock.

## Definition of done
- [ ] `docs/eval-results.md` exists with dev, held-out and all-set sections; **false passes = 0 on the 19 non-pass cases** (or each exception is documented with root cause and fix status); false rejects ≤ 1/10; verified-quote rate 100%; p95 latency ≤ 20 s; mean cost ≤ $0.03 (or the real number stated).
- [ ] `docs/chaos-results.md` shows ≥ 10 of 12 cases passing (MSW-covered counted), **0 double captures**, the clean final capture on m5, and a list of any sandbox-unsupported mock codes.
- [ ] `tests/integration/idor.test.ts` passes and its coverage test fails if a new route is added without a table row.
- [ ] CI is green on `main`: lint, typecheck, unit, integration (with Postgres service), build, gitleaks; nightly E2E green for 2 consecutive days.
- [ ] `policy.ts` 100% branch coverage; `release/service.ts` ≥ 95% branch coverage.
- [ ] Degraded-mode drills 1–5 executed and logged with outcomes.
- [ ] README evaluation table contains the real numbers and links to the three result docs.

## Risks & blockers
| Risk | Mitigation |
|---|---|
| False pass found late | Fix at policy/heuristic level, re-run dev, then held-out once more; if unresolved by Nov 10, add a **required** `human` criterion to the demo contract's rubric steps and document the limitation |
| Chaos runs consume sandbox approvals | One funded chaos contract serves C01–C04 + final capture; MSW covers the rest |
| Mock codes unsupported on capture | Report as `UNSUPPORTED_BY_SANDBOX`; rely on MSW; do not claim live coverage |
| Eval budget burn | Dev set ≤ 6 runs; held-out ≤ 2; cache off only in eval |
| Flaky E2E | Run against stubbed PayPal; retries only for navigation timeouts, not assertions |

## Time budget
**4 person-days** (B 1.75 eval/tuning; A 1.25 chaos+security; C 0.5 E2E/a11y; D 0.5 CI/drills/load). **Cut first if long:** smoke-load script, C13, coverage thresholds beyond `policy.ts`/`release/service.ts`, nightly E2E. **Do not cut:** eval with held-out split, chaos C01–C04 + C10, IDOR matrix, degraded-mode drills 1–3.

## Handoff
Next phases can assume: measured, documented verifier and resilience results; security matrix passes; CI is a reliable regression gate; no known P0 defects (open issues labeled `P0` = 0).
**Tag:** `git tag phase-8-hardening && git push --tags`
