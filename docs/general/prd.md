# ProofPay — Product Requirements Document (PRD)

> **Status:** build-ready for the PayPal AI Hackathon. **Supersedes** earlier planning files 02/03 wherever they differ.
> **Priority tags:** `[M]` Must (MVP, demo depends on it) · `[S]` Should (build if on schedule) · `[C]` Could (stretch, only after MVP is demo-ready).
> **Time box:** Nov 2 → Nov 11, 2026 (10 build days) (internal freeze Nov 9; submit Nov 11 evening IST). Official deadline: Nov 12, 12:00 PT.

---

## 1. Problem (plain language)

When someone pays for work they cannot inspect in advance (data, writing, code, research, or work done by an AI agent), one side must trust the other.

- **Sellers** (freelancers, small agencies, operators of AI agents) do the work and then chase payment. Freelancers Union reports about 71% of freelancers have had non-payment issues; a 2025 Intuit QuickBooks report says 56% of US small businesses have unpaid invoices, averaging $17,500 (re-verify both before quoting).
- **Buyers** pay upfront for work whose "done" was never precisely defined, so disputes follow.
- **AI agents** will increasingly buy *work* from other agents. Existing agent-payment protocols settle a payment or authorize a purchase, but none verifies that the delivered work met the promise.

**Root cause:** payment and proof of completion are disconnected, and the agreement itself is vague.

## 2. Solution in one paragraph

ProofPay turns a plain-English job into a contract with **measurable acceptance criteria** (and lints out vague ones), places a **PayPal authorization hold** for the total, verifies each delivered milestone with **deterministic checks first and an evidence-citing AI verifier second**, and releases funds milestone by milestone through **PayPal partial captures**. Failed work gets precise feedback; repeated failure voids the remaining hold. Every decision goes into a **hash-chained ledger** exportable as a **Proof Pack**. Design rule: **AI reads and explains; code decides; PayPal moves the money.** The PayPal authorization amount is also the hard spending cap for the buyer.

> **Honesty statement (must appear in the product and README):** this is a *PayPal authorization hold*, not legal escrow. ProofPay never holds funds. Sandbox only. PayPal's own terms, the 29-day authorization window, and possible fees apply.

## 3. Goals and non-goals

### Goals
1. G1: Demonstrate a complete, working **authorize → verify → partial-capture → void/refund** lifecycle on PayPal's sandbox.
2. G2: Show an AI verifier that is **measurably trustworthy** (published false-pass counts on a 30-case set) and **injection-resistant**.
3. G3: Show **agent-to-agent** use: a buyer agent hires a worker agent through ProofPay (REST + MCP).
4. G4: Ship a **polished product** (Studio → Fund → Timeline → Report → Ledger), not a script.
5. G5: Stay **live and free for judges through Dec 15, 2026** with capped costs.

### Non-goals (explicitly out of scope)
- Real money, production PayPal, KYC/AML, tax handling, multi-currency (USD only).
- Custody of funds or legal escrow; legal contract enforceability.
- Multi-seller marketplace payouts (seller **is** the single PayPal sandbox merchant; see `paypal-integration.md` §2).
- Verifying subjective qualities (taste, brand fit) beyond a `human` criterion that requires buyer sign-off.
- Contracts longer than **28 days** (PayPal authorization window is 29 days).
- File uploads beyond JSON/text (≤ 1 MB). No binary/image/video deliverables.
- Native mobile apps. (Responsive web only.)

## 4. Personas

| ID | Persona | Description | Primary need |
|---|---|---|---|
| P1 | **Maya**, seller | Runs a 3-person data/content agency; owns the PayPal merchant account | Know the money is real *before* starting; get paid automatically when work is accepted |
| P2 | **Dev**, buyer | Ops lead at a startup buying data and content work | Pay only for work that meets a written, checkable spec; avoid arguments |
| P3 | **Ari**, agent operator | Runs a buyer agent and a worker agent via API/MCP | A trust layer so agents can transact for work without a human inspecting output |
| P4 | **Judge** | PayPal engineer/PM with 3 minutes and maybe one click | Understand the idea in 20 s, see it work, trust the PayPal usage |

