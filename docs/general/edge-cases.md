# ProofPay — Edge Cases

> Format per case: **Naive behavior** (what would happen with no handling) → **Specified behavior** (what ProofPay must do) → **Fix** (where/how). IDs are referenced by tests in `testing.md`. Priority: **P0** = must work in the demo/judging window; **P1** = should; **P2** = documented only.

## 1. Input validation and malformed data

| ID | Pri | Case | Naive behavior | Specified behavior | Fix |
|---|---|---|---|---|---|
| E-01 | P0 | Compile prompt empty / > 2,000 chars | LLM wastes tokens or errors | `400 VALIDATION_FAILED` with field message | Zod on route |
| E-02 | P0 | LLM returns contract whose milestone amounts don't sum to total | Funding with wrong total | Linter error `LINT_SUM_MISMATCH` with one-click fix (recompute total) | `lint/rules.ts` L002 |
| E-03 | P0 | Contract total over $500 or > 5 milestones | Unbounded exposure | Reject at compile/PATCH with `VALIDATION_FAILED` | Zod `.max()` + DB CHECK |
| E-04 | P0 | `due_in_days` > 28 | Auth expires before due date | `DURATION_EXCEEDS_AUTH_WINDOW`; fix suggests ≤ 28 | Rule L003, `fund` re-check |
| E-05 | P0 | Submission content type mismatches milestone | Checks crash | `400 CONTENT_TYPE_MISMATCH` before storing | Route validation |
| E-06 | P0 | JSON submission isn't valid JSON / not an array | Stage 1 throws | Stored (it's evidence); `json_schema` fails with "Deliverable is not a valid JSON array." → REJECT with feedback | `deterministic/json-schema.ts` guards |
| E-07 | P0 | Artifact > 1 MiB or > 5,000 rows | Memory/cost blow-up | `400 ARTIFACT_TOO_LARGE`; not stored | Body limit + parse limits |
| E-08 | P1 | Deeply nested JSON (depth > 20) | Parser stack/time | Rejected `VALIDATION_FAILED` | Depth-limited parser |
| E-09 | P1 | Unicode oddities: zero-width/bidi chars, NFKC differences | Evidence matching fails or hides injection | Preserve in storage; strip only for matching; flag clusters in stage 3 | `evidence.ts`, `adversarial.ts` |
| E-10 | P1 | Words counted differently (markdown, hyphens) | Flaky word_count | Documented algorithm: strip markdown syntax chars, split on whitespace; show observed count | `word-count.ts` + tests at boundaries 149/150/200/201 |
| E-11 | P1 | Rubric statement is compound ("clear AND funny AND accurate") | LLM gives mixed verdict | AI lint `LINT_RUBRIC_COMPOUND`: suggest splitting | `ai-lint.ts` |

## 2. State, concurrency, and idempotency

| ID | Pri | Case | Naive behavior | Specified behavior | Fix |
|---|---|---|---|---|---|
| E-12 | P0 | Double-click **Fund** | Two PayPal orders | Idempotency-Key returns same approval URL; contract already `FUNDING` → reuse existing order | `fund` route + `contracts.paypal_order_id` check |
| E-13 | P0 | Same milestone submitted twice concurrently | Two verifications; two releases | `UNIQUE(milestone_id, attempt)` + advisory lock; second gets `409 INVALID_STATE` | Service lock |
| E-14 | P0 | Worker crashes after capture succeeded but before DB update | Milestone stuck `RELEASING`; retry might double-capture | Retry uses the **same** `PayPal-Request-Id` (PayPal returns the original result); reconcile job finds capture by `invoice_id` | `release/service.ts`, `reconcile.ts` |
| E-15 | P0 | Two workers claim the same job | Duplicate effects | `FOR UPDATE SKIP LOCKED`; `dedupe_key` | `jobs/queue.ts` |
| E-16 | P0 | Webhook arrives **before** the API response is committed | State flips twice or errors | Handlers are idempotent and never move state backwards; `RELEASING → RELEASED` accepted from either path | `webhooks.ts` |
| E-17 | P0 | Duplicate/replayed webhook | Double ledger entries | `paypal_events.event_id UNIQUE` → ignore duplicates | Insert `ON CONFLICT DO NOTHING` |
| E-18 | P0 | Submission to milestone 2 before milestone 1 is released | `final_capture` ambiguity | `409 INVALID_STATE` ("Milestone 1 must be released first") | Sequential rule PI-1 |
| E-19 | P1 | Buyer cancels while a milestone is `VERIFYING` | Race between void and capture | Cancel blocked (`INVALID_STATE`) until verification finishes | FR-29 guard |
| E-20 | P1 | Two tabs approve/reject the same escalation | Conflicting decisions | First wins; second gets `409`; both shown the final state via SSE | State guard |
| E-21 | P1 | Clock skew between app and PayPal timestamps | Wrong honor/expiry display | Use PayPal's timestamps when provided; show countdowns from stored values; server time only for scheduling | `orders.ts` |

