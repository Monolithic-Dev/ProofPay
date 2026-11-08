# ProofPay — The Winning Playbook (single source of truth)

> **Read this first.** It consolidates the strategy, scope lock, schedule, evidence pack, risks and doc map from all earlier files. Where it disagrees with an older document, **this file wins** (see §10).
> **Date:** Tue Nov 3, 2026 · **Feature freeze:** Nov 9 23:59 IST · **Record:** Nov 10 · **Submit:** Nov 11 by 18:00 IST (official cutoff Nov 12 12:00 PT = Nov 13 01:30 IST; do not use it).
> **Team:** you (PO/lead) + Engineer 1 (Platform & Security) + Engineer 2 (AI Assurance & Product).
> **Honest note:** nobody can guarantee a win. This plan maximizes your odds by removing ways to lose, adding evidence nobody else will have, and making the demo undeniable.

---

## 1. The thesis (what we are, in one breath)

**ProofPay: payments that carry their own proof.**
A PayPal authorization hold is released milestone by milestone only when delivered work passes *rules*, with the AI supplying quoted evidence, and the result is something **anyone can verify without trusting us**.

Three pillars (every screen, slide and sentence maps to one):
1. **Verifiable:** rules decide; AI only supplies evidence; decisions are signed/hash-chained and checkable offline.
2. **Agent-safe:** agents act with scoped keys inside mandates; they have **no** tool to approve, release or refund; a human approves the hold.
3. **PayPal-native:** authorize, partial capture, void, reauthorize, refund, webhooks, idempotency, reconciliation, chaos-tested.

**Why this wins on each criterion**

| Criterion | What judges will conclude if we execute this plan |
|---|---|
| Technological Implementation | Deep, correct PayPal usage + AI with safeguards + measured results (eval, red team, chaos, mutation score) + defense-in-depth security (RLS, step-up, SSRF guard) |
| Design | A complete product: real accounts, orgs, roles, inbox, Funds Bar, evidence-highlighted reports, Security Center, consistent states |
| Potential Impact | A specific problem and audience, **evidence from real people** (interviews, timing study, pilot), honest limits |
| Innovation/Idea | "Don't trust us: verify" (signed attestations, offline verifier), executable/junk-resistant acceptance, adversarially tested verifier, bounded agents |
| Presentation | One clear thread, three "wow" moments, numbers on screen that match committed files, frictionless judge lane |

---

## 2. The "wow list" (what a judge must see inside 3 minutes)

| # | Moment | Where it lives | Status check |
|---|---|---|---|
| 1 | **Real product**: sign-up → workspace → dashboard/inbox | App shell, onboarding | verify with outsiders |
| 2 | **Clarity Score + satisfiability lint + one-click fix** | Contract editor (AIP-11, B5) | Implemented & Tested |
| 3 | **Funding with step-up + two-person approval → PayPal hold** | PLAT-3, funding approvals | Implemented & Tested |
| 4 | **Reject with exact fix hints → pass → capture**, with **PayPal activity** (request key, capture id) | AIP-2, Verification Theater, PayPal inspector | Implemented & Tested |
| 5 | **Injection blocked** (including a cross-milestone attempt) | AIP-10, adversarial stage | Implemented & Tested |
| 6 | **Offline verify: tamper one character → red** | `/verify`, signed attestations, checkpoints | Implemented & Tested |
| 7 | **`/trust`: eval (dev/held-out/external), red team, chaos, mutation score, limits** | Trust Center | Implemented & Tested |
| 8 | **Express lane**: judge reaches a real verified release in ≤ 90 s | AIP-13 (`/demo/express`) | Implemented & Tested |
| Optional | **Two agents negotiate within mandates** | bounded negotiation (`/demo/mcp`, `/demo/tribunal`) | Implemented & Tested |

---

## 3. Scope lock

