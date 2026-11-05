# 01 — New Features: Security, AI Assurance & Product (Sprint Scope for a 2-Person Team)

> **Assumptions:** everything in the earlier plans is implemented (core money path, verification, orgs/RBAC, MCP, scenarios, and the "winning plan" levers). Team = **2 engineers**, each using a coding agent. Today **Tue Nov 3, 2026**; **feature freeze Nov 9 23:59 IST**; record Nov 10; submit Nov 11 by 18:00 IST. Capacity ≈ 2 × 6 days × 7 h ≈ **84 h**, of which ~15% is review/fix overhead, so plan ≈ **70 h** of tickets.
> **Rule for everything here:** never change `src/server/release/**` or the policy engine's decision logic. New work wraps, protects, measures, or presents the existing engine.

---

## 1. What "a proper, secure software product" means (the bar judges and customers apply)

| Principle | Meaning in ProofPay | Evidence you can show |
|---|---|---|
| **Defense in depth** | App-level authorization **plus** database-level tenant isolation **plus** crypto for secrets | RLS tests; permission matrix tests; encryption tests |
| **Fail closed** | Missing context means *no access*, not full access | "No org context returns 0 rows" test |
| **Least privilege** | Agents have scoped keys; sensitive actions need fresh authentication | Step-up tests; scope tests |
| **Assume breach of a component** | A leaked API key, SSRF attempt, or compromised dependency has limited blast radius | IP allowlists, SSRF-safe fetch, SBOM + audit gates |
| **Reproducible AI** | Any decision can be replayed and every prompt change is evidence-gated | Eval gate in CI; replay command |
| **Observable** | Every request/job/PayPal call/LLM call is traceable and measured | Metrics endpoint; request-id propagation |
| **Honest** | Claims map to tests; limits are published | Trust Center, ASVS mapping |

---

## 2. Idea catalog (new ideas only; scored)

Scoring: Value to a real customer / judge (1–5), Effort in hours (h), Risk (L/M/H). "Judging" shows the criteria it strengthens: **T**ech, **D**esign, **I**mpact, **N**ovelty, **P**resentation.

### Pillar A — Security & platform

| ID | Idea | What it is | Value | Effort | Risk | Judging |
|---|---|---|---|---|---|---|
| S1 | **Postgres Row-Level Security** (tenant isolation) | Database enforces "you only see your org's rows" even if app code has a bug | 5 | 10 h | M | T, I |
| S2 | **Step-up authentication** | Re-enter password/TOTP before money or access-changing actions (fund, approve, refund, create keys, change roles) | 5 | 6 h | L | T, D, I |
| S3 | **Passkeys (WebAuthn)** | Phishing-resistant login | 3 | 5 h | M (library support) | D, I |
| S4 | **API key hardening** | HMAC-peppered hashes, expiry, IP allowlist (CIDR), rotation with grace, per-key rate limit, new-IP alert | 4 | 5 h | L | T, I |
| S5 | **Webhook security v2** | Timestamped HMAC signature, replay window, secret rotation, SSRF guard, auto-disable, manual replay | 4 | 5 h | L | T |
| S6 | **Central SSRF-safe HTTP client** | One `safeFetch()` for any outbound call (webhooks, link checks, oracles): IP allow/deny, DNS pinning, redirect re-validation | 5 | 4 h | L | T |
| S7 | **Envelope encryption for sensitive fields** | AES-256-GCM with key ids and rotation for webhook secrets, hidden tests, notes | 4 | 5 h | M | T |
| S8 | **Risk engine (abuse/anomaly rules)** | Velocity, new-account high-value funding, new-device sign-in → allow / step-up / block-send (never touches capture) | 4 | 7 h | M | T, I, N |
| S9 | **Security Center** (org posture) | MFA adoption, stale sessions, old API keys, pending invites, risk events, recommendations, 0–100 score | 5 | 3 h API + 5 h UI | L | D, I, P |
| S10 | **CI security gates & supply chain** | CodeQL, Dependabot, `npm audit`, gitleaks, SBOM (CycloneDX), license check, pinned actions | 4 | 3 h | L | T |
| S11 | **Observability** | Request-id propagation to jobs, `/metrics` (staff-only), dashboards doc | 3 | 5 h | L | T |
| S12 | **Security docs** | STRIDE threat model, ASVS L1 mapping with test evidence, `SECURITY.md`, `security.txt` | 4 | 3 h | L | T, P |
| S13 | **Deliverable hardening** | Reject archives/zip bombs, CSV formula-injection-safe exports, `nosniff` + `attachment` downloads | 3 | 2 h | L | T |
| S14 | **Load test & perf budget** | k6 scenarios, p95 targets, index fixes | 3 | 4 h | L | T |

### Pillar B — AI assurance (making the AI auditable like software)