## 3. Money and PayPal failures

| ID | Pri | Case | Naive behavior | Specified behavior | Fix |
|---|---|---|---|---|---|
| E-22 | P0 | Buyer abandons PayPal approval | Contract stuck `FUNDING` | Cancel URL → `ACCEPTED`; 3 h sweep reverts stale `FUNDING` after checking the order | `paypal/cancel`, reconcile |
| E-23 | P0 | Authorization succeeds but return handler never runs (tab closed) | Funds held, app unaware | `CHECKOUT.ORDER.APPROVED` webhook / reconcile authorizes the order | `webhooks.ts`, reconcile |
| E-24 | P0 | Capture **declined** | Milestone marked released | `RELEASE_FAILED`; buyer banner "Payment declined — retry"; ledger `CAPTURE_FAILED` | Release service TX-B |
| E-25 | P0 | PayPal returns `PENDING` capture | Treated as success or failure | Stay `RELEASING`; reconcile every 60 s up to 24 h | Reconcile |
| E-26 | P0 | PayPal 5xx / network timeout on capture | Unknown outcome | Retry same key ×3 with backoff; then leave `RELEASING` + reconcile; never assume failure | `client.ts` |
| E-27 | P1 | Authorization expires/voided externally mid-contract | Later captures fail | `funding_at_risk` banner; webhook/reauth sweep; contract `EXPIRED` if window ends | §7 reauth, webhooks |
| E-28 | P1 | Reauthorization fails | Funds become uncapturable | Mark at risk, banner "Re-fund to continue", seller may pause; ledger event | `reauth-check.ts` |
| E-29 | P1 | Final capture amount < remaining authorization | Leftover hold | Document: `final_capture: true` releases the remainder (⚠ verify); verify in spike; show Funds Bar accordingly | Spike step 6 |
| E-30 | P1 | Refund after capture exceeds captured amount | Over-refund | Guard: refund ≤ captured − already refunded | `refund.ts` |
| E-31 | P0 | PayPal credentials wrong/expired | Opaque 500s | `/health.paypal=false`; clear error `UPSTREAM_PAYPAL`; Judge Mode banner | Health check |

## 4. AI and verification failures

| ID | Pri | Case | Naive behavior | Specified behavior | Fix |
|---|---|---|---|---|---|
| E-32 | P0 | **Prompt injection** in deliverable | Verifier obeys it | Treated as data; stage 3 flags; **REJECT** (high) or **ESCALATE** (low); never PASS because of it | Prompts, policy rules 2/5 |
| E-33 | P0 | Verifier "passes" with a quote not in the artifact | False pass | Quote verification fails → `cannot_verify` → **ESCALATE** | `evidence.ts` |
| E-34 | P0 | LLM unavailable / budget exhausted during verification | Stuck or silent pass | Degraded mode: deterministic checks; rubric `cannot_verify`; ESCALATE with `VERIFIER_UNAVAILABLE` | `pipeline.ts` |
| E-35 | P0 | LLM returns schema-invalid output | Crash | One retry with validation error; then treat stage as unavailable | `llm.ts` |
| E-36 | P1 | Borderline rubric (e.g., generic but unique descriptions) | Coin-flip pass | Low confidence/`cannot_verify` → ESCALATE with evidence for the buyer | Policy rule 4 |
| E-37 | P1 | Large artifact truncated for rubric | Verdict based on partial data | Visible `TRUNCATED` marker; criteria depending on truncated content capped at `cannot_verify` | `rubric.ts` |
| E-38 | P1 | Non-English deliverable | Unknown accuracy | Works best effort; confidence likely lower → escalations; documented limitation | Model card |
| E-39 | P1 | Verifier cache returns stale result after prompt change | Wrong cache hit | `prompt_version` and model are part of `input_hash` | `cache.ts` |
| E-40 | P1 | Compile produces a vague/unsafe contract (e.g., criteria written to be trivially satisfiable) | Seller-favoring or buyer-favoring bias | Linter flags `LINT_TRIVIAL_CRITERION` (e.g., min 1 record when buyer asked for 25); buyer reviews; seller can reject at accept | `ai-lint.ts` |

