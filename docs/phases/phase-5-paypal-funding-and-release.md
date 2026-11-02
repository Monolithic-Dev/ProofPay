# Phase 5 — PayPal Funding, Release & Housekeeping

> **Goal (done means):** on the PayPal **sandbox**, a buyer funds a contract (authorize hold), verified milestones are released by **partial captures** (last one `final_capture`), failed contracts and cancellations **void** the remaining hold, and the system survives declines, timeouts, duplicate/out-of-order webhooks, worker crashes, expiry, and reauthorization — with **zero double captures**.
> **Window:** Wed Nov 4 → Sat Nov 7 · **Budget:** 6 person-days · **Owner:** A (lead), B reviews money-path PRs; D supports webhook registration.

## Preconditions
- Phase 1 spike **GATE PASS** (steps 1–7 and 9 passed; findings in `docs/spike-log.md`). If the gate failed, do **not** start this phase; run the pivot plan (`roadmap.md` §6).
- Phase 2 (`withTx`, `lockContract`, ledger, queue, repos), Phase 3 (accepted contracts), Phase 4 (milestones reach `PASSED`, `RELEASE_MILESTONE` jobs enqueued, worker loop).
- Public webhook URL available: tunnel for local dev; Render URL for hosted. `PAYPAL_WEBHOOK_ID` configured.

## Implements
`paypal-integration.md` §2–§10 (and §13 findings) · `api-spec.md` §6 · `data-model.md` §3.3, §3.4, §3.9, §5, §6 · `prd.md` FR-10…FR-13, FR-24…FR-33, FR-42 · `edge-cases.md` E-12, E-14…E-17, E-19, E-22…E-31, E-41 · `security-privacy.md` T2, T3, T9 · corrections **C-5, C-7**.

## Task breakdown

### 5.1 Money helpers (Owner A)
- [ ] `src/server/paypal/money.ts`: `toPayPalValue(minor: number): string` (integer → `"60.00"` using integer math: `Math.trunc(minor/100)` and `String(minor%100).padStart(2,'0')`, rejects non-integers, negatives, > 5,000,000), `fromPayPalValue(s: string): number` (regex `^\d+\.\d{2}$`, no floats).
- [ ] Tests `tests/unit/money.test.ts`: `6000 -> "60.00"`, `5 -> "0.05"`, `0 rejects`, `1.5 rejects`, `"60.00" -> 6000`, `"60.0" rejects`, `round-trips 1..10000`.

### 5.2 PayPal HTTP client (Owner A) — `paypal-integration.md` §3, §4
- [ ] `src/server/paypal/client.ts`: `getAccessToken()` (OAuth client-credentials; cache in memory until `expires_in − 60 s`; single-flight refresh); `paypalFetch<T>(method, path, { body?, requestId?, mockCode?, timeoutMs=10000 })` with headers `Authorization`, `Content-Type`, `Prefer: return=representation`, `PayPal-Request-Id` (POST only), optional `PayPal-Mock-Response` **only when `env.CHAOS_MODE && mockCode`**; refuse any base URL other than `https://api-m.sandbox.paypal.com`; `AbortController` timeout; retry policy: network/timeout/5xx/429 → same `requestId`, 3 retries at 1 s/3 s/9 s ±20% jitter (honor `Retry-After` for 429); `401` → refresh token once; other `4xx` → no retry.
- [ ] `src/server/paypal/errors.ts`: `class PayPalError extends AppError` (`code:'PAYPAL_ERROR'`, `httpStatus:422`, `details:{ status, name, issue, debug_id, message }`), `isAmbiguous(err)` (true for timeout/network/5xx after retries).
- [ ] Tests `tests/integration/paypal-client.test.ts` (MSW): `caches token between calls`, `refreshes once on 401`, `retries 503 with the same PayPal-Request-Id`, `does not retry 422 INSTRUMENT_DECLINED`, `times out after 10s and reports ambiguous`, `adds mock header only in CHAOS_MODE`, `refuses non-sandbox base URL`, `logs debug_id and never the token`.

