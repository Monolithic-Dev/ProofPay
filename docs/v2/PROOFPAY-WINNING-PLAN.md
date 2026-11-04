# ProofPay — Review of Current State & Winning Plan

> Based on your "Complete End-to-End System Architecture, Implementation & Feature Reference" (the document you pasted). **I reviewed the document, not the running UI or the code.** Anything marked ⚠ needs you to confirm against the real build. Send screenshots of the logged-in screens (dashboard, contract page, verification report, ledger) and I will review the actual UI.
> Date: Tuesday Nov 3, 2026. Freeze **Nov 9 23:59 IST** · record **Nov 10** · submit **Nov 11 by 18:00 IST**.

---

## 1. Verdict (honest)

You have **far more breadth than most teams will ever ship**: organizations, RBAC, dual-approval funding, MCP server, outbound webhooks, OpenAPI/Postman, 34 pages, 55 routes, five scenarios, chaos drills, an IDOR scanner and a copy checker. Breadth is no longer your constraint.

**What will decide the result now, in this order:**
1. **Credibility:** judges (PayPal engineers and product people) are skeptical readers. One overclaim or one internal contradiction costs more than ten extra features earn.
2. **Evidence:** numbers, logs and a visible PayPal integration beat adjectives.
3. **A flawless 3-minute end-to-end video** of a real flow.
4. **Two or three differentiators** that nobody else will have, chosen to make the claim "pays when it's *proven*" visible.

So the plan is: **fix what undermines trust (Tier A, ~2 days), add a small number of high-leverage differentiators (Tier B, ~4 days), then polish and record.** Do **not** add more pages.

### Scorecard against the judging criteria (my estimate from the document only)

| Criterion | Where you are | Biggest risk | Biggest lever |
|---|---|---|---|
| Technological Implementation | Strong on paper: authorize/partial capture/void, idempotency, webhooks, job queue, RBAC, MCP, chaos | Contradictions (LLM "decides", custody-like ledger, MCP `request_release`) look like design flaws; no published eval numbers | **Trust Center**, **PayPal Call Inspector**, fixing the contradictions |
| Design | Many screens; unknown polish | Inconsistent IA (`/contracts`, `/studio`, `/ledger`, `/inbox`, `/settings` outside `/app`); demo personas on the login page | Single app shell, consistent states, onboarding/tour |
| Potential Impact | Clear problem; two-sided product | Overclaims ("locked funds", "0% escrow fee") erode trust; no proof the AI verifier is accurate | Evidence + honest limits + reputation signals |
| Innovation/Idea | Verification + agent API is distinctive; "agents negotiate" is claimed in copy | Claimed negotiation may not exist; PayPal's own page hints at agent-to-agent settlement, so others will try it | **Bounded agent negotiation**, **offline Proof Pack verifier** |
| Presentation | Five scenarios, console | 3 minutes is short; too many features dilute the story | Video v3 (section 8): one thread, three "wow" moments |

---

## 2. What you have (inventory, condensed)

Payment engine (PayPal Orders v2 `AUTHORIZE`, partial capture, void, refund, webhook ingest, 29-day countdown) · AI compile/lint (RFC 6902 patches) · verification pipeline (size guards → deterministic checks → adversarial quote extraction → LLM decision) · RBAC (platform role, org role, buyer/seller side) · funding approvals (two-person rule) · comments, counterparties, invitations · service accounts and scoped keys · outbound webhooks (HMAC) · MCP server (4 tools) · Agent Console (SSE) · double-entry ledger with hash chain · background worker (verify, auto-release, webhooks, sweep) · `/demo` with five scenarios · 177 unit tests, copy checker, IDOR scanner, chaos injection.

---

## 3. Critical review — fix these first (Tier A)

Each item: **problem → why it matters → fix → acceptance check.** Priority P0 = could lose points or mislead; P1 = inconsistency; P2 = polish.