### In (final)
- **Engineer 1:** PLAT-1 `safeFetch`, PLAT-2 CI security gates, PLAT-3 step-up auth, PLAT-5 Row-Level Security (flagged), PLAT-4 API-key hardening, PLAT-10 funding hardening, PLAT-6 Security Center API, PLAT-11 durable rate limits + nonce CSP, PLAT-12 email-abuse + link/redirect hardening, PLAT-9 security docs. (Could: PLAT-13 mutation testing, PLAT-7, PLAT-8, PLAT-14.)
- **Engineer 2:** AIP-1 eval evidence gate, AIP-2 fix hints, AIP-3 AI transparency UI, AIP-10 context-injection + obfuscation scanning, AIP-11 satisfiability + junk detector, AIP-12 auto-release eligibility, AIP-14 eval expansion + external red team + public bench, AIP-13 express judge lane, AIP-6 Security Center UI, AIP-5-lite canary. (Could: AIP-4, breaker, receipts, ICS, digest, PII shield, consensus.)
- **You (PO):** interviews + timing study, copy/pricing fixes, doc consolidation, Evidence section, README/Devpost/video, external red-teamers, demo-pool refills, sponsor choices, logistics (details in §6 and the appendix).
- Tickets, hours and day plan: `docs/sprint/02-ISSUE-BOARD-AND-ASSIGNMENT.md`, `03-…`, `04-…`.

### Out until Nov 11 (do not start)
New pages beyond `/trust`, `/verify`, `/status`, express lane · extra LLM providers · blockchain anchoring · real seller payouts · multi-currency · custom roles/SSO · anything inside `src/server/release/**` · new features not on the board.

### The rule
**No new ideas after Nov 5.** After that, an idea may enter only if it **replaces** something of equal size and you record the swap in `docs/decision-log.md`.

---

## 4. The non-negotiable quality bar (all must be true before Nov 9 23:59)

1. No contradictions or overclaims: `scripts/check-copy.mjs` is green on `src/`, `README.md`, `docs/`; no "escrow" (except "not escrow"), "locked/guaranteed/proves/cryptographically verified/0% fee".
2. The decision step is called the **rule engine**; MCP has **no** release/approve/refund tool.
3. Auto-release **cannot be farmed** (AIP-12 tests green).
4. Context injection closed (AIP-10 tests green); eval includes those cases.
5. Eval: ≥ 120 cases, dev/held-out/external reported separately, **0 false passes** on non-pass cases (or each exception documented), intervals printed.
6. Funding hardened (state binding, attempt-scoped idempotency), time-scale guard in place.
7. Step-up enforced on the listed sensitive actions.
8. Tenant isolation: RLS enabled and tested **or** honestly shipped disabled with tests and a note.
9. Durable rate limits; nonce CSP enforced; email abuse controls on.
10. Money invariant test passes after every chaos case; chaos results published.
11. One status vocabulary; rejection ≠ dispute; one `fundsSummary()` for all money numbers.
12. Every authenticated page is under `/app` with one shell; all states designed; axe clean on 8 pages.
13. Trust Center numbers come from committed result files (a test compares them).
14. Express lane works with a **real** sandbox capture and honest labeling.
15. Video ≤ 3:00, public, shows the real flow; numbers match README/Devpost; two-person proofread done.

---

## 5. Evidence pack (produce, commit, and show)

| Artifact | Command / owner | Shown where |
|---|---|---|
| `docs/eval-results.md` (front matter + per-set tables + intervals) | `npm run eval -- --write-evidence` · E2 | `/trust`, README |
| `bench/proofpay-bench.jsonl` + README | E2 | repo, Devpost |
| Red-team/external attack results | E2 + PO | `/trust` |
| `docs/chaos-results.md` | `npm run chaos` · E1 | `/trust` |
| `tests/security/rls.test.ts` results | E1 | `/trust` (or honest "disabled" note) |
| CI security jobs, `sbom.json`, mutation report | E1 | repo badges, `/trust` |
| `docs/security/*` (STRIDE, ASVS L1, disclosure) | E1 | `/trust` |
| Interviews (≥ 5), timing study (≥ 5), pilot case study | PO | README "Evidence", Devpost |
| `docs/proof-pack-sample.json` + `/verify` demo | E1/E2 | video, README |
| Screenshots: dashboard, Funds Bar mid-release, report with highlights, Security Center, `/verify` tamper | everyone | Devpost, README |

---

## 6. Your work package (PO), about 30 hours