## 5. Business-logic edge cases

| ID | Pri | Case | Specified behavior | Fix |
|---|---|---|---|---|
| E-41 | P0 | Revisions exhausted | Milestone `FAILED_FINAL` → `void_remaining` → contract `FAILED`; previously released milestones stay captured; both parties notified | Policy `on_final_failure` |
| E-42 | P0 | Buyer silent on an escalation | Auto-release after `auto_release_hours` (default 48; accelerated in demo via `DEMO_TIME_SCALE`) with ledger `AUTO_RELEASE_APPLIED` | `AUTO_RELEASE` job |
| E-43 | P1 | Seller misses `due_at` | Flag "overdue" on timeline; no automatic penalty in MVP; buyer may cancel before submissions | UI chip |
| E-44 | P1 | Contract includes a `human` criterion | Never auto-passes; ESCALATE after other checks; timer applies | Policy rule 6 |
| E-45 | P1 | Buyer edits a PROPOSED contract | Back to DRAFT; seller must re-accept; hash recomputed only at accept | State machine |
| E-46 | P2 | Scope change after lock | Out of scope (`FR-9` amendment `[C]`); workaround: cancel and re-contract | Documented |
| E-47 | P2 | Contract longer than 28 days | Unsupported; funding in stages is future work | Documented |

## 6. Security edge cases

| ID | Pri | Case | Specified behavior | Fix |
|---|---|---|---|---|
| E-48 | P0 | User requests another user's contract by ID | `404` | `requireParty` |
| E-49 | P0 | Forged webhook | Signature verify fails → stored, `400`, no effects | `webhooks.ts` |
| E-50 | P0 | Agent API key attempts approve/cancel/refund | `403 FORBIDDEN_FOR_AGENT` | Guard in routes |
| E-51 | P1 | API key leaked | Revoke in UI; hashes only stored; rotate | `api_keys.revoked_at` |
| E-52 | P1 | CSRF on state-changing route | Origin/Content-Type check; SameSite=Lax | Middleware |
| E-53 | P1 | Rate-limit abuse of compile/verify | `429 RATE_LIMITED`; global budget stops spend | Rate limiter + budget |
| E-54 | P1 | Ledger row modified manually in DB | `/ledger/verify` returns `valid:false, broken_at_seq`; UI chain badge turns red | Hash chain |

## 7. Demo-day and hosting edge cases

| ID | Pri | Case | Specified behavior |
|---|---|---|---|
| E-55 | P0 | PayPal sandbox slow/down during recording | Pause; retry later; fallback to previously recorded take; never fake responses |
| E-56 | P0 | Webhook delivery delayed | Return handler + reconcile keep UI correct; webhooks are confirmation only |
| E-57 | P0 | Judge uses an incognito window with no session | Judge Mode works without prior login (persona buttons) |
| E-58 | P0 | Render cold start / worker down | `/health` shows lag; UptimeRobot alert; paid tier avoids sleeping |
| E-59 | P1 | Judge's sandbox buyer lacks funds | Provide the known-good buyer; README explains how to add sandbox balance |
| E-60 | P1 | Many judges run scenarios simultaneously | Rate limit 5/h/IP and a global LLM budget; scenario runs queue; UI says "busy, try again or watch the recording" |

## 8. Scale limits (honest)

| Limit | Value | Breaks at | Distance from demo load |
|---|---|---|---|
| Concurrent verifications | Worker handles jobs serially per instance (~1–2 s DB, ~10–15 s LLM) | ≈ 4–6 verifications/min per worker | Demo needs < 1/min |
| Ledger append rate | Per-contract advisory lock | Thousands/min across contracts | Demo ≈ dozens |
| LLM budget | `LLM_DAILY_BUDGET_USD` (default $5) | ≈ 150–250 verifications/day at ≈ $0.02–0.03 | Judging likely < 100/day |
| Artifact size | 1 MiB / 5,000 rows | Hard caps | By design |
| SSE connections | One web instance, a few hundred | ≈ low hundreds | Judges ≪ 100 |