### 5.3 Orders and authorization adapters (Owner A) — `paypal-integration.md` §3.1–§3.2, §3.5, §3.7
- [ ] `src/server/paypal/orders.ts`: `createOrder({ contractId, title, totalMinor, returnUrl, cancelUrl, requestId })` (body exactly as `paypal-integration.md` §3.1; `invoice_id = 'PP-' + shortId(contractId)`); `extractApprovalUrl(links)` (`payer-action` then `approve`; throws if none); `authorizeOrder(orderId, requestId)` returning `{ authorizationId, status, createTime, expirationTime? }` parsed from `purchase_units[0].payments.authorizations[0]`; `getOrder(orderId)` returning captures list `{id, status, invoice_id, amount}[]`.
- [ ] `src/server/paypal/authorizations.ts`: `getAuthorization(id)` → `{ status, amount, ... }`; `reauthorize(id, requestId)` → `{ newAuthorizationId, status }`.
- [ ] Tests (MSW): `createOrder sends intent AUTHORIZE and CONTINUE`, `extractApprovalUrl prefers payer-action`, `authorizeOrder parses authorization id and times`, `authorizeOrder fails clearly when status is not CREATED`, `getOrder lists captures by invoice_id`.

### 5.4 Capture / void / refund adapters (Owner A) — only imported by `release/` (lint-enforced)
- [ ] `src/server/paypal/capture.ts`: `captureAuthorization({ authorizationId, amountMinor, finalCapture, invoiceId, note, requestId, mockCode? })` → `{ captureId, status: 'COMPLETED'|'PENDING'|'DECLINED'|string, raw }`.
- [ ] `src/server/paypal/void.ts`: `voidAuthorization(authorizationId, requestId)`; `src/server/paypal/refund.ts`: `refundCapture({ captureId, amountMinor?, note, requestId })`.
- [ ] Tests (MSW): `capture sends amount, final_capture and unique invoice_id`, `capture returns PENDING without throwing`, `capture maps INSTRUMENT_DECLINED to PayPalError`, `void succeeds on 204`, `refund omits amount for full refund`.

### 5.5 Funding flow (Owner A) — FR-10…FR-13, `api-spec.md` §6
- [ ] `src/server/funding/service.ts`:
  - `startFunding({ contractId, user, idempotencyKey })`: buyer only; contract `ACCEPTED` (or `FUNDING` with existing order → return the same approval URL, **E-12**); all `due_in_days ≤ MAX_CONTRACT_DAYS`; **create the order outside any transaction** with `requestId = 'pp:' + contractId + ':fund:1'`; then `withTx`: lock, `ACCEPTED→FUNDING`, store `paypal_order_id`, ledger `FUNDING_STARTED`; return `{ paypal_order_id, approval_url }`.
  - `handlePayPalReturn({ token, contractId, user })`: verify `token === contract.paypal_order_id`; if already `FUNDED` → redirect (idempotent); `authorizeOrder` (outside tx, `requestId 'pp:'+id+':authorize:1'`); then `withTx`: set `authorization_id`, `auth_created_at`, `honor_until = +3d`, `auth_expires_at = expiration_time ?? +29d`, `funded_at`, each milestone `due_at = funded_at + due_in_days`; `FUNDING→FUNDED`; ledger `AUTHORIZATION_CREATED`.
  - `handlePayPalCancel({ contractId, user })`: `FUNDING→ACCEPTED`, clear `paypal_order_id`, ledger note `FUNDING_CANCELLED` (add this type to `LEDGER_EVENT_TYPES` and `data-model.md` §5 payload `{paypal_order_id}`).
- [ ] Routes: `contracts/[id]/fund/route.ts` (POST, idempotent), `paypal/return/route.ts` (GET → 302 to `/contracts/{id}?funded=1` or `?error=<code>`), `paypal/cancel/route.ts` (GET → 302 `?cancelled=1`).
- [ ] **New endpoint (C-7):** `contracts/[id]/funding-status/route.ts` (GET): live `getAuthorization` cached 30 s in memory → `{ status, checked_at, authorized_minor }`; powers the "Verified with PayPal" badge.
- [ ] Tests `tests/integration/funding.test.ts` (MSW): `fund returns approval_url and moves contract to FUNDING`, `second fund call returns same order (no duplicate createOrder)`, `return handler authorizes and sets hold fields and milestone due dates`, `return with wrong token is rejected 400`, `second return is idempotent`, `cancel returns contract to ACCEPTED`, `fund rejected when contract not ACCEPTED`, `fund rejected for seller`, `PayPal 5xx on authorize leaves contract FUNDING and is reconcilable`.