| ID | Task | Hours | When | Done when |
|---|---|---|---|---|
| PO-1 | Copy/pricing fixes (landing, pricing, Terms draft, demo copy) | 2 | Nov 3 | `check-copy` green; claims table in `docs/product` updated |
| PO-2 | 5 interviews (script in audit appendix) | 3 | Nov 3–6 | notes + quotes + consent |
| PO-3 | Timing/accuracy study with 5 participants | 3 | Nov 5–7 | table of medians, n, caveats |
| PO-4 | One pilot contract with outsiders (sandbox) | 2 | Nov 6–8 | short case study |
| PO-5 | Recruit 3 external red-teamers; collect submissions | 2 | Nov 4–7 | files in `bench/submissions/` |
| PO-6 | Doc consolidation (see §10) | 3 | Nov 8 | `docs/SPEC.md` index + superseded markers |
| PO-7 | Express-lane pool: create/approve demo contracts | 1 + weekly | Nov 8; refills Nov 12, 20, Dec 1, 8, 14 | pool shows ≥ 6 AVAILABLE |
| PO-8 | README + Devpost text (how PayPal/AI used, evidence, limits) | 4 | Nov 8–10 | two-person proofread |
| PO-9 | Video: script v4, rehearse ×3, record, edit, captions, upload public | 8 | Nov 8–10 | exported ≤ 2:58, link tested logged-out |
| PO-10 | Sponsor choices (AG Grid, Render, APIMatic only if SDK is real) | 1 | Nov 8 | listed in Devpost |
| PO-11 | Logistics checklist (appendix) + hosting calendar to Dec 15 | 2 | Nov 8–11 | calendar events exist |
| PO-12 | PayPal partner application research (cost, requirements) | 2 | after Nov 11 | decision note |

---

## 7. Consolidated schedule

| Day | You (PO) | Engineer 1 | Engineer 2 |
|---|---|---|---|
| **Nov 3** | PO-1; schedule interviews; create board/labels (`scripts/create-issues.sh --apply --labels`) | PLAT-1, PLAT-2 | AIP-1 |
| **Nov 4** | PO-2 interviews 1–2; recruit red-teamers | PLAT-3 (+pairing) | AIP-2, AIP-3 |
| **Nov 5** | PO-2/PO-3 start; **idea freeze** | PLAT-5 part 1 | AIP-3, AIP-10 |
| **Nov 6** | PO-4, PO-5 | PLAT-5 part 2, PLAT-4 | AIP-11 (+pairing) |
| **Nov 7** | PO-3 finish; collect attacks | PLAT-4, PLAT-10, PLAT-6; **RLS decision 18:30** | AIP-12, AIP-14 (part 1) |
| **Nov 8** | PO-6, PO-7, PO-8, PO-10 | PLAT-11 (CSP report-only), PLAT-12 | AIP-14 (part 2), AIP-13, AIP-6 start |
| **Nov 9** | Final copy/number check; **freeze 23:59** | PLAT-12, PLAT-9, CSP enforce, regression | AIP-6, AIP-14 final, AIP-5-lite, regression |
| **Nov 10** | **Record/edit/upload video** (with E2/E1 support) | P0 fixes only | P0 fixes only |
| **Nov 11** | **Submit by 18:00 IST**; verify links logged-out | QA | QA |

Daily: async stand-up by 10:00 IST; 18:30 IST sync (demo merged work, apply cut triggers from `02` §6).

---

## 8. Pre-mortem: the 14 ways we lose, and the counter

| # | Failure | Counter | Owner |
|---|---|---|---|
| 1 | A judge finds a false pass or an exploit (auto-release farming, injection) | AIP-10/11/12/14 + red team + evidence gate | E2 |
| 2 | An overclaim contradicts the code ("escrow", "locked", "0% fee") | copy guard in CI; PO proofread | PO |
| 3 | The live demo breaks (PayPal, LLM, DB) | express lane, recorded video, fixtures, degraded mode | E2/PO |
| 4 | Judges can't get past sign-up/PayPal approval | express lane; sandbox buyer credentials only in `/demo` | E2 |
| 5 | Hosting dies before Dec 15 | non-expiring tiers, caps, weekly smoke, refills | PO |
| 6 | Secret leaks (repo, video, logs) | gitleaks, scan script, blur dashboards, 2FA on all vendor accounts | all |
| 7 | RLS or step-up breaks the flow late | flags; decision at Nov 7 18:30; regression on Nov 9 | E1 |
| 8 | Scope creep eats the schedule | idea freeze Nov 5; cut triggers | PO |
| 9 | Video too long or inconsistent | script v4, three rehearsals, check exported duration | PO |
| 10 | Numbers differ across README/Devpost/video | single source files; two-person proofread | PO |
| 11 | Email deliverability breaks sign-up/invites | provider with verified sender, outbox retries, pre-verified seed accounts for judges | E1 |
| 12 | Teammate unavailable/burnout | WIP limits, cross-review, cut triggers, no work after freeze except P0 | PO |
| 13 | Submission timing mistake (time zones) | internal deadline Nov 11 18:00 IST; calendar alarms | PO |
| 14 | "It's just a demo" impression | real auth/orgs/roles, polished states, Trust Center, evidence from people | all |