## 5. User stories

| ID | Story |
|---|---|
| US-1 | As Dev, I describe a job in English so that I get a structured contract without writing one. |
| US-2 | As Dev, I want vague criteria flagged and fixed with one click so that disputes can't start from ambiguity. |
| US-3 | As Maya, I want to review and accept the contract so that both sides are bound to the same measurable terms. |
| US-4 | As Dev, I want my money held, not charged, until work is verified so that I only pay for what meets the spec. |
| US-5 | As Maya, I want to see that funds are authorized before starting so that I'm not working on spec. |
| US-6 | As Maya, I want to submit a milestone and get instant, precise feedback if it fails so that I can fix it fast. |
| US-7 | As Maya, I want the payment released automatically when my work passes so that I don't chase invoices. |
| US-8 | As Dev, I want unclear cases escalated to me with evidence so that I decide with facts, not guesses. |
| US-9 | As Maya, I want the milestone to auto-release if the buyer stays silent past a deadline so that I'm not ghosted. |
| US-10 | As Dev, I want the remaining hold released if the seller can't deliver after the allowed revisions so that my money isn't stuck. |
| US-11 | As either party, I want a tamper-evident record (Proof Pack) so that I can resolve a dispute with evidence. |
| US-12 | As Ari, I want to create, fund, submit, and check contracts through an API/MCP so that my agents can transact autonomously. |
| US-13 | As a Judge, I want one-click demo scenarios and sandbox credentials so that I can see it work in under a minute. |
| US-14 | As the team, I want a hard LLM spend cap and graceful degraded mode so that the demo stays up through Dec 15. |

## 6. Functional requirements

### 6.1 Contract compile and lint
| ID | Pri | Requirement (testable) |
|---|---|---|
| FR-1 | M | `POST /contracts/compile` with a prompt (≤ 2,000 chars) returns a Contract draft conforming to the schema in `data-model.md` §4 within 10 s p95. |
| FR-2 | M | A contract has 1–5 milestones; `total_minor` equals the sum of milestone `amount_minor`; USD only; total ≤ 50,000 (i.e., $500.00). |
| FR-3 | M | Each criterion has `type` ∈ `deterministic` \| `rubric` \| `human`; deterministic criteria must name a check from the registry. |
| FR-4 | M | The linter runs on compile and on every edit and returns issues `{id, code, severity, path, message, suggested_fix?}`. |
| FR-5 | M | Funding and proposing are blocked while any `error`-severity issue exists. |
| FR-6 | M | The buyer can apply a `suggested_fix` in one click; the draft updates and re-lints. |
| FR-7 | M | Any milestone `due_in_days` > 28 yields lint error `LINT_DURATION`. |
| FR-8 | M | Buyer proposes; seller accepts; on accept the contract JSON is canonicalized, SHA-256 hashed, stored as `contract_hash`, and becomes immutable. |
| FR-9 | C | Post-lock amendments require both parties and create a new version with a new hash. |

### 6.2 Funding
| ID | Pri | Requirement |
|---|---|---|
| FR-10 | M | `POST /contracts/{id}/fund` creates a PayPal order with `intent: AUTHORIZE` for `total_minor` and returns an approval URL. |
| FR-11 | M | After buyer approval, the return handler authorizes the order and stores `authorization_id`, `auth_created_at`, `honor_until` (+3 days), `auth_expires_at` (+29 days) and sets `due_at` for each milestone. |
| FR-12 | M | The seller sees "$X authorized"; the buyer sees "Held, not charged". Both see countdowns for honor period and expiry. |
| FR-13 | M | If the buyer abandons PayPal approval, the contract returns to `ACCEPTED` with no hold and a visible note. |