### 5.6 Release service — the only gateway to money (Owner A, reviewed by B) — `paypal-integration.md` §5
- [ ] `src/server/release/service.ts`:
  - `releaseMilestone(milestoneId): Promise<ReleaseOutcome>` exactly per §5: **TX-A** (lock; guards: status ∈ {`PASSED`,`RELEASE_FAILED`}; contract ∈ {`FUNDED`,`IN_PROGRESS`}; `now() < auth_expires_at`; all earlier milestones `RELEASED`; `Σcaptured + amount ≤ total`; set `RELEASING`; `release_attempts += 1` when coming from `RELEASE_FAILED`; ledger `CAPTURE_REQUESTED`) → capture call outside any tx with `requestId = pp:{contractId}:{milestoneKey}:capture:{release_attempts or 1}`, `invoiceId = 'PP-'+shortId(contractId)+'-'+milestoneKey`, `finalCapture = milestone.idx === maxIdx`, `mockCode` consumed from `contracts.chaos_mock_code` (one-shot; cleared in TX-A) → **TX-B** (lock; `COMPLETED` → `RELEASED` + `capture_id` + `captured_at` + `CAPTURE_COMPLETED`, and if last → contract `COMPLETED` + `CONTRACT_COMPLETED`; `PENDING` → stay `RELEASING` + enqueue `RECONCILE_PAYPAL` at +60 s; `DECLINED`/business error → `RELEASE_FAILED` + `CAPTURE_FAILED{paypal_error, mock}`; ambiguous error → leave `RELEASING`, rethrow so the job retries with the **same** key).
  - `voidRemaining(contractId, reason: 'final_failure'|'buyer_cancel'|'expired')`: lock; compute `remaining_minor`; call `voidAuthorization` outside tx (key `pp:{contractId}:void:1`); tx: milestones in `FAILED_FINAL` → `VOIDED`, remaining `PENDING|REJECTED` → `VOIDED`; contract → `FAILED` (final_failure) / `CANCELLED` / `EXPIRED`; ledger `AUTHORIZATION_VOIDED {authorization_id, remaining_minor, reason}` then `CONTRACT_FAILED|CANCELLED|EXPIRED`.
  - `refundMilestone({ contractId, milestoneKey, user, amountMinor?, reason })` `[S]`: seller only, `forbidAgent`, status `RELEASED`, guard `amount ≤ captured − refunded`; ledger `REFUND_ISSUED`.
- [ ] Migration **C-5**: `drizzle/0003_job_void_remaining.sql`: `ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'VOID_REMAINING';` (own file, own transaction). Update `schema.ts` enum.
- [ ] Handlers: `src/server/jobs/handlers/release-milestone.ts` (`handleReleaseMilestone`), `src/server/jobs/handlers/void-remaining.ts` (`handleVoidRemaining`); register in worker. Wire Phase 4's stub: `applyDecision` on `FAILED_FINAL` now calls `enqueueJob({type:'VOID_REMAINING', payload:{contract_id, reason:'final_failure'}, dedupeKey:`void:${contractId}`})`. Buyer cancel (`cancelContract` for `FUNDED|IN_PROGRESS` without active verification) transitions to `CANCELLED` and enqueues `VOID_REMAINING` with `reason:'buyer_cancel'`.
- [ ] Retry endpoint: `contracts/[id]/milestones/[mid]/retry-release/route.ts` (POST; buyer, `forbidAgent`; milestone `RELEASE_FAILED`; clears `chaos_mock_code`; enqueue `RELEASE_MILESTONE` with `dedupeKey release:{id}:{release_attempts+1}`). Chaos endpoint: `contracts/[id]/chaos/route.ts` (POST `{mock_code}`; `CHAOS_MODE` only else 404; buyer; allowed codes enum).
- [ ] Tests `tests/integration/release.test.ts` (MSW) — names from `testing.md` §2.4: `throws for every milestone status except PASSED and RELEASE_FAILED` (table-driven), `refuses capture before earlier milestone is RELEASED`, `refuses capture when sum would exceed total`, `refuses capture after authorization expiry`, `capture success marks RELEASED and writes ledger`, `final_capture true only on last milestone`, `last release completes the contract`, `declined capture marks RELEASE_FAILED`, `retry uses new idempotency key (attempt 2)`, `timeout then success uses the same key and records one capture`, `PENDING capture stays RELEASING and enqueues reconcile`, `two concurrent RELEASE_MILESTONE jobs produce one capture`, `voidRemaining voids and fails contract`, `buyer cancel voids hold`, `chaos code is consumed after one capture`, `refund cannot exceed captured amount`, `captured_at and capture_id satisfy DB CHECK`.