---

## 9. Judge Q&A bank (one-sentence answers; rehearse)

1. *Is this escrow?* No: a PayPal authorization hold; ProofPay never holds funds.
2. *Can funds still fail at capture?* Yes, authorization isn't a guarantee; we show hold health, handle declines, and reconcile.
3. *Why trust the AI?* It never decides: rules do, using quotes verified in code; low confidence escalates; here are measured results and an external red team.
4. *Can a seller game auto-release?* No: eligibility requires deterministic passes, no manipulation, human-sign-off reasons only, and delivered reminders.
5. *Can an agent drain the buyer?* Scoped keys, caps, mandates, step-up for humans, no approval/release tools; a human approves the hold.
6. *Could you rewrite your records?* Not silently once a checkpoint is published; the offline verifier detects it.
7. *What does the signature prove?* That ProofPay issued this attestation for this input, not that the AI was right.
8. *How do sellers get paid in real life?* Sandbox today routes to one test merchant; production needs PayPal partner onboarding (next step).
9. *What about fees?* Not modeled in sandbox; real PayPal fees apply per its schedule; we warn about tiny milestones.
10. *What if PayPal or the LLM is down?* Degraded mode escalates instead of guessing; hold status is live-checked; status page and runbook exist.
11. *How is tenant data isolated?* Permissions in code plus database row-level security (if enabled) with tests; limits documented.
12. *What data goes to AI providers?* Only the deliverable text needed for checks; providers listed; PII masking is planned/implemented per the Trust Center.
13. *What are the limits?* English-first, JSON/text/CSV deliverables, 28-day contracts, sandbox only, small evaluation sets with intervals.
14. *What did real users say?* Show quotes and the timing study with n.
15. *What's next?* Partner onboarding, attachments, disputes, amendments, SSO.

---

## 10. Document map and authority (end the sprawl)

**Authority order when documents disagree:** (1) this playbook, (2) `docs/sprint/*` (tickets), (3) `docs/product/*` (product v2), (4) `docs/spec/*` (engineering v1), (5) `docs/plan/*` (phase runbooks, historical). PayPal's *observed* sandbox behavior beats all documents.

| Folder (from this conversation) | Status | Use for |
|---|---|---|
| `docs/WINNING-PLAYBOOK.md` (this file) | **Authoritative** | strategy, scope, schedule, checklists |
| `docs/sprint/` | **Authoritative** | tickets and assignments |
| `docs/audit/` | **Reference** | flaw register, self-audit script, evidence protocols |
| `docs/winning-plan/` | **Superseded** (ideas folded in here) | historical rationale |
| `docs/product/` | **Reference** (product v2 scope, RBAC, UX) | features, permission matrix, UX specs |
| `docs/spec/` | **Reference** (engineering v1) | data model, API, PayPal integration details |
| `docs/plan/` | **Historical** | phase runbooks already executed |

---

## 11. Go/No-go checklists

### Nov 9 23:59 IST (feature freeze)
- [ ] Quality bar in §4 all ticked (or exceptions written in `docs/decision-log.md` with owners).
- [ ] `scripts/self-audit.sh`: no P0/P1 leads; `check-copy`, money-invariants, secrets scan green.
- [ ] Eval/chaos/red-team/mutation files regenerated on the frozen commit; `/trust` matches them.
- [ ] Flags decided (RLS, step-up, funding state, CSP enforce, rate limits).
- [ ] Express lane pool ≥ 6 AVAILABLE; seed data realistic; two browser profiles ready.

### Nov 11 18:00 IST (submit)
- [ ] Repo public, license visible, no secrets in history, clean-clone quick start works (< 10 min).
- [ ] Hosted URL healthy; `/demo/express` works; sandbox buyer credentials correct and only under `/demo`.
- [ ] Video public, ≤ 3:00, plays logged-out; link in README and Devpost.
- [ ] Devpost text complete (how PayPal/AI used, tools, evidence, limits); numbers match; two-person proofread done.
- [ ] Submission confirmation screenshot saved; tag `v1.0.0-submission`; calendar for Dec 1/8/14 refills and smoke tests set.