### 6.3 Submission and verification
| ID | Pri | Requirement |
|---|---|---|
| FR-14 | M | The seller (human or agent) can submit to a milestone in `PENDING` or `REJECTED` state: `json_records` (array of objects) or `text`, ≤ 1 MB. Milestones are strictly sequential: milestone *n* accepts submissions only after milestone *n−1* is `RELEASED`. |
| FR-15 | M | Each submission is stored immutably with its SHA-256. |
| FR-16 | M | The verification pipeline (stages 1–4 in `ai-pipeline.md`) runs automatically; p95 ≤ 20 s excluding queue time. |
| FR-17 | M | Deterministic checks implemented: `json_schema`, `row_count`, `unique_field`, `regex_field`, `word_count`, `required_keywords`. |
| FR-18 | M | The rubric verifier returns per-criterion `{verdict, score, confidence, evidence[]}`; every evidence quote is substring-verified against the artifact; unverifiable quotes downgrade the verdict to `cannot_verify`. |
| FR-19 | M | The adversarial pass detects manipulation attempts; detections are logged as `INJECTION_FLAGGED` ledger events. |
| FR-20 | M | The policy engine (pure function) alone decides `PASS` \| `REJECT` \| `ESCALATE`; no LLM output directly changes status. |
| FR-21 | M | `REJECT` returns per-criterion actionable feedback; `revisions_used` increments; submissions allowed = `max_revisions + 1` (default 3). |
| FR-22 | M | `ESCALATE` shows the buyer a report; the buyer approves or rejects; silence for `policy.auto_release_hours` (default 48) auto-approves. |
| FR-23 | M | Any `human` criterion forces `ESCALATE` when all other required criteria pass. |

### 6.4 Release, failure, housekeeping
| ID | Pri | Requirement |
|---|---|---|
| FR-24 | M | A `PASSED` milestone triggers a PayPal partial capture of its amount with an idempotency key; the last milestone uses `final_capture: true`. |
| FR-25 | M | Capture can only be issued from `PASSED` (enforced in the release service **and** a DB check). |
| FR-26 | M | A failed capture moves the milestone to `RELEASE_FAILED`, notifies the buyer, and allows retry. |
| FR-27 | M | When every milestone is `RELEASED`, the contract becomes `COMPLETED`. |
| FR-28 | M | When revisions are exhausted (`FAILED_FINAL`), the remaining authorization is **voided**; the contract becomes `FAILED`; already-captured milestones stay captured. |
| FR-29 | S | The buyer can cancel while no milestone is `SUBMITTED`/`VERIFYING`/`ESCALATED`; the remaining authorization is voided. |
| FR-30 | S | The seller can issue a full or partial refund of a captured milestone (PayPal refund). |
| FR-31 | M | A worker reauthorizes the hold after the honor period while funds remain uncaptured and the 29-day window is open. |
| FR-32 | M | PayPal webhooks are signature-verified and idempotent; a reconciliation job repairs missed events. |
| FR-33 | M | Contracts expire (`EXPIRED`) if the authorization window closes with uncaptured funds. |

### 6.5 Ledger and Proof Pack
| ID | Pri | Requirement |
|---|---|---|
| FR-34 | M | Every state change appends a hash-chained ledger event; `GET /ledger/verify` reports chain validity. |
| FR-35 | M | The Proof Pack exports as JSON; `[S]` also as PDF. |
| FR-36 | M | The ledger UI uses AG Grid with sort, filter, quick search, and a detail drawer. |