### A1 (P0) The ledger models custody, which contradicts "hold, not escrow"
- **Problem:** the ledger section describes accounts like **"Contract Hold Account"** and **"Contractor Cash Account"** and money flowing "Buyer → Hold Account → Contractor". That is how a custodian books funds. Your honesty policy says ProofPay never holds or transmits funds.
- **Why it matters:** a PayPal judge reading this sees a system that *looks like* it takes custody (a regulatory red flag) and a contradiction with your own Terms.
- **Fix:** keep the hash-chained ledger, but **reframe it as an event ledger of PayPal-reported facts**. Entry types: `AUTHORIZED`, `CAPTURED`, `VOIDED`, `REFUNDED` with PayPal ids and amounts as **reported by PayPal**. If you keep double-entry bookkeeping, label the accounts as *views of PayPal state*: `paypal_authorization (buyer funding source)`, `paypal_captured (seller merchant account)`, `paypal_voided`, `paypal_refunded`. Never name an account that implies ProofPay holds money.
- **Also fix the hash:** your formula `SHA256(prev + EntryID + Amount + Timestamp)` does not cover the **payload, type, contract id or PayPal ids**; a tamperer could change those without breaking the chain. Hash the canonical JSON of the whole entry: `sha256(prev_hash | contract_id | seq | type | canonical(payload) | created_at_iso)`.
- **Acceptance:** UI/docs contain no "Hold Account" or "Cash Account" wording; tamper test changes a payload field and `verify` fails; unit test `hash covers payload`.

### A2 (P0) Claims audit — rewrite these now (full table in Appendix A)
Overclaims and contradictions found in the document, including: "**0% escrow fee**" (uses the forbidden word, invents pricing), "**cryptographic or banking assurance that funds are locked**" (an authorization is not guaranteed funds; capture can still fail), "**zero processing fees**" (unverified), "**Proves 0 duplicate charges**" (an empirical test cannot prove; say "0 duplicate captures in N chaos runs"), "**Traditional escrow requires state-by-state licensing and takes high percentages**" (unsourced generalization), "**Cryptographically attached evidence**" (only true if hashed and chained), "**Qwen 3.8**" and "**Claude 3.5 Sonnet**" (⚠ verify the model names you actually call).
- **Acceptance:** `scripts/check-copy.mjs` extended with these phrases passes on `src/`, `README.md`, `docs/`; every number on screen comes from a committed result file.

### A3 (P0) "Structured LLM Policy Decision" contradicts "code decides"
- **Problem:** section 9's layer 4 says "Structured LLM Policy Decision". Your tenet says AI reads and explains; code decides.
- **Fix:** rename layer 4 to **"Rule engine decision (LLM provides evidence only)"** in docs, diagrams and UI labels, and make sure the code matches: the LLM returns per-criterion verdicts with **verbatim, code-verified quotes**; a **pure function** (`decide()`) returns PASS / REJECT / ESCALATE. Add the property test "no input with a failed required criterion returns PASS".
- **Acceptance:** architecture diagram and `/how-it-works` show the rule engine as the decider; test exists and passes.

### A4 (P0) MCP tool `proofpay_request_release` can look like a bypass
- **Problem:** a tool that lets an agent "formally request settlement" suggests an agent can trigger a capture.
- **Fix:** rename to **`proofpay_request_verification`** (enqueues verification only). Add **`proofpay_get_funding_link`** (returns the PayPal approval URL; a **human payer must approve**). Keep: create contract, get status, submit milestone. Document that **no MCP tool can approve, release, refund or cancel**, and enforce it server-side (service-account scopes, `forbidAgent`).
- **Acceptance:** MCP tool list test; `agent cannot call decision/release/refund/cancel` tests; docs updated.

### A5 (P0) Authentication completeness and demo leakage
- **Problem:** the document lists `login`, `register`, `logout`, `demo-login`, and the **Sign In page offers "instant demo persona selection"**. It does not mention email verification, password reset, session management, rate limiting, lockout, CSRF, or MFA.
- **Fix:** confirm each exists (⚠), and add what's missing: email verification required before org creation/funding; password reset (single-use, 1 h, revokes sessions); rate limits on login/forgot/register; generic error messages; session list/revoke; `demo-login` returns 404 unless `DEMO_MODE=true`; **remove demo personas from the login page** (keep them only in `/demo`). If auth is hand-rolled, expect scrutiny: add tests for each of the above or migrate to a maintained library (see `docs/product/02-users-auth-rbac.md`).
- **Acceptance:** tests `unverified user cannot create org/fund`, `reset token single use`, `login rate limit`, `demo-login 404 when DEMO_MODE=false`, `generic auth errors`.