| ID | Idea | What it is | Value | Effort | Risk | Judging |
|---|---|---|---|---|---|---|
| A1 | **Calibrated confidence & abstention** | Measure confidence vs correctness on the eval set; set thresholds from data; publish a calibration table | 4 | 6 h | L | T, N |
| A2 | **Eval evidence gate in CI** | Prompt/model changes must come with fresh eval results (hash-matched) or CI fails | 5 | 5 h | L | T, N |
| A3 | **Drift canary + provider circuit breaker** | Nightly canary on live models; breaker switches to safe degraded mode on failures | 5 | 6 h | M | T, N |
| A4 | **Deterministic replay** | Re-run any verification from stored inputs to confirm the same decision | 4 | 5 h | L | T, N |
| A5 | **Fix hints (counterfactuals)** | Every rejection says the *minimal* fix ("Add 3 rows", "Shorten by 24 words") | 5 | 4 h | L | D, I |
| A6 | **AI transparency UI** | Badges "Rule" vs "AI-assisted", AI-reliance meter, model/prompt/cost/redactions footer | 4 | 4 h | L | D, P |
| A7 | **Audit sampling** | 10% of auto-passes are queued for human audit; agreement rate published | 4 | 6 h | M | T, I |
| A8 | **Per-org LLM cost guardrails** | Budgets and alerts per org; cost shown in reports | 3 | 3 h | L | T |
| A9 | **Verification "second look"** | Buyer can request a consensus re-check on an escalated item | 3 | 4 h | M | D |
| A10 | **Prompt registry** | Hashes, versions, owners, change log (supports A2) | 3 | 2 h | L | T |

### Pillar C — Product completeness

| ID | Idea | What it is | Value | Effort | Risk | Judging |
|---|---|---|---|---|---|---|
| P1 | **Receipts (PDF)** | Per capture: receipt number, PayPal capture id, contract hash, sandbox watermark | 4 | 3 h | L | D, I |
| P2 | **Calendar export (.ics)** | Milestone due dates, hold expiry, auto-release times; per-user secret URL | 4 | 2 h | L | D, I |
| P3 | **SLA reminders + daily digest** | Reminders at 50%/90% of windows; digest of what needs attention | 4 | 4 h | L | D, I |
| P4 | **Global search (⌘K)** | Contracts, counterparties, templates | 3 | 4 h | L | D |
| P5 | **Onboarding tour** | First-run coachmarks | 3 | 3 h | L | D, P |
| P6 | **Contract amendments (lite)** | Mutual-consent changes that don't increase money | 4 | 8 h | M | I, N |
| P7 | **Internal dispute center (lite)** | Seller contests a rejection; buyer must respond in 48 h or it escalates; no money actions | 4 | 8 h | M | I |
| P8 | **Status page** | Public `/status` from health + canary | 3 | 2 h | L | T, P |
| P9 | **Bulk counterparty import (CSV)** | With CSV-injection-safe handling | 2 | 3 h | L | D |
| P10 | **Activity feed** | Unified timeline per org | 2 | 4 h | L | D |

---

## 3. Selected scope (what we will actually do in 6 days)

Selection rule: highest *(value × demonstrability)* per hour, no money-path changes, and a balanced story for **security**, **AI assurance**, and **product**.

### Engineer 1 — Platform & Security (≈ 44 h)
| Priority | Ticket | Hours |
|---|---|---|
| Must | **S6** SSRF-safe HTTP client | 4 |
| Must | **S10** CI security gates | 3 |
| Must | **S2** Step-up authentication | 6 |
| Must | **S4** API key hardening | 5 |
| Must | **S1** Row-Level Security | 10 |
| Must | **S9** Security Center API | 3 |
| Should | **S5** Webhook security v2 | 5 |
| Should | **S8** Risk engine (3 rules) | 5 |
| Should | **S12** Security docs (STRIDE + ASVS L1) | 3 |
| Could | S7, S11, S13, S14, S3 | backlog |

### Engineer 2 — AI Assurance & Product (≈ 40 h)
| Priority | Ticket | Hours |
|---|---|---|
| Must | **A2 + A10** Eval evidence gate + prompt registry | 6 |
| Must | **A5** Fix hints | 4 |
| Must | **A6** AI transparency UI | 4 |
| Must | **A1** Calibration & abstention | 6 |
| Must | **A3** Drift canary + circuit breaker | 6 |
| Must | **Security Center UI** (UI of S9) | 5 |
| Should | **P1** Receipts PDF | 3 |
| Should | **P2** Calendar export | 2 |
| Should | **P3** SLA reminders + digest | 4 |
| Could | A4, A7, A8, A9, P4–P10 | backlog |

**Cut lines (if behind, cut from the bottom of each list):** Engineer 1: S12 → S8 → S5 → S1 (S1 is the riskiest; if not stable by Nov 7 evening, ship it **disabled by flag** with tests and docs). Engineer 2: P3 → P2 → P1 → A3 (keep canary, drop breaker automation).