### 6.6 Agents, demo, operations
| ID | Pri | Requirement |
|---|---|---|
| FR-37 | M | All contract functions are available over REST with API keys (agent-friendly). |
| FR-38 | S | An MCP server exposes six tools (see `api-spec.md` §9). |
| FR-39 | M | A scenario runner executes `happy_path`, `reject_then_pass`, `injection_attack`, `capture_declined`, `silent_buyer_autorelease` and streams steps to an Agent Console over SSE. |
| FR-40 | M | Judge Mode: persona sign-in buttons, scenario buttons, sandbox credential banner, recorded fallback link. |
| FR-41 | M | LLM daily budget cap, per-IP rate limits, and degraded mode (deterministic checks still run; rubric items → `cannot_verify` → escalate). |
| FR-42 | S | Chaos mode: per-contract `PayPal-Mock-Response` codes in sandbox (`CHAOS_MODE=true` only). |
| FR-43 | C | Dispute loop: Proof Pack submitted as seller evidence via PayPal's provide-evidence API. |
| FR-44 | C | `external_status` oracle criterion (e.g., GitHub commit status = success). |
| FR-45 | C | Buyer/seller agents exchange one counter-offer before lock. |
| FR-46 | C | Seller "verified delivery rate" badge computed from the ledger. |
| FR-47 | M | `GET /health` reports DB, PayPal, and LLM status; structured logs carry `request_id`. |

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Page loads < 2 s on broadband; compile p95 ≤ 10 s; verification p95 ≤ 20 s; capture call p95 ≤ 5 s. |
| Reliability | No double captures (idempotency + state guard); all PayPal calls retried safely; jobs survive restarts. |
| Integrity | Ledger is append-only (DB trigger) and hash-chained; money stored as integer minor units. |
| Security baseline | See `security-privacy.md`; no secrets in repo; webhook signatures verified; per-contract authorization on every route. |
| Cost | LLM spend ≤ `LLM_DAILY_BUDGET_USD` (default $5/day); target ≤ $0.03 per verification. |
| Accessibility | WCAG 2.1 AA targets for contrast and keyboard; status never conveyed by color alone. |
| Browser support | Latest Chrome, Edge, Safari, Firefox; responsive down to 360 px. |
| Availability | Hosted demo available and free for judges through Dec 15, 2026. |

## 8. Scope

| Tier | Contents |
|---|---|
| **MVP (must be demo-ready by Nov 9)** | FR-1…8, 10–14, 15–28, 31–35, 36, 37, 39, 40, 41, 47 |
| **Should (Nov 8–10 if on schedule)** | FR-29, 30, 35-PDF, 38 (MCP), 42 (chaos mode) |
| **Could (only after MVP is solid)** | FR-9, 43 (dispute loop), 44, 45, 46 |
| **Won't** | See §3 non-goals |

## 9. Success metrics

| Type | Metric | Target |
|---|---|---|
| Demo | End-to-end run (compile → fund → reject → fix → capture) completes on the hosted URL | 5 consecutive successes before recording |
| Verifier | **False passes** on the 19 non-passing eval cases F01–F09 and A01–A10 (headline metric; F10 is a documented optional-criterion limitation case) | 0 / 19 |
| Verifier | False rejects on the 10 passing cases | ≤ 1 / 10 |
| Verifier | Verified-quote rate after code filtering | 100% |
| Money safety | Double captures in chaos suite | 0 |
| Resilience | PayPal failure modes handled in the chaos suite | ≥ 10 |
| Submission | All Devpost requirements met; video < 3:00; repo public with license | Yes |
| Hosting | Uptime through Dec 15 | Manual checks on Dec 1, 8, 15 |

## 10. Assumptions and open questions

| # | Assumption / question | Handling |
|---|---|---|
| A1 | Team of 4 (backend/PayPal, AI, frontend, infra/demo) | Roles in `roadmap.md`; merge roles for smaller teams |
| A2 | Seller = the one sandbox business account | Documented; marketplace mode is a non-goal |
| A3 | Sandbox supports partial captures on authorizations | **Day-1 spike gates the project**; fallback: AP Firewall idea |
| A4 | Sandbox reauthorization can't be fully exercised in 10 days | Unit tests + recorded call shape; demo doesn't depend on it |
| A5 | Webhook event names listed in `paypal-integration.md` match PayPal's current names | Verify on day 1 in the PayPal developer dashboard |
| Q1 | Does Render's participant credit cover hosting through Dec 15? | Check balance on Nov 5; fall back to the smallest paid tier |
| Q2 | Is AG Grid Community acceptable for the AG Grid prize? | Ask sponsor via Discord/FAQ; optional AG Studio trial |