### 5.7 Webhooks (Owner A) — `paypal-integration.md` §6
- [ ] `src/server/paypal/webhooks.ts`: `verifyWebhookSignature(headers, rawBody)` (POST `/v1/notifications/verify-webhook-signature` with `webhook_id: env.PAYPAL_WEBHOOK_ID`; success only when `verification_status === 'SUCCESS'`); `handlePayPalEvent(event)` mapping per the §6 table (match by `invoice_id` / `custom_id` / `capture_id` / `authorization_id`; never move status backwards; unknown contract → store and ignore).
- [ ] Route `src/app/api/v1/webhooks/paypal/route.ts`: read `await req.text()` (**raw body**), verify, insert `paypal_events` with `ON CONFLICT (event_id) DO NOTHING`, respond `400` on invalid signature (stored with `signature_valid=false`), otherwise `200` after processing; wrap in try/catch so handler errors enqueue `RECONCILE_PAYPAL` and still return `200` (PayPal retries otherwise).
- [ ] Tests `tests/integration/webhooks.test.ts`: `valid signature processes capture completed`, `invalid signature returns 400 and changes nothing`, `duplicate event_id is ignored`, `CAPTURE.COMPLETED before API response committed converges to RELEASED once`, `CAPTURE.DENIED moves RELEASING to RELEASE_FAILED`, `unexpected AUTHORIZATION.VOIDED sets funding_at_risk`, `self-initiated void is a no-op`, `event for unknown contract is stored and ignored`, `handler never moves RELEASED back to RELEASING`.

### 5.8 Reconciliation, reauthorization, expiry, auto-release schedulers (Owner A) — `paypal-integration.md` §7–§8
- [ ] `src/server/release/reconcile.ts`: `reconcileContract(contractId)` per the §8 table (`RELEASING` via `getOrder` + invoice match; `FUNDING` via `getOrder` status; `funding_at_risk` via `getAuthorization`), always inside lock + idempotent; `findStuckContracts()` query (RELEASING/FUNDING older than 2 min).
- [ ] `src/server/jobs/handlers/reconcile-paypal.ts` (`handleReconcilePaypal`), `reauth-check.ts` (`handleReauthCheck` per §7; idempotency key `pp:{id}:reauth:{honorUntilEpoch}`; on error `funding_at_risk=true` + ledger), `expire-contract.ts` (`handleExpireContract`; calls `voidRemaining(...,'expired')` semantics without a PayPal call if already expired — treat PayPal `404/AUTHORIZATION_EXPIRED` as success).
- [ ] `src/worker/schedulers.ts`: `scheduleSweeps()` enqueue with dedupe keys: `reconcile-sweep:{yyyymmddHHMM/5}` every 5 min, `reauth-sweep:{.../10}` every 10 min, `expire-sweep:{.../60}` hourly; started by `startWorker()`.
- [ ] Admin endpoint (C-7): `src/app/api/v1/admin/reconcile/route.ts` (POST `{contract_id}`; admin only) enqueues `RECONCILE_PAYPAL`.
- [ ] Tests `tests/integration/reconcile.test.ts` (MSW + injectable clock via `setNowForTests`): `finalizes RELEASING when order shows COMPLETED capture`, `marks RELEASE_FAILED when capture DECLINED`, `keeps RELEASING while PENDING`, `authorizes order when FUNDING but approved`, `reverts stale FUNDING to ACCEPTED`, `reauth runs only after honor_until`, `reauth success updates authorization_id and honor_until and writes REAUTHORIZED`, `reauth failure sets funding_at_risk`, `expiry voids and marks EXPIRED`, `sweeps enqueue with dedupe keys (second tick adds nothing)`.

### 5.9 Live sandbox smoke (Owner A + B)
- [ ] `scripts/e2e-sandbox.ts`: through the real HTTP API (no mocks): login personas, compile with FakeLLM-equivalent fixture contract (inject via `POST /contracts/{id}` PATCH using the demo contract), propose/accept, fund (print approval URL; operator approves), submit m1/m2 from fixtures, wait for verification (real LLM or `LLM_TRANSPORT=fake`), assert `CAPTURE_COMPLETED` x2 and `CONTRACT_COMPLETED`, run `/ledger/verify`, write `docs/e2e-sandbox-log.md`.
- [ ] Record any deviations from `paypal-integration.md` §13 findings in `docs/decision-log.md` and **update the spec file** where PayPal's behavior differs.