### A6 (P1) State names differ from the rest of your spec
- The document's state machine uses `FUNDING_PENDING`, `UNDER_REVIEW`, `SETTLED`, `DISPUTED`, `VOIDED` and treats a failed verification as `DISPUTED`. Elsewhere (spec, code, tests) contracts use `DRAFT…COMPLETED/FAILED/CANCELLED/EXPIRED` and milestones use `PENDING…RELEASED/RELEASE_FAILED/FAILED_FINAL/VOIDED`.
- **Fix:** pick **one** vocabulary (the DB enums) and make the doc, UI chips and tests match. A **REJECT** is not a **dispute**: rejection returns the milestone for revision; disputes are a separate, human process.
- **Acceptance:** one source of truth (`data-model.md` §2) and a test that the UI status map is exhaustive.

### A7 (P1) The "money conservation invariant" is mathematically wrong as written
- `TotalAuthorized = Σ Captured(m) + Σ RemainingHold(m) + Voided(C)`: remaining hold is a **contract-level** quantity; summing it per milestone double-counts.
- **Correct invariant:** `authorized_minor = captured_minor + refunded? (tracked separately) + voided_minor + remaining_minor`, with `remaining_minor = authorized_minor − captured_minor − voided_minor ≥ 0`, and `Σ captured ≤ total`.
- **Fix:** compute these four numbers in **one function** used by the Funds Bar, `/payments/summary`, and a **DB/integration test** run after every chaos case.
- **Acceptance:** `money invariant holds after each chaos case` test; Funds Bar uses the same function.

### A8 (P1) Auto-release rule is too broad
- Doc: "auto-captures held funds when a buyer remains silent after 72 hours." Spec: only for **ESCALATED** milestones (verification passed or needs human review), default 48 h, configurable.
- **Fix:** auto-release applies **only** to `ESCALATED` milestones whose required deterministic checks passed; never to `REJECTED`; the buyer gets reminders at 50% and 90% of the window; the ledger records `AUTO_RELEASE_APPLIED` with hours waited; seller cannot trigger it manually.
- **Acceptance:** tests `auto-release ignores REJECTED`, `reminders sent`, `ledger records hours_waited`.

