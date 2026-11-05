# ProofPay — Full Audit & Improvement Plan (end to end)

> **Purpose:** a critical, end-to-end review of everything designed or built so far (product, money path, AI verification, security, reliability, UX, testing, docs, hackathon submission), plus new ideas to win.
> **Date:** Tue Nov 3, 2026 · freeze **Nov 9 23:59 IST** · record Nov 10 · submit Nov 11 by 18:00 IST.
> **Team:** you (product owner/lead) + 2 engineers (E1 Platform & Security, E2 AI & Product).

## 0. How to read this (method and limits)

- I have **not seen your code or UI**. This audit is based on (a) the specs, plans and skills I produced, (b) the reference document you pasted, and (c) common failure patterns in products like this. Every finding therefore has **"Check"**: a quick way to confirm it in your repo. Run `scripts/self-audit.sh` from the repo root first; it automates ~20 of the checks.
- **Some flaws are in my own earlier specs** (marked 🅼). They are included because an agent that followed my spec will have inherited them.
- Severity: **P0** = can lose points or mislead or cause a security/money problem; **P1** = real weakness a careful judge may find; **P2** = polish/depth.
- Owners: **E1** (platform/security), **E2** (AI/product), **PO** (you).

---

## 1. Executive summary

**You are past the point where more features help.** What separates winners now is (1) *no embarrassing contradictions*, (2) *evidence from real people and real measurements*, (3) *a few security and AI-assurance features that go beyond a demo*, and (4) *a frictionless judge experience*.

### The 12 findings that matter most
| # | Finding | Sev | Fix in one line |
|---|---|---|---|
| 1 | **Auto-release can be farmed**: a seller can deliberately trigger "needs review" so a silent buyer's milestone auto-releases 🅼 | P0 | Auto-release only when required deterministic checks passed and no manipulation flag; otherwise route to support, never release |
| 2 | **Cross-milestone injection**: milestone 1 content is fed to the AI as "trusted context" for milestone 2, but the seller wrote it 🅼 | P0 | Treat context as untrusted; pass deterministic summaries (counts, categories), not raw text |
| 3 | **Eval set is small and self-authored**; claims of accuracy rest on ~30 cases written by the team | P0 | Grow to 100+, add external attackers, publish the dataset and confidence intervals |
| 4 | **No evidence from real users** (no interviews, benchmark, pilot) | P0 | 5 interviews + a 5-person timing study + one pilot contract; add an "Evidence" section |
| 5 | **"Funds secured/locked" language** vs reality (an authorization can still fail at capture) | P0 | Say "authorized on PayPal"; add hold-health checks and capture-risk disclosure |
| 6 | **`GET /paypal/return` changes state** and has no session-bound `state` parameter 🅼 | P1 | Bind a `state` nonce to session+contract; confirm via POST |
| 7 | **Re-funding reuses the same PayPal request id** (`…:fund:1`) so a retry after an abandoned approval can replay a stale order 🅼 | P1 | Add a `funding_attempt` counter to the key |
| 8 | **`DEMO_TIME_SCALE` can shorten auto-release windows** if left on in the hosted environment 🅼 | P1 | Refuse to start with scale > 1 unless `DEMO_MODE`; show a banner |
| 9 | **Rate limits are in memory** (reset on deploy; bypassable) 🅼 | P1 | Postgres-backed token buckets for auth/invite/compile endpoints |
| 10 | **CSP allows inline scripts** and `unsafe-eval` in the spec 🅼 | P1 | Nonce-based CSP; remove `unsafe-inline` for scripts |
| 11 | **Invite/notification emails are an abuse vector** (spam/phishing with attacker-controlled titles) | P1 | Limits, content sanitization, verified-account age, "report abuse" |
| 12 | **Spec sprawl**: six overlapping documents with different status names, routes and claims 🅼 | P1 | One `SPEC.md` index, ADRs, changelog; mark superseded docs |

### If you only do 12 things (ordered)
1. Fix #1, #2, #5 (credibility and safety). 2. Run `self-audit.sh` and fix P0/P1 hits. 3. Interviews + timing study (PO). 4. Expand eval + external red team. 5. Step-up auth, API-key hardening, SSRF-safe fetch (E1 tickets). 6. RLS (E1) behind a flag. 7. Fix hints + AI transparency UI + canary (E2). 8. Express judge lane. 9. Doc consolidation. 10. Mutation-testing badge on policy/permissions. 11. Trust Center with all numbers. 12. Rehearse the video ×3.