## Real-world engineering concerns
- **Never hold a DB transaction across a PayPal call;** state moves to `RELEASING` first (committed), capture second, result third.
- **Idempotency:** deterministic `PayPal-Request-Id`s; unique `invoice_id` per milestone; job `dedupe_key`s; webhook `event_id` uniqueness; state guards make all handlers re-runnable.
- **Ambiguous outcomes** (timeouts/5xx) are never treated as failure: retry same key, then reconcile by `invoice_id`.
- **Clock:** use PayPal timestamps for `auth_created_at`/`expiration_time` when provided; scheduling uses server time.
- **Rate limiting/backoff:** respect `Retry-After`; cap retries; log `debug_id`.
- **Observability:** every PayPal call logs `{op, contract_id, milestone_key, request_id_key, http_status, debug_id, latency_ms}`; money amounts logged in minor units; no tokens/secrets.
- **Security:** webhook raw-body verification; refuse non-sandbox; chaos endpoints 404 unless `CHAOS_MODE`; `forbidAgent` on cancel/refund/retry.

## Definition of done
- [ ] Live sandbox run (`scripts/e2e-sandbox.ts`) completes: **$60 and $40 captured against one authorization**, contract `COMPLETED`, `ledger/verify` valid, PayPal dashboard shows both captures.
- [ ] Live sandbox failure run: with `POST /contracts/{id}/chaos {mock_code:"INSTRUMENT_DECLINED"}` the next capture yields `RELEASE_FAILED`; `retry-release` succeeds; exactly one completed capture exists (checked via `getOrder`).
- [ ] Buyer cancel and final-failure paths void the hold (PayPal shows authorization voided) and set `CANCELLED` / `FAILED`.
- [ ] All named tests in 5.1–5.8 pass; `release.test.ts` contains the table-driven status test and the 2-concurrent-jobs test.
- [ ] Webhook delivery verified from PayPal dashboard (Recent deliveries show 200) for capture and authorization events on the tunnel/hosted URL.
- [ ] `npm run lint` passes boundary rules: only `src/server/release/**` imports `paypal/capture|void|refund`.
- [ ] `paypal-integration.md` §13 ⚠ items are each resolved (✓) or documented with the observed behavior.
- [ ] `/health` reports `paypal.ok` from a cached token check.

## Risks & blockers
| Risk | Mitigation |
|---|---|
| Sandbox rejects partial captures or `final_capture` leaves hold unreleased | Spike results decide; if only one capture is possible, pivot per `roadmap.md` §6 on Nov 3 (not now) |
| Webhook delivery delayed/missing | Return handler + reconcile are the primary paths; webhooks confirm |
| Mock codes unsupported on capture | Fall back to MSW-based failure injection in tests and a **server-side simulated decline flag used only in sandbox demo** — clearly labeled "simulated" in UI/ledger (`mock:true`) and never claimed as PayPal's response |
| Duplicate `invoice_id` errors on re-runs | Include attempt suffix only for tests; production uses fixed per-milestone id; reconcile finds the original capture |
| Reauthorization can't be exercised live | Mock-based tests + documented limitation (README) |
| Money-path bug | One mandatory reviewer, 100% branch coverage target on `release/service.ts`, chaos suite in Phase 8 |

## Time budget
**6 person-days** (A 5.0, B 1.0 review + test fixtures). **Cut first if long:** refund endpoint (`[S]`), `funding-status` live badge endpoint, admin reconcile endpoint, expiry sweep polish. **Do not cut:** authorize, partial capture, void, webhooks (signature), reconciliation of `RELEASING`, idempotency.

## Handoff
Next phases can assume: funding, release, void, webhooks, reconciliation, reauth, expiry, retry-release, chaos endpoint all work with the sandbox; ledger events for money exist; `release/service.ts` is the single money gateway; `GET /contracts/{id}/funding-status` exists; worker runs all schedulers; `/health` includes PayPal status.
**Tag:** `git tag phase-5-paypal && git push --tags`