---

## 4. Security architecture (what the sprint produces)

```
Internet
  │  TLS, security headers, CSP, rate limits (per IP / per key / per account)
  ▼
Edge & app layer ── authentication (sessions, MFA, step-up) ── authorization (permission matrix, scopes, side-aware)
  │                                     │
  │ safeFetch (SSRF guard) for any outbound call
  ▼
Data layer ── Postgres RLS (tenant isolation, fail-closed) ── envelope-encrypted secrets ── append-only ledger/audit
  │
Detection ── risk engine (abuse rules) ── audit log ── metrics ── Security Center
Supply chain ── CodeQL · Dependabot · npm audit · gitleaks · SBOM · pinned CI actions
```

**STRIDE summary (condensed; full table is ticket S12):**

| Threat | Example | Control(s) |
|---|---|---|
| Spoofing | Stolen session, leaked API key | MFA, step-up, key expiry/IP allowlist/rotation, new-device alerts |
| Tampering | Altered ledger or deliverable | Hash chain + signatures, immutability triggers, input hashes |
| Repudiation | "I never approved that" | Audit log with request ids, step-up events, approval records |
| Information disclosure | Cross-tenant read, SSRF to metadata, secrets in logs | RLS + permission tests, `safeFetch`, encryption, log redaction |
| Denial of service | LLM cost abuse, huge payloads | Rate limits, budgets, size/depth caps, circuit breaker |
| Elevation of privilege | Member performing finance actions; agent approving | Role matrix, scopes, `forbidAgent`, step-up, RLS |

---

## 5. AI assurance program (what the sprint produces)

1. **Change control:** prompts are hashed and registered; CI fails when a prompt/model/policy change lacks matching eval evidence.
2. **Measurement:** calibration table (confidence vs accuracy), false-pass/false-reject counts, red-team score (if built earlier), audit agreement (if built).
3. **Operations:** nightly canary on live providers; circuit breaker moves to degraded mode (escalate) when providers misbehave.
4. **Explainability:** each rejection lists minimal fixes; each report labels Rule vs AI-assisted and shows model, prompt version, tokens, cost, and redactions.
5. **Reproducibility (backlog A4):** replay any verification from stored inputs.

**Rule:** the AI never gains authority. These features *measure and constrain* it.

---

## 6. Evidence artifacts to produce (all linked from `/trust` and the README)

| Artifact | From ticket | Shows |
|---|---|---|
| `docs/security/threat-model.md`, `asvs-l1-mapping.md` | S12 | Controls mapped to tests |
| `tests/security/rls.test.ts` output | S1 | Cross-tenant isolation proven at the database layer |
| `docs/calibration.md` | A1 | Confidence vs accuracy bins |
| `docs/eval-results.md` with prompt-hash header | A2 | Evidence gate and results |
| `canary_runs` summary on `/status` and `/trust` | A3 | Last canary result and breaker state |
| `sbom.json` (CI artifact), CodeQL/Dependabot badges | S10 | Supply-chain posture |
| Security Center screenshot | S9/A11 | Org posture score and recommendations |

---

## 7. Claims policy additions (keep it honest)

- Say "**database-enforced tenant isolation (row-level security)**" only after the RLS tests pass in CI.
- Say "**step-up authentication for money-related actions**" and list the actions.
- Say "**evidence-gated prompt changes**", not "guaranteed accuracy".
- Say "**nightly canary**" with the last result and time; never "always correct".
- Never claim SOC 2, ISO 27001, PCI, or "bank-grade". You can say "**mapped to OWASP ASVS Level 1 controls**" once the mapping file exists, with its status column honest (Implemented / Partial / Planned).

---

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| RLS breaks queries or performance | High | Feature flag `RLS_ENFORCE`; run full suite in both modes; start with low-risk tables; keep `withSystemTx` for worker/public flows with lint-restricted imports; timebox 10 h with an explicit fallback (ship disabled + tests) |
| Step-up UX breaks flows | Med | Backend returns a typed error; one shared dialog retries the original request; flag `STEP_UP_ENFORCE` |
| Provider canary costs/flakiness | Low | 12 fixed cases, temperature 0, nightly only, budget cap |
| Two engineers collide on shared files | Med | Contract-first Day-1 pairing (types/schemas), CODEOWNERS, small PRs, cross-review |
| Scope creep | High | Cut lines in §3; anything not in the board is rejected until Nov 11 |

---

## 9. After the hackathon (backlog, not now)

Passkeys (S3), envelope encryption rollout (S7), observability (S11), load tests (S14), audit sampling (A7), replay (A4), amendments (P6), dispute center (P7), SSO/SAML, SOC 2 readiness, penetration test by a third party, bug-bounty page.