---

## 2. Flaw register

### A. Product & positioning

| ID | Finding | Sev | Check | Fix | Effort | Owner |
|---|---|---|---|---|---|---|
| P-1 | **Story diffusion**: payments + AI + agents + RBAC + negotiation + webhooks compete for 3 minutes | P1 | Show landing for 60 s to 3 outsiders; ask for a 2-sentence summary | One sentence + three pillars (*Proof you can verify · Agents within limits · PayPal moves the money*); hide non-core nav items; video shows 3 moments only | 2 h | PO |
| P-2 | **No real-user evidence** | P0 | Search README/Devpost for interviews, benchmarks, pilot results | See §3 I-1: 5 interviews, timing study, pilot; include quotes and numbers (with sample sizes) | 6 h | PO |
| P-3 | **Supported deliverables (JSON/text) are narrower than the claimed audience** (freelancers deliver files, code, design) | P1 | List supported `content_type`s | State supported types prominently; add CSV; add executable tests for code; human-review path for files; example gallery | 2–8 h | E2/PO |
| P-4 | **Seller payout is simulated** (single sandbox merchant) | P1 | Read Payments settings copy | Honest copy everywhere; roadmap slide; start PayPal partner application | 1 h + application | PO |
| P-5 | **Pricing invented or contradictory** ("0% escrow fee", "flat per-verification") | P0 | `grep -ri "escrow fee\|per-verification" src docs README.md` | "Sandbox: free. Pricing to be announced." plus a cost-per-verification number from `llm_calls` | 1 h | PO |
| P-6 | **No explicit comparison to alternatives** | P2 | README | Add a cautious, factual comparison table (marketplace protection, custodial escrow, agent payment protocols, ProofPay) | 2 h | PO |
| P-7 | **Hackathon/"Judge Mode" branding leaks into the product** | P2 | `grep -ri "judge mode\|hackathon" src` | Rename to "Sandbox playground"; credit only in footer | 1 h | E2 |

### B. Money & PayPal