### A9 (P1) Multi-provider LLM fallback needs honesty and evidence
- Using Groq as a fallback to Anthropic is reasonable for resilience, but: ⚠ confirm model names; **eval results must be produced for each provider**; both must support forced structured output and pass the evidence-verification rule; data flows to two vendors must be disclosed in Privacy; fallback must never lower safety (if a provider's output fails validation twice → ESCALATE).
- **Acceptance:** `docs/eval-results.md` has one table per provider; Privacy page lists providers; test `provider failover keeps policy decisions identical on fixtures`.

### A10 (P1) Information architecture is inconsistent
- Pages live under both `src/app/app/...` and top-level (`/contracts`, `/studio`, `/ledger`, `/inbox`, `/settings`). Judges notice inconsistent navigation and URLs.
- **Fix:** everything authenticated under **`/app/...`** with one shell; old URLs redirect; breadcrumbs and active nav consistent. (See `04-ux-design-spec.md` §2.)
- **Acceptance:** route inventory test; no authenticated page renders outside the shell.

### A11 (P2) Endpoint and feature that don't earn their keep
- `GET /api/v1/ledger/elastic` ("sync connector") and "OpenSearch" mentions: either implement a **real** use (see B8) or **remove it** and any related copy. A named integration that does nothing reads as padding.
- `POST /contracts/[id]/chaos` must return 404 unless `CHAOS_MODE=true` and be excluded from OpenAPI.
- "Complete Table List" omits tables you must have (sessions, invitations, notifications, jobs, paypal_events, idempotency keys, llm calls…): update the doc so it matches the schema.

### A12 (P2) Legal pages
Terms/Privacy that mention liability and dispute mechanisms must be labeled **draft / not legal advice** and avoid promising outcomes.

---

## 4. Win levers — what to add (Tier B), ranked

Selection rule: each lever must (a) be **visible in the video or README**, (b) strengthen at least two judging criteria, (c) fit in the time left, and (d) not touch the money path.

| # | Lever | Criteria it moves | Effort | Risk | Do? |
|---|---|---|---|---|---|
| B1 | **Trust Center** (`/trust`) | Tech, Impact, Presentation | S (0.5–1 d) | Low | **Yes** |
| B2 | **Offline Proof Pack Verifier** (`/verify`) with tamper demo | Innovation, Tech, Presentation | S–M (1 d) | Low | **Yes** |
| B3 | **PayPal Call Inspector** (per-contract "PayPal activity") | Tech | S–M (1 d) | Low | **Yes** |
| B4 | **Bounded agent negotiation** (counter-offers) | Innovation, Impact, Agentic Commerce | M–L (2–3 d) | Medium | **Yes if A-tier done by Nov 5** |
| B5 | **Criteria Clarity Score** + dispute-risk hints | Innovation, Design, Tech | S (0.5–1 d) | Low | **Yes** |
| B10 | **Verification Theater** (live pipeline view) | Presentation, Tech, Design | S (0.5–1 d) | Low | **Yes** |
| B6 | **PayPal dispute evidence loop** | Tech, Impact | M–L (1–2 d) | Medium–High | Only if time; timebox 1 day |
| B7 | **Verified-delivery reputation** | Impact, Innovation | S–M (1 d) | Low | Maybe |
| B9 | **Agent mandates/policies** (daily caps, auto-approve below X, allowed templates) | Innovation, Tech | S–M | Low | Maybe |
| B11 | **Audit sampling + insights** | Tech, Impact | M | Low | Stretch |
| B8 | **Similar-contract criteria suggestions** (search/vector; uses Elastic only if real) | Innovation | M | Medium | Stretch |
| B12 | **Status page + health history** | Tech, Design | S | Low | Stretch |

### B1 — Trust Center (`/trust`, public)
**What:** one page that makes the AI and security claims *checkable*.
**Contents:** (1) "How a decision is made" diagram (checks → evidence → **rule engine**); (2) **verifier results** (counts per provider, held-out vs dev split, false passes, false rejects, escalation rate, latency, cost) generated from `docs/eval-results.md`; (3) **PayPal resilience results** (chaos cases, double captures = 0 in N runs) from `docs/chaos-results.md`; (4) **threat model summary** (prompt injection, IDOR, webhook forgery…) with the test names that cover each; (5) **limitations** (small sample, English only, sandbox, single merchant, not escrow); (6) data flows (LLM providers, what is sent, what is not logged).
**Build:** a build step reads the result markdown/JSON and renders the page (no hand-typed numbers).
**Acceptance:** numbers on `/trust` equal the committed result files (test compares); page includes limitations and the rule-of-three caveat; linked from landing footer, README and Devpost.

### B2 — Offline Proof Pack Verifier (`/verify`, public, client-side)
**What:** anyone can drop a **Proof Pack JSON** and verify it **without trusting ProofPay's servers**: recompute the contract hash, recompute every ledger hash, check the chain, check submission hashes against provided artifacts (optional), and show where tampering occurred.
**UX:** drag-and-drop; green "Chain intact ✓ (N events)" or red "Tampered at event #7 (payload changed)"; a **"Try tampering"** button loads a sample pack, flips one character, and shows the failure live (great video moment).
**Build:** `src/lib/proofpack/verify.ts` (pure TS, uses Web Crypto `crypto.subtle.digest('SHA-256')`), shared canonical-JSON implementation with the server (single source), page `src/app/verify/page.tsx`, CLI `scripts/verify-proofpack.ts`.
**Acceptance:** tests `valid pack verifies`, `payload tamper detected at the right seq`, `contract JSON tamper detected`, `reordered events detected`, `server and client hashes match for 100 random packs`; works offline (no network calls).

### B3 — PayPal Call Inspector (contract tab "PayPal activity")
**What:** a sanitized timeline of **every PayPal API call and webhook** for the contract so judges *see* the integration depth.
**Row fields:** time, operation (`create order`, `authorize`, `capture`, `void`, `reauthorize`, `refund`, `reconcile`), HTTP status, **PayPal-Request-Id (idempotency key)**, attempt/retry count, latency, PayPal `debug_id`, linked ledger event, outcome (`COMPLETED`, `DECLINED`, `PENDING`); webhooks: event type, signature valid ✓/✗, processed-at.
**Build:** table `paypal_calls(id, contract_id, milestone_key, operation, request_key, http_status, attempt, latency_ms, debug_id, outcome, created_at)` written by the PayPal client wrapper (no bodies, no tokens); API `GET /contracts/{id}/paypal-activity` (permission `payment:read`); UI tab with filters; "copy debug id".
**Acceptance:** every PayPal call in integration tests produces a row; secrets never stored; retry shows attempt counts; chaos "timeout then success" shows same key reused.

### B4 — Bounded agent negotiation (makes "agents negotiate" true)
**What:** a buyer agent and a seller agent agree terms through **counter-offers** inside hard limits set by humans. The **rule engine** accepts or rejects offers against policy; the LLM only suggests wording/amounts within bounds.
**Policy (per agent/service account):** buyer: `max_total_minor`, `max_milestones`, `required_criteria` (cannot be removed), `max_due_days`; seller: `min_total_minor`, `min_due_days`, `max_revisions`. Offers outside bounds are rejected automatically with the reason.
**Flow:** buyer drafts → `offer #1` → seller counters (RFC 6902 patch on amounts/due days/criteria thresholds) → … up to **N=4 rounds** → either side accepts → normal lint → hash lock → human approval policies still apply (a human approves the PayPal hold).
**Data:** `contract_offers(id, contract_id, round, proposer_org_id, proposer_actor, patch jsonb, resulting_contract_hash, rationale text, status PENDING|ACCEPTED|REJECTED|COUNTERED|EXPIRED, policy_check jsonb, created_at)`.
**API:** `POST /contracts/{id}/offers`, `POST /offers/{id}/respond {accept|counter|reject, patch?}`, `GET /contracts/{id}/offers`; MCP tool `proofpay_make_offer` and `proofpay_respond_offer` (scoped `contracts:write`).
**UI:** Negotiation tab: offer thread with diffs, policy-check badges, "human override" button (humans can take over any time).
**Safety:** offers can **never** reduce acceptance criteria that policy marks required; can never exceed bounds; every offer is a ledger event; humans can pause.
**Demo scenario #6:** two agents converge in 2–3 rounds (e.g., buyer wants $100/25 rows/3 days; seller counters $120/4 days; buyer counters $110/4 days; accepted), then funding and delivery.
**Acceptance:** tests `offer outside buyer bounds auto-rejected`, `required criteria cannot be removed`, `max rounds enforced`, `accepted offer produces a new contract version hash`, `human takeover pauses agents`, scenario golden event sequence.
**If time is short:** ship a **single counter-offer round** with a human accept; still removes the false claim and gives a visible "agents negotiated" beat.

### B5 — Criteria Clarity Score
**What:** a 0–100 score in the editor and a "Why not 100?" list. Components: % criteria that are deterministic (weight high), vague-term count, rubric count/length, deadline vs 29-day window, amount sanity (milestone amounts vs total), verifiability coverage ("every milestone has ≥1 required deterministic check"), human-criteria count (lowers auto-release).
**Dispute-risk hint:** "High: milestone 2 relies on one rubric criterion with no deterministic backstop."
**Build:** pure function `scoreContract(contract, lint)` (unit-tested), shown in editor header and invitation preview; deterministic (no LLM).
**Acceptance:** tests for each component; score never decreases when a lint error is fixed; displayed to both parties.

### B10 — Verification Theater
**What:** the milestone page shows the pipeline **live**: Size guard ✓ → Deterministic checks (each criterion ticks) → Evidence extraction (quotes appear and turn ✓ when substring-verified) → Adversarial scan → **Rule engine decision** with reasons; each step shows duration, and the LLM step shows model, tokens and cost.
**Build:** persist stage events (`verification_events`: stage, status, detail, duration_ms, created_at) from the worker; stream via the existing SSE; UI component `VerificationTimeline`.
**Acceptance:** stage events recorded for all four stages; report page replays them for completed verifications; video shows a rejection and an injection block in the same view.

### B6 — PayPal dispute evidence loop (only if everything above is green)
After a captured milestone, a sandbox buyer opens a PayPal dispute → webhook links it to the contract → **Proof Pack PDF** assembled → submitted with PayPal's **provide-evidence** API → UI shows evidence status. Timebox **1 day**. If PayPal's sandbox flow blocks you, ship "Proof Pack ready for dispute" and say so honestly; **never claim a win** unless the sandbox resolves in your favor.

### B7 — Verified-delivery reputation
Per org (seller side): verified milestones, first-pass rate, average attempts, on-time rate, escalation rate, total released. Computed from ledger events (deterministic, auditable). Shown on invitation preview and counterparty cards; **explain the formula** and show counts, not just a score. Guard against small-sample misleading ("3 milestones").

### B9 — Agent mandates
Extend service-account policy: `daily_spend_limit_minor`, `auto_approve_below_minor` (still requires human PayPal approval for the hold), allowed templates, allowed counterparties (email domains). UI "Agent policy" card; violations return `403 POLICY_VIOLATION` and are audited.

### B11 — Audit sampling and insights
Random 10% of **auto-PASS** milestones are queued for **human audit**; auditors mark agree/disagree; disagreements feed `docs/eval-results.md` as "production audit" (counts). Insights page: pass rate, escalation rate, mean cycle time, cost per verification, audit agreement. This is the strongest answer to "how do you know the AI is right?".

### B8 — Similar-contract suggestions (stretch; only if genuinely implemented)
Suggest criteria and thresholds from past verified contracts using Postgres full-text (or pgvector). If you use Elasticsearch because of the sponsor, it must provide a **visible** feature (search over ledger/verification evidence with highlighted hits) and appear in the README honestly; otherwise remove it.

---

## 5. Do NOT build (protect the freeze)

More pages or settings tabs · blockchain anchoring (off-message; hash chain + offline verifier is enough) · more LLM providers · more than 5 templates · real payouts to sellers (needs PayPal partner approval; keep the honest sandbox note) · multi-currency · mobile apps · custom roles · SSO · any change inside `src/server/release/**` except attribution/permission re-checks.

---

## 6. Evidence pack (produce these; every claim in the video/README must come from them)

| Artifact | Command | Must show |
|---|---|---|
| `docs/eval-results.md` | `npm run eval -- --set all` | per provider: false passes on the non-pass cases, false rejects, escalation rate, latency, cost, held-out vs dev, rule-of-three caveat |
| `docs/chaos-results.md` | `npm run chaos` | case, fault, behavior, pass/fail, **0 duplicate captures in N runs**, unsupported mock codes listed honestly |
| `docs/test-summary.md` | CI export | test counts per layer, coverage for `policy.ts` and `release/service.ts` |
| `docs/paypal-activity-sample.json` | export from B3 | a real sanitized call log for one contract |
| `docs/proof-pack-sample.json` | export | verifies on `/verify` |
| `/trust` page | build step | renders the above |

---

## 7. Presentation plan

### Video v3 (target 2:50, hard limit 3:00) — one thread, three "wow" moments
Prep: dark mode, two browser profiles (Acme buyer, Northwind seller), seeded realistic data, PayPal sandbox buyer pre-logged in.

| Time | Screen | Message |
|---|---|---|
| 0:00–0:12 | Problem card → landing | Paying for work you can't inspect forces trust; agents will hire agents |
| 0:12–0:35 | Template → AI compile → **Clarity Score 62 → lint fix → 91** → send | Measurable criteria before anyone commits |
| 0:35–1:00 | **Wow 1: two agents negotiate** (offer → counter → accept) with policy badges → lock | Agents agree within human-set limits |
| 1:00–1:15 | Funding policy: Member requests, Finance approves → PayPal hold → Funds Bar | Hold, not charge; two-person rule |
| 1:15–1:45 | Seller agent submits → **Verification Theater**: rejected with exact rows → fix → passed → capture; flash **PayPal activity** (request key, capture id) | AI reads; rules decide; PayPal moves the money |
| 1:45–2:00 | Hidden instruction → manipulation flagged, ignored | Injection-resistant |
| 2:00–2:20 | **Wow 2: `/verify` — tamper one character → red** | Evidence you can verify without trusting us |
| 2:20–2:40 | **`/trust`: eval + chaos numbers with caveats**, roles/audit glimpse | Measured, honest |
| 2:40–2:55 | Close: sandbox today, partner onboarding next; the one-liner | Everyone else's agent pays when the job is marked complete. Ours pays when it's proven. |

**Fallback cut (if negotiation slips):** replace 0:35–1:00 with the Clarity Score + invite/accept between two orgs.

### README / Devpost first screen
One-sentence pitch · honesty line · demo link + video · "Try it in 3 steps" · three screenshots (Funds Bar mid-release, Verification Theater, `/verify` tamper) · **How PayPal is used** table · **How AI is used** table · **Roles and security** · **Evidence** (numbers) · limitations · roadmap.

### Likely judge questions (prepare one-sentence answers)
1. *Is this escrow?* No: PayPal authorization hold; ProofPay never holds funds.
2. *What if the AI is wrong?* Rules decide; quotes are code-verified; low confidence escalates; here are our measured false passes and an audit-sampling mechanism.
3. *Can an agent steal money?* Agents have scoped keys, caps and no approval/release tools; a human approves the hold.
4. *Why PayPal?* Authorize/partial-capture/void primitives and buyer-side protection fit milestone payments; show the call inspector.
5. *What's next?* Partner onboarding for seller payouts, disputes, attachments.

---

## 8. Schedule (Nov 3 → Nov 11)

| Day | A (backend/PayPal) | B (AI/verification) | C (frontend) | D (infra/demo/docs) |
|---|---|---|---|---|
| **Nov 3** | A1 ledger reframe + hash fix; A7 invariant function; A4 MCP rename/tools | A3 diagram/docs fix; A9 provider eval plan | A10 IA consolidation to `/app` | A2 claims audit + copy-check expansion; A5 auth checklist |
| **Nov 4** | A5 auth gaps (verification/reset/limits); A8 auto-release rules | Run eval (all providers) → `eval-results.md` | B5 Clarity Score UI | Run chaos → `chaos-results.md`; A12 legal draft labels |
| **Nov 5** | B3 PayPal call log + API | B10 stage events in worker | B10 Verification Theater UI; B3 tab | B1 Trust Center build step |
| **Nov 6** | B4 offers backend (tables, API, policy engine) | B4 policy checks + agent prompts (wording only) | B4 Negotiation tab | B2 `/verify` client-side verifier |
| **Nov 7** | B4 scenario #6 + MCP tools | Regression: eval + chaos again | Polish tour/onboarding; mobile pass | B2 tamper demo; screenshots |
| **Nov 8** | Timeboxed B6 **or** B7/B9 | Audit sampling (B11) if ahead | Final design pass, axe | README/Devpost drafts; video rehearsal |
| **Nov 9** | Fixes only; **freeze 23:59** | Fixes only | Fixes only | Final regression, seed data, rehearse ×3 |
| **Nov 10** | P0 fixes only | P0 fixes only | Record with D | **Record/edit/upload video** |
| **Nov 11** | Submit by 18:00 IST | QA | QA | Verify links logged-out |

**Cut order if behind:** B6 → B9 → B7 → B11 → B4 multi-round (keep single round) → B12. **Never cut:** A1–A5, B1, B2, B3, B10, the video.

---

## 9. Pre-freeze self-review (answer yes to all)

- [ ] Nothing in UI/README/docs says "escrow" (except "not escrow"), "locked funds", "guaranteed", "proves", "cryptographically verified", "0% fee".
- [ ] The decision step is labeled **rule engine**; MCP has no release/approve/refund tool.
- [ ] Ledger wording matches "ProofPay never holds funds"; hash covers payloads; tamper test fails as expected.
- [ ] One status vocabulary everywhere; rejection ≠ dispute.
- [ ] Auth has verification, reset, limits, session management; no demo personas on login; `demo-login` gated.
- [ ] Eval numbers (per provider) and chaos results exist, are committed and shown on `/trust`.
- [ ] Money invariant test passes after every chaos case.
- [ ] Every authenticated page is under `/app` with one shell; states (loading/empty/error/forbidden) exist.
- [ ] Video ≤ 3:00, public, shows the real flow with the three wow moments; numbers match files.
- [ ] Repo public, license visible, no secrets, README quick start works from a clean clone.

---

## Appendix A — Claims audit (rewrite table)

| Where | Current wording | Problem | Replace with |
|---|---|---|---|
| Problem section | "without cryptographic or banking assurance that funds are locked" | Overclaim; authorization isn't guaranteed funds | "without confirmation that the buyer has authorized payment" |
| Problem section | "Traditional escrow requires state-by-state money transmitter licensing, takes high percentages…" | Unsourced; uses "escrow" | Remove, or cite a source and use neutral wording ("custodial services carry licensing and fee overhead") |
| Honesty policy | "hold or is voided with zero processing fees" | ⚠ unverified fee claim | "Fees may apply per PayPal's terms; sandbox has no real fees" |
| Honesty policy | forbids `escrow`, `trustee`, `money pool` | Good; also forbid the phrases below | Add: `locked`, `guaranteed`, `proves`, `cryptographically verified`, `0%`, `bank-grade` |
| Pricing page | "0% escrow fee, flat per-verification pricing" | Forbidden word + invented pricing | "Sandbox: free. Pricing to be announced." |
| Verification | "Structured LLM Policy Decision" | Contradicts "code decides" | "Rule engine decision (LLM supplies evidence)" |
| Verification | "Multi-Provider Fallback … Qwen 3.8 / Llama 3 … Claude 3.5 Sonnet" | ⚠ model names unverified/outdated | Use the exact model ids from your config; add per-provider eval |
| Evidence | "Cryptographically attached evidence" | Only true if hashed and chained | "Evidence files are hashed and recorded in the ledger" |
| Ledger | "Contract Hold Account", "Contractor Cash Account" | Implies custody | "PayPal authorization (reported)", "PayPal capture (reported)" |
| Ledger | hash formula without payload | Weak tamper evidence | Hash the whole canonical entry |
| Tests | "Proves 0 duplicate charges" | An empirical test can't prove | "0 duplicate captures across N chaos runs" |
| Agents | "built-in financial guardrails" | Vague | "scoped keys, spend caps, no approval or release tools" |
| MCP | `proofpay_request_release` | Looks like a bypass | `proofpay_request_verification` |
| Auto-release | "after 72 hours" for any silent buyer | Too broad | "Only for escalated milestones after the configured wait (default 48 h), with reminders" |
| Landing/demo | "Autonomous agents negotiate agreements" | Not built (until B4) | Keep only if B4 ships; else "Agents create and deliver contracts through the API" |
| Funds language | "funds secured/locked" | Authorization can fail at capture | "authorized on PayPal; capture subject to PayPal's checks" |

## Appendix B — Corrected invariant and reference function

```ts
// One function, used by Funds Bar, /payments/summary and tests
export function fundsSummary(c: { authorizedMinor: number; captures: number[]; voidedMinor: number; refundsMinor?: number }) {
  const captured = c.captures.reduce((a, b) => a + b, 0);
  const remaining = c.authorizedMinor - captured - c.voidedMinor;
  if (remaining < 0) throw new Error('INVARIANT: captured + voided exceeds authorized');
  return { authorizedMinor: c.authorizedMinor, capturedMinor: captured, voidedMinor: c.voidedMinor, remainingMinor: remaining, refundedMinor: c.refundsMinor ?? 0 };
}
// Invariant: authorized = captured + voided + remaining; remaining >= 0; Σ captures <= total
```

## Appendix C — Ledger entry (recommended shape)

```
{ seq, contract_id, type: AUTHORIZED|CAPTURED|VOIDED|REFUNDED|…business events, actor_type, actor_id,
  payload: { paypal_ids…, amount_minor, source: "paypal_reported" },
  prev_hash, hash = sha256(prev_hash|contract_id|seq|type|canonical(payload)|created_at_iso), created_at }
```

## Appendix D — Auth completeness checklist (⚠ confirm each in code)

Registration with verification email · block org/funding until verified · login with generic errors · rate limit + lockout · password reset single-use/1 h/revoke sessions · change password/email re-auth · session list and revoke · cookie flags (`HttpOnly`, `Secure`, `SameSite=Lax`) · CSRF/Origin check · `demo-login` gated by `DEMO_MODE` · org invitations bound to email · last-owner protection · audit events · MFA (optional) · no tokens in logs.