| ID | Finding | Sev | Check | Fix | Effort | Owner |
|---|---|---|---|---|---|---|
| M-1 | **Authorization ≠ guaranteed funds**; "secured/locked" wording | P0 | `grep -rniE "secured\|locked\|guarantee" src docs` | Reword to "authorized on PayPal; capture is subject to PayPal's checks"; add **hold-health check** (live authorization status) before a seller starts each milestone; show capture-risk note | 3 h | E1+PO |
| M-2 | **Fees not modeled**; each partial capture may carry fixed fees (⚠ verify PayPal's current schedule) so many tiny milestones are costly in real use | P1 | Read Pricing/Payments copy | Disclose; add a **fee-aware milestone advisor** warning when milestones are very small | 2 h | E2 |
| M-3 | **29-day limit** blocks real long jobs | P1 | Try a 40-day contract | Clear lint message; stage funding windows (backlog: hold-renewal planner) | 1 h now | E2 |
| M-4 | **Reauthorization only mock-tested** | P2 | Chaos results | Disclose; try a live reauth when the honor period passes (calendar Nov 6/Dec) | 1 h | E1 |
| M-5 | **Disputes/chargebacks**: PayPal's buyer/seller protections for services/digital goods may not apply as users assume | P1 | Terms/FAQ | Disclose; never imply protection; Proof Pack is evidence, not a guarantee | 1 h | PO |
| M-6 | **Self-dealing / transaction laundering** (buyer and seller are the same actor) | P1 (real product) | Risk rules | Risk rule: shared device/IP/email domain/owners between parties → step-up + review (sandbox-safe) | 3 h | E1 |
| M-7 🅼 | **State-changing GET** `/paypal/return` without session-bound `state` | P1 | Open the route file | Add `state` nonce; POST confirm; verify order id and buyer org | 3 h | E1 |
| M-8 🅼 | **Re-fund replays old order** (`pp:{id}:fund:1`) | P1 | Abandon approval, retry funding | `funding_attempt` counter in the idempotency key; stale order check via GET | 1 h | E1 (money-adjacent: both review) |
| M-9 | **Money invariant formula wrong in reference doc** (per-milestone remaining) | P1 | Reference doc §8 | One `fundsSummary()` function + test after each chaos case | 2 h | E1 |
| M-10 🅼 | **Auto-release farming** (see exec summary #1) | P0 | Create a milestone with a rubric criterion; submit ambiguous content; stay silent | Eligibility rules (see AIP-12); escalate to support instead of releasing; reminders at 50/90% | 3 h | E2 (+E1 review) |
| M-11 🅼 | **`DEMO_TIME_SCALE` hazard** | P1 | Set it >1 on staging | Startup guard + banner + ledger marker `time_scaled:true` | 1 h | E1 |

### C. Verification & AI

| ID | Finding | Sev | Check | Fix | Effort | Owner |
|---|---|---|---|---|---|---|
| A-1 | **Small, self-authored eval** (≈30 cases) | P0 | Count `tests/eval/cases` | Generate 100+ cases (families × mutations), recruit 3 external red-teamers (friends) with a small prize, publish dataset + Wilson/rule-of-three intervals | 6 h | E2/PO |
| A-2 🅼 | **Cross-milestone context injection** (m1 text fed as "trusted") | P0 | Put an instruction in m1; see if it influences m2 | Pass only **deterministic summaries** (counts, distinct categories, hashes) to m2's rubric; wrap any raw context as untrusted; add eval cases | 4 h | E2 |
| A-3 | **Structure-level injection** (keys, field names, JSON comments, markdown/HTML comments, filenames) | P1 | Test a key named "ignore rules" | Scan keys and structure, not only values; include in adversarial heuristics and evidence extraction | 2 h | E2 |
| A-4 | **Obfuscation and multilingual** (base64, homoglyphs/leet, Hindi/Telugu/Spanish) | P1 | Eval cases A03/A09 | Unicode confusable normalization, decode-and-scan base64/hex segments, multilingual cases in eval (relevant to your users) | 3 h | E2 |
| A-5 | **Evidence presence ≠ evidence support** (a true but irrelevant quote) | P1 | Craft such a case | Second-model consensus on high-value milestones (reuse your two providers); deterministic anchors where possible | 3 h | E2 |
| A-6 | **Semantic junk passes deterministic checks** ("N/A", lorem ipsum, copy-pasted rows, keyword stuffing) | P1 | Submit 25 rows of "TBD" that fit the schema | **Junk detector**: placeholder tokens, duplicate ratio, low entropy, language check; add as optional required checks in templates | 3 h | E2 |
| A-7 | **Feedback leakage and grind attacks** (iterating until the rubric passes) | P1 | Look at attempts and feedback detail | Cooldown between attempts, cap feedback detail for rubric (not for deterministic), log attempt patterns, alert on grinding | 2 h | E2 |
| A-8 | **Silent model drift/non-determinism** | P1 | Compare canary outputs over days | Pin model ids; nightly canary (AIP-5); alert on change; record model id on every verification | 6 h | E2 |
| A-9 | **Data flows to multiple LLM providers** | P1 | Privacy page | Disclose providers and what is sent; PII Shield; per-org opt-out of fallback provider | 3 h | E2 |
| A-10 | **No calibration/abstention** | P2 | `docs/` | AIP-4 | 6 h | E2 |
| A-11 | **Concurrent-judge load on LLM budget/latency** | P2 | Load test | Queue priority, cache, budget caps, breaker, fixtures-first demos | 3 h | E2 |
| A-12 | **Contradictory/unsatisfiable criteria not caught** (`min > max`, schema vs row count, due date outside window) | P1 | Create such a contract | **Satisfiability linter** + generate a sample passing artifact and run it through the checks (a contract that no valid artifact can pass is a lint error) | 4 h | E2 |

### D. Security

| ID | Finding | Sev | Check | Fix | Effort | Owner |
|---|---|---|---|---|---|---|
| S-1 | **Hash chain alone doesn't stop an operator rewriting history** | P1 | Ledger design | Signed checkpoints + offline verifier (if not done); disclose limits | 6 h | E1 |
| S-2 | **Hand-rolled auth risks** (enumeration, session fixation, CSRF, reset flaws, no MFA) | P0 if hand-rolled | `ls src/app/api/v1/auth`; review `login` handler | Adopt a maintained library or add tests for every item in the auth checklist | 4–8 h | E1 |
| S-3 | **No database tenant isolation** (only app checks) | P1 | `\d+ contracts` shows no policies | RLS (PLAT-5) | 10 h | E1 |
| S-4 🅼 | **In-memory rate limits** | P1 | `grep -rn "new Map" src/server/util` | DB-backed token bucket (login, forgot, register, invite, compile, submissions) | 3 h | E1 |
| S-5 🅼 | **CSP weak** (`unsafe-inline`/`unsafe-eval` scripts) | P1 | `grep -n "Content-Security-Policy" next.config.*` | Nonce-based CSP via middleware; keep `style-src 'unsafe-inline'` only for AG Grid | 3 h | E1 |
| S-6 | **Email abuse** (invites as spam/phishing; HTML injection in titles) | P1 | Send an invite with HTML in the title | Plain-text user fields in emails, limits per org/user/day, account-age gate for external invites, abuse report link | 3 h | E1 |
| S-7 | **Host-header injection in emailed links** | P1 | `grep -rn "headers.get('host')\|x-forwarded-host\|nextUrl.origin" src` | Always build links from `APP_BASE_URL` | 1 h | E1 |
| S-8 | **Open redirect** via `next=` after sign-in/invite | P1 | `grep -rn "next=\|redirect(" src` | Allow only same-origin relative paths | 1 h | E1 |
| S-9 | **Prototype pollution / JSON edge cases** from deliverables | P2 | Fuzz `__proto__`, `constructor` keys | Never deep-merge user JSON; Ajv strict; fuzz tests | 2 h | E2 |
| S-10 | **SSRF** in outbound webhooks/link checks | P1 | `grep -rn "fetch(" src/server` | `safeFetch` (PLAT-1) | 4 h | E1 |
| S-11 | **API key model**: plain SHA-256, no expiry/allowlist/rotation | P1 | `api_keys` columns | PLAT-4 | 5 h | E1 |
| S-12 | **Sensitive actions without fresh auth** | P1 | Try funding with a stale session | Step-up (PLAT-3) | 6 h | E1 |
| S-13 | **Demo accounts/credentials** (shared passwords, email relay risk) | P1 | `/demo`, env | Rotate; isolate Demo Workspace (RLS); block outbound email to non-allowlisted domains from demo org | 2 h | E1 |
| S-14 | **MCP/agent keys**: no per-key rate limit; limited alerts | P2 | MCP docs | Per-key limits; new-IP alert; audit | 2 h | E1 |
| S-15 | **Backups/dumps may contain secrets/PII** | P2 | `scripts/backup.sh` | Encrypt dumps; restrict access; document | 1 h | E1 |
| S-16 | **Supply chain** unaudited | P1 | CI workflows | PLAT-2 | 3 h | E1 |
| S-17 | **Admin console exposure** | P1 | `/admin` as normal user | Staff role + MFA + (optional) IP allowlist; 404 for non-staff | 2 h | E1 |
| S-18 | **Queued-job permission drift** (actor removed after enqueuing) | P2 | Remove a member with a pending job | Re-verify permission at execution for user-initiated money actions | 2 h | E1 |

### E. Reliability & operations

| ID | Finding | Sev | Fix | Effort | Owner |
|---|---|---|---|---|---|
| O-1 | **Single worker; no starvation/priority controls** | P2 | Job priorities (user-visible first), concurrency per type, queue-depth metric | 3 h | E1 |
| O-2 | **Backups/restore untested** | P1 | Run the drill once; record timing | 1 h | E1 |
| O-3 | **Request-id not propagated into jobs; no metrics** | P2 | Add `request_id` to job payload; staff-only `/metrics` | 4 h | E1 |
| O-4 | **Hosting expiry/credits risk until Dec 15** | P0 | Verify plan retention; calendar; spend caps | 1 h | PO |
| O-5 | **No public status page** | P2 | `/status` from health + canary | 2 h | E2 |
| O-6 | **Dependency outage messaging** (PayPal/LLM) | P2 | Banners and degraded-mode copy | 2 h | E2 |
| O-7 | **No load test** | P2 | k6 smoke (50 browsing, 10 submissions/min) | 4 h | E1 |

### F. UX & design

| ID | Finding | Sev | Fix | Effort | Owner |
|---|---|---|---|---|---|
| U-1 | **Page quality unknown; stubs may be exposed** (34 pages) | P1 | Page quality matrix (Complete/Partial/Stub); hide stubs behind flags; remove dead links | 3 h | E2 |
| U-2 | **Judges' time-to-value** may exceed 5 minutes | P0 | **Express lane** (see I-5): guided 90-second path with pre-funded demo contract | 4 h | E2+PO |
| U-3 | **Criteria authoring is hard for non-technical buyers** | P1 | Plain-language criteria library, examples, sample-artifact preview, Clarity Score | 4 h | E2 |
| U-4 | **Mobile and accessibility unverified** | P1 | axe on 8 pages; 360 px pass; keyboard-only run | 3 h | E2 |
| U-5 | **Inconsistent IA** (`/app/*` vs top-level) | P1 | Consolidate under `/app` with redirects | 3 h | E2 |
| U-6 | **Notification overload** | P2 | Digest, preferences, quiet hours | 4 h | E2 |
| U-7 | **AI decisions not explained** | P1 | AIP-2/AIP-3 (fix hints, Rule vs AI-assisted labels) | 8 h | E2 |
| U-8 | **Auto-release timers feel like a dark pattern if not transparent** | P2 | Show timers, reminders, what happens next, and an opt-out per contract before accept | 2 h | E2 |

### G. Testing & quality

| ID | Finding | Sev | Fix | Effort | Owner |
|---|---|---|---|---|---|
| T-1 | **PayPal API drift** undetected | P1 | Recorded-fixture contract tests + nightly real-sandbox smoke | 3 h | E1 |
| T-2 | **No mutation testing** on the code that must never be wrong | P1 | Stryker on `policy.ts`, `permissions.ts`, `transitions.ts`; show mutation score | 3 h | E1 |
| T-3 | **Parsers not fuzzed** | P1 | `fast-check` fuzz for `parseArtifact`, `canonicalize`, `safeFetch` URL parsing | 2 h | E2 |
| T-4 | **E2E for two-org flow** may be missing | P1 | Playwright: sign-up → org → send → accept → approval → fund (stub) → submit → release | 4 h | E2 |
| T-5 | **No visual regression** | P2 | Playwright screenshots on 6 key pages | 2 h | E2 |
| T-6 | **Coverage not visible** | P2 | Coverage badge; targets on money/policy modules | 1 h | E1 |
| T-7 | **Flaky-test policy** | P2 | Quarantine + issue within 24 h | 0.5 h | both |

### H. Documentation & process

| ID | Finding | Sev | Fix | Effort | Owner |
|---|---|---|---|---|---|
| D-1 🅼 | **Spec sprawl and contradictions** (status names, routes, roles, claims) | P1 | `docs/SPEC.md` index; mark superseded docs; generate API docs from OpenAPI and data docs from schema; keep one **glossary** | 3 h | PO |
| D-2 | **No ADR/changelog discipline** | P2 | `docs/decision-log.md` + `CHANGELOG.md` (keep-a-changelog style) | 1 h | PO |
| D-3 | **OpenAPI may drift from routes** | P1 | Contract test: every route file appears in OpenAPI with matching method | 2 h | E1 |
| D-4 | **Third-party notices/licensing** | P2 | `THIRD_PARTY_NOTICES.md` from the license checker; confirm AG Grid Community usage terms | 1 h | PO |
| D-5 | **Skills/agent instructions drift** | P2 | Update `proofpay-orientation` after each phase | 0.5 h | PO |

### I. Hackathon submission

| ID | Finding | Sev | Fix | Effort | Owner |
|---|---|---|---|---|---|
| H-1 | **Judge friction**: each scenario needs a PayPal approval; credentials; unfamiliar flow | P0 | **Express lane**: pre-funded demo contracts (authorizations created by the team, refreshed weekly) + "Run in 90 seconds" path; clearly labeled "pre-authorized for demo" | 4 h + weekly ops | E2+PO |
| H-2 | **Liveness to Dec 15** | P0 | Calendar smoke tests; spend caps | 1 h | PO |
| H-3 | **Video overruns/inconsistencies** | P1 | Script v4; three rehearsals; verify exported duration | 4 h | PO |
| H-4 | **Devpost text vs README vs video mismatch** | P1 | One numbers source (`/trust` files); two-person proofread | 1 h | PO |
| H-5 | **Sponsor prize focus** | P2 | Pick AG Grid (ledger), Render (hosting), APIMatic (SDK from OpenAPI); skip forced Elastic/Channel3 | 2 h | PO |

---

## 3. New improvement ideas (beyond everything proposed before)

### I-1 Evidence from real people (highest Impact-per-hour, no code)
- **5 problem interviews (15 min each):** freelancers/agency owners/small buyers. Questions: *last time you weren't paid or paid for work that missed the spec? what did it cost? how did you handle "done"? would a held payment released on objective checks change your behavior? what would stop you from using it?* Record quotes (with consent), counts, and the top objection.
- **Timing/accuracy study (5 participants):** give each 3 realistic deliverables (good/bad/borderline) and the written criteria; compare **manual review time and accuracy** vs ProofPay's time and result. Report medians and sample size; state limits.
- **One pilot contract:** a real small job between two people outside the team (sandbox money), recorded as a short case study.
- **Waitlist/interest signal (optional):** `/waitlist` with email capture and a real count (no vanity numbers).
- Put results in README, Devpost and `/trust` as an **Evidence** section.

### I-2 Open Proof Pack specification and standard-style attestations
Publish `PROOFPACK.md` (v0.1): fields, canonical JSON rules, hash/signature algorithms, verification steps. Model attestations on established supply-chain attestation conventions (an **in-toto-style statement** with the artifact digest as subject and a ProofPay predicate type, wrapped in a **DSSE-style signing envelope**; ⚠ verify current spec details before citing). Benefit: signals engineering maturity and invites others to verify.

### I-3 Reusable verifier core and CLI
Extract `packages/verifier` (pure TypeScript: canonicalization, hash chain, signature/Merkle checks) used by the server, the `/verify` page and a CLI: `npx tsx packages/verifier/cli.ts verify pack.json`. One implementation, three consumers: a clean-architecture signal.

### I-4 Contract satisfiability and sample generation ("will a valid deliverable exist?")
When a contract is compiled or edited: (1) deterministic satisfiability checks (A-12), (2) **generate one passing and one failing sample artifact** (LLM proposes, deterministic checks validate), (3) show them in the editor as "What good looks like / what fails". Buyers see what their criteria mean; sellers see them before accepting.

### I-5 Express judge lane
A "Run in 90 seconds" page: pre-funded demo contracts (authorizations created by the team and **refreshed weekly**, labeled honestly), one-click start, no PayPal login needed for the lane, the full verification and release visible, and a link to "Try it from scratch with the sandbox buyer". Operational calendar: refresh Nov 12, Nov 20, Dec 1, Dec 8, Dec 14 (authorizations last up to 29 days; honor period 3 days).

### I-6 Mutation-testing badge on the modules that must not fail
Stryker on `policy.ts`, `permissions.ts`, `transitions.ts`, `fundsSummary`. Publish "mutation score X%" with surviving mutants triaged. Rare in hackathons and a strong credibility signal for Technological Implementation.

### I-7 Fee-aware milestone advisor
Warn when a milestone is small enough that fixed per-capture fees (⚠ verify PayPal's current schedule) would dominate; suggest merging milestones. Shows real-world payments awareness.

### I-8 Buyer "what-if" simulator
In the editor: paste a sample deliverable and see how the checks would judge it (deterministic + optional AI), without creating a contract. Great for adoption and a strong live demo.

### I-9 Two-sided reputation
Seller: verified-delivery rate, first-pass rate, attempts per milestone. Buyer: **funding follow-through** (approved holds / invitations), average review time, escalation response time. Counts first, scores second, with sample-size caveats.

### I-10 ProofPay-Bench (public adversarial dataset)
Publish the labeled eval/red-team corpus (JSONL) with a README and the scoring script so others can test their verifiers; include attack families and a leaderboard table (yours only). Dataset ownership is a differentiator.

### I-11 Responsible disclosure
`SECURITY.md` and `/.well-known/security.txt`, a clear contact and policy (even if "no bounty yet").

### I-12 Multilingual deliverables
Add Hindi/Telugu/Spanish cases to eval and red team (including multilingual injections). Relevant to your audience; exposes real weaknesses early.

### I-13 Policy-as-code view
Render the acceptance policy (`decide()` rules in order) as a readable table in docs and on `/how-it-works`, generated from the same constants the code uses (no drift).

### I-14 Integrations that cost little
Webhook recipes (Slack, Zapier-style generic webhook, GitHub Actions snippet) in `/docs`; SDK generated from OpenAPI (APIMatic if you pursue that sponsor prize).

### I-15 Cost transparency
Per-verification cost, tokens, latency on reports and a cost chart on `/trust` (from `llm_calls`). Credible unit-economics signal.

---

## 4. Prioritized top 30 (impact × effort; do in this order)

| Rank | Item | Why | Effort | Owner | When |
|---|---|---|---|---|---|
| 1 | M-10 / AIP-12 auto-release eligibility | P0 exploit | 3 h | E2 (+E1) | Nov 3–4 |
| 2 | A-2 context injection fix | P0 exploit | 4 h | E2 | Nov 3–4 |
| 3 | M-1 / P-5 / U-copy fixes (secured, 0% fee) | P0 credibility | 2 h | PO | Nov 3 |
| 4 | `self-audit.sh` run + fixes | finds inherited flaws | 2 h | both | Nov 3 |
| 5 | I-1 interviews + timing study | Impact evidence | 6 h | PO | Nov 3–6 |
| 6 | PLAT-3 step-up auth | security depth | 6 h | E1 | Nov 4 |
| 7 | M-7/M-8 return `state` + funding attempt key | money-adjacent bugs | 4 h | E1 | Nov 4 |
| 8 | PLAT-1 safeFetch + PLAT-2 CI gates | security baseline | 7 h | E1 | Nov 3 |
| 9 | AIP-1 eval evidence gate | AI change control | 6 h | E2 | Nov 3 |
| 10 | A-1 expand eval + external red team | credibility | 6 h | E2+PO | Nov 4–7 |
| 11 | H-1 / I-5 express lane | judge friction | 4 h | E2+PO | Nov 5–6 |
| 12 | AIP-2/3 fix hints + AI transparency UI | design + trust | 8 h | E2 | Nov 4–5 |
| 13 | S-4 durable rate limits + S-5 nonce CSP | security basics | 6 h | E1 | Nov 5 |
| 14 | PLAT-4 API-key hardening | security | 5 h | E1 | Nov 5 |
| 15 | A-12 / I-4 satisfiability + samples | product + AI | 4–6 h | E2 | Nov 6 |
| 16 | A-6 junk detector | AI robustness | 3 h | E2 | Nov 6 |
| 17 | AIP-5 canary + breaker | AI ops | 6 h | E2 | Nov 6–7 |
| 18 | PLAT-5 RLS (flagged) | isolation | 10 h | E1 | Nov 6–7 |
| 19 | S-6 email abuse + S-7/S-8 links/redirects | security | 5 h | E1 | Nov 7 |
| 20 | I-6 mutation score | credibility | 3 h | E1 | Nov 7 |
| 21 | T-4 two-org E2E | quality | 4 h | E2 | Nov 7 |
| 22 | PLAT-6 + AIP-6 Security Center | visible polish | 8 h | E1+E2 | Nov 6–8 |
| 23 | D-1 doc consolidation | clarity | 3 h | PO | Nov 8 |
| 24 | I-2/I-3 Proof Pack spec + verifier package | innovation | 4 h | E1/E2 | Nov 8 |
| 25 | I-10 ProofPack-Bench dataset | innovation | 2 h | E2 | Nov 8 |
| 26 | M-6 self-dealing rule (risk) | real-product depth | 3 h | E1 | Nov 8 |
| 27 | U-1/U-5 page quality matrix + IA cleanup | design | 6 h | E2 | Nov 8 |
| 28 | H-3 video rehearsals ×3 | presentation | 4 h | PO | Nov 8–10 |
| 29 | H-4 numbers source + proofread | presentation | 1 h | PO | Nov 10 |
| 30 | O-2/T-1 backup drill + PayPal contract tests | reliability | 4 h | E1 | Nov 9 |

---

## 5. Re-plan for 2 engineers (adjusts `02-ISSUE-BOARD-AND-ASSIGNMENT.md`)

The audit adds **P0/P1 fixes that outrank some earlier "Should" tickets**. Apply these swaps:

**Add (new tickets)**
- **PLAT-10** Return-URL `state` binding + funding-attempt idempotency key + `DEMO_TIME_SCALE` guard (M-7, M-8, M-11) — 4 h, Must, **both review** (money-adjacent).
- **PLAT-11** Durable rate limits + nonce CSP (S-4, S-5) — 6 h, Must.
- **PLAT-12** Email abuse controls + link/redirect hardening (S-6, S-7, S-8) — 4 h, Must.
- **AIP-10** Context injection fix + structure/obfuscation scanning (A-2, A-3, A-4) — 6 h, Must.
- **AIP-11** Satisfiability linter + junk detector (A-12, A-6) — 6 h, Must.
- **AIP-12** Auto-release eligibility (M-10) — 3 h, Must, **both + PO review**.
- **AIP-13** Express judge lane (H-1/I-5) — 4 h, Must (with PO).

**Demote to Could** (to make room): PLAT-7 (webhook v2 beyond SSRF guard), PLAT-8 (risk engine, except the self-dealing rule if time), AIP-7 receipts, AIP-8 ICS, AIP-9 digest. **Keep** PLAT-5 RLS behind a flag with the Nov 7 decision rule.

**Resulting Must lists**
- **E1 (≈ 47 h):** PLAT-1 (4), PLAT-2 (3), PLAT-3 (6), PLAT-4 (5), PLAT-10 (4), PLAT-11 (6), PLAT-12 (4), PLAT-5 (10, flagged), PLAT-6 (3), PLAT-9 docs (2). If over capacity, cut PLAT-12 → PLAT-9 → run PLAT-5 as "ship disabled".
- **E2 (≈ 46 h):** AIP-1 (6), AIP-2 (4), AIP-3 (4), AIP-10 (6), AIP-11 (6), AIP-12 (3), AIP-13 (4), AIP-5 (6), AIP-6 (5), AIP-4 (6, Should). If over capacity, cut AIP-4 → AIP-6 polish.
- **PO (you):** interviews + study (6 h), copy/pricing fixes (2 h), doc consolidation (3 h), evidence section, video/Devpost (8 h), express-lane operations (1 h/week), PayPal partner application research (2 h), recruit 3 external red-teamers (2 h).

*(The detailed tickets are in `03-ENGINEER-1-SPEC-PLATFORM-SECURITY.md` and `04-ENGINEER-2-SPEC-AI-PRODUCT.md`.)*

---

## 6. Stop doing / cut (reduce attack surface and risk)

- Hide or delete **stub pages and endpoints** (e.g., the Elastic "sync connector", chaos endpoint outside `CHAOS_MODE`).
- **No new pages** except `/trust`, `/verify`, `/status` and the express lane.
- **No additional LLM providers**, no blockchain anchoring, no real payouts, no multi-currency, no custom roles.
- **No claims without evidence files.**

---

## 7. Measurement: the scorecard before freeze (Nov 9)

| Area | Metric | Target | Source |
|---|---|---|---|
| Safety | False passes on non-pass cases (dev + held-out + external) | 0 | `docs/eval-results.md` |
| Adversarial | Red-team attack success rate | 0 passes | red-team report |
| Auto-release | Farming test (ambiguous content + silent buyer) | never releases | test |
| Isolation | RLS cross-tenant test | 0 rows leaked | `tests/security` |
| Money | Duplicate captures across chaos runs | 0 in N runs | `docs/chaos-results.md` |
| Auth | Sensitive actions require step-up | 100% of listed actions | tests |
| Quality | Mutation score on policy/permissions/transitions | ≥ 80% (state honestly) | Stryker report |
| Evidence | Interviews / study participants | ≥ 5 / ≥ 5 | README |
| UX | axe serious/critical issues | 0 on 8 pages | CI |
| Judge lane | Time from landing to first verified release | ≤ 90 s | stopwatch |
| Docs | Contradictions between docs | 0 (index + glossary) | review |

---

## 8. Appendix — protocols and templates

### Interview script (15 minutes)
1. Tell me about the last time you hired/were hired for a digital deliverable. 2. What happened with payment? 3. How did you define "done"? 4. What did a dispute or delay cost you? 5. Show the contract + criteria screen: *what is unclear?* 6. Would you use a held payment released on objective checks? What would stop you? 7. What price feels fair? (Do not quote a price; ask.) Capture quotes, role, company size, and consent.

### Timing study protocol
5 participants × 3 deliverables (good / flawed / borderline) with written criteria. Measure: manual review time and decision correctness; then ProofPay time-to-decision and correctness. Report **median time, accuracy, n**, and caveats (small sample, synthetic deliverables). Do not extrapolate.

### Doc consolidation layout
```
docs/SPEC.md            ← index + glossary (status names, roles, routes) + "supersedes" table
docs/spec/*             ← engineering specs (generated parts: API from OpenAPI, tables from schema)
docs/product/*          ← product docs
docs/plan/*             ← phase runbooks (archived after completion)
docs/security/*  docs/ai/*  docs/evidence/*
docs/decision-log.md    CHANGELOG.md
```

### Self-audit script
`scripts/self-audit.sh` (included): run from the repo root. It flags: `dangerouslySetInnerHTML`, weak CSP, routes without `permission`, state-changing GET handlers, host-header URL building, in-memory rate limiting, secrets in logs, `Math.random` for tokens, `eval`/`new Function`, `child_process`, raw `fetch` outside `safeFetch`, `localStorage` tokens, inconsistent status names, forbidden copy, `db.` use in routes, capture/void/refund imports outside `release/`, tracked `.env`, `NEXT_PUBLIC_` secrets, TODO/FIXME counts. Exit code 1 if any P0/P1 pattern is found.
