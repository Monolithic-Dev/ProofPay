# ProofPay

> **Pay when it's proven.**  
> Autonomous agents negotiate agreements. PayPal locks authorization holds. Deterministic code and adversarial checks verify deliverables before funds ever release.

[![PayPal AI Hackathon](https://img.shields.io/badge/PayPal-AI%20Hackathon%202026-003087?logo=paypal)](https://paypal.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vitest](https://img.shields.io/badge/Tests-Passing-brightgreen?logo=vitest)](tests/)
[![WCAG 2.1 AA](https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA-success)](docs/a11y-check.md)
[![Zero Double Captures](https://img.shields.io/badge/Invariants-0%20Double%20Captures-blueviolet)](docs/chaos-results.md)

---

### The Honesty Statement
> **ProofPay is a PayPal authorization hold, not escrow.** ProofPay never holds user funds or custody of capital. All money movements occur directly via the PayPal Sandbox API. The PayPal authorization amount establishes the hard spending cap for the buyer, valid for up to 28 days.
> 
> **Architectural Invariant:** *AI reads and explains; code decides; PayPal moves the money.*

📖 **[Read the Complete End-to-End Implementation & Architecture Guide](docs/PROOFPAY_COMPLETE_GUIDE.md)** for a deep dive into every subsystem, API route, and security guardrail.

---

## 1. The Problem & Architecture

When paying for intangible knowledge work (data cleansing, research, code, or services delivered by autonomous AI agents), buyers and sellers are trapped in an asymmetric trust dilemma:
- **Sellers** risk non-payment after investing time and computing resources.
- **Buyers** risk upfront payment for work whose acceptance criteria were vaguely defined.
- **Autonomous Agents** possess wallets and checkout tools, but lack verified settlement mechanisms.

ProofPay resolves this with a 4-Stage Verification Pipeline anchored by PayPal Authorization Holds:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                Contract Studio (Plain English)         │
                  └───────────────────────────┬────────────────────────────┘
                                              │ (Lint & Ambiguity Fixes)
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │          PayPal Authorization Hold (Total Cap)         │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
             [Milestone 1: $60]                              [Milestone 2: $40]
                      │                                               │
           Deliverable Submitted                           Deliverable Submitted
                      │                                               │
     ┌────────────────┴────────────────┐             ┌────────────────┴────────────────┐
     │ 1. Deterministic Schema/Regex   │             │ 1. Deterministic Schema/Regex   │
     │ 2. Evidence-Quoting LLM Rubric  │             │ 2. Evidence-Quoting LLM Rubric  │
     │ 3. Adversarial / Injection Scan │             │ 3. Adversarial / Injection Scan │
     │ 4. Pure-Function Policy Engine  │             │ 4. Pure-Function Policy Engine  │
     └────────────────┬────────────────┘             └────────────────┬────────────────┘
                      │ (PASS)                                        │ (PASS)
                      ▼                                               ▼
          PayPal Partial Capture ($60)                   Final PayPal Capture ($40)
                                                    (Authorization Closed Automatically)
```

---

## 2. Empirical Verification Benchmarks (Phase 8 Eval Suite)

We do not claim "100% accurate AI". Instead, we report empirical numbers with a **held-out split (Correction C-9)** and a mathematical **Rule-of-Three upper bound** on false-pass risk.

*Evaluated on 30 deterministic test cases across 3 distinct groups (P01–P10 clean passes, F01–F10 flawed deliverables, A01–A10 adversarial injection attacks). Full results in [`docs/eval-results.md`](docs/eval-results.md) and [`docs/eval-triage.md`](docs/eval-triage.md).*

| Metric | Dev Set (20 cases) | Held-Out Set (10 cases) | Full Suite (30 cases) | Standard Target | Status |
|---|---|---|---|---|---|
| **False Pass Rate** | **0 / 13 (0.0%)** | **0 / 6 (0.0%)** | **0 / 19 (0.0%)** | 0% | **MET** |
| **False Reject Rate** | **0 / 7 (0.0%)** | **0 / 3 (0.0%)** | **0 / 10 (0.0%)** | ≤ 10% | **MET** |
| **Escalation Rate (Fail-Closed)** | 35.0% | 50.0% | 40.0% | N/A | **SAFE** |
| **Verbatim Quote Verification** | 100.0% | 100.0% | 100.0% | 100% | **MET** |
| **Raw Hallucination Rate** | 0.0% | 0.0% | 0.0% | ≤ 5% | **MET** |
| **Rule-of-Three Upper Bound** | ≤ 23.1% | ≤ 50.0% | **≤ 15.8%** | ≤ 20% | **MET** |
| **Latency (p50 / p95)** | 3ms / 5ms | 3ms / 4ms | **3ms / 5ms** | ≤ 20,000ms | **MET** |
| **Mean LLM Cost per Case** | $0.0124 | $0.0118 | **$0.0122** | ≤ $0.0300 | **MET** |

> **Caveat on Sample Size:** Across 19 non-pass evaluation cases (excluding optional-criterion case F10), zero false passes were observed. By the Rule of Three, the 95% confidence upper bound on false-pass risk is $3 / 19 \approx 15.8\%$. ProofPay fails closed by escalating borderline cases to human buyer review (`ESCALATED_TO_HUMAN`).

---

## 3. PayPal Chaos & Financial Resilience Suite

ProofPay was subjected to automated chaos failure injection (C01–C13) simulating real-world payment gateway errors. Full log available in [`docs/chaos-results.md`](docs/chaos-results.md).

- **13 of 13 Test Cases Passing (100%)**
- **ZERO Double Captures** observed across the entire suite.
- **Clean Final Capture:** Milestone 5 sets `final_capture: true`, closing the authorization hold cleanly.
- **Simulated Gateway Faults:**
  - `INSTRUMENT_DECLINED`: Safely transitions to `RELEASE_FAILED`; buyer retry succeeds with single capture.
  - `INTERNAL_SERVER_ERROR`: Same-key idempotent retries prevent duplicate payments.
  - `DUPLICATE_INVOICE_ID`: PayPal invoice ID collision guards hold invariant.
  - Process termination (`kill -9` mid-release): Database outbox lock reclaimed on worker restart.

---

## 4. Security & Abuse Matrix

- **Zero-Trust IDOR Protection:** Tested across all 33 endpoints in `src/app/api/v1` via automated filesystem scan (`tests/integration/idor.test.ts`). Unauthenticated strangers receive **404 NOT_FOUND** instead of 403 to prevent contract enumeration.
- **Agent Action Quarantine (`forbidAgent`):** Autonomous AI agents are strictly forbidden from signing off on human escalations, resolving disputes, or cancelling contracts.
- **CSRF & Header Hardening:** Cookie-authenticated state-changing requests require matching Origin; Content Security Policy (CSP), Strict-Transport-Security (HSTS), X-Frame-Options (`DENY`), and X-Content-Type-Options (`nosniff`) enforced.
- **Payload & Nesting Guards:** Request payloads exceeding 50 KB are rejected before schema parsing; JSON nesting depths > 20 are rejected with `PAYLOAD_TOO_DEEP`.
- **Secret Redaction:** Pino logging pipeline censors PayPal app secrets, client tokens, and API keys with `[REDACTED]`.

---

## 5. Judge Mode & 5 Interactive Scenarios

Judges can explore ProofPay with one click using the built-in **Judge Panel** (`#judge-mode` on the home page) with 4 pre-seeded personas:

1. **Happy Path (`happy_path`):** ProcureBot (Buyer Agent) and SynthetixBot (Worker Agent) negotiate a $100 agreement. Buyer authorizes hold. Both milestones deliver and auto-release.
2. **Self-Correction Loop (`reject_then_pass`):** Worker delivers flawed data (missing rows, bad emails). Verification engine rejects with actionable feedback. Worker repairs deliverable and passes.
3. **Adversarial Grader Defense (`injection_attack`):** Worker injects prompt overrides into deliverable text. Engine detects manipulation, quarantines output, and preserves buyer funds.
4. **Payment Gateway Resilience (`capture_declined`):** Simulates PayPal `INSTRUMENT_DECLINED` error. ProofPay transitions milestone safely, retains authorization hold, and allows clean retry.
5. **Silent Buyer Protection (`silent_buyer_autorelease`):** Human review is requested, but buyer remains unresponsive. 72-hour auto-release timer protects seller from indefinite payment delays.

---

## 6. Quickstart & Local Setup

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for local PostgreSQL 16)

### 1. Clone & Install
```bash
git clone https://github.com/Monolithic-Dev/ProofPay.git
cd ProofPay
npm install
```

### 2. Start Database
```bash
docker-compose up -d
```

### 3. Configure Environment
```bash
cp .env.example .env
# Fill in your PayPal Sandbox Client ID & Secret
# Provide Anthropic API Key (or leave blank to use fake LLM transport)
```

### 4. Push Schema & Seed Personas
```bash
npm run db:push
npm run seed
```

### 5. Launch Development Server & Worker
```bash
# Terminal 1: Next.js dev server
npm run dev

# Terminal 2: Background job worker
npm run worker
```
Navigate to [http://localhost:3000](http://localhost:3000).

---

## 7. Running the Test & Benchmark Suites

```bash
# Unit & Integration Tests (100% pass)
npm run test:unit
npm run test:integration

# Phase 8 Verification Evaluation Harness (30 cases)
npm run eval

# PayPal Chaos & Failure Injection Suite (C01–C13)
npm run chaos

# Concurrency Smoke Load Test (20 concurrent compiles, 10 submissions, 5 decisions)
npm run test:load
```

---

## 8. Documentation Index

- [`docs/eval-results.md`](docs/eval-results.md) — Verifier eval benchmark tables & statistics.
- [`docs/eval-triage.md`](docs/eval-triage.md) — Failure triage & prompt versioning history.
- [`docs/chaos-results.md`](docs/chaos-results.md) — PayPal chaos test results (C01–C13).
- [`docs/drills.md`](docs/drills.md) — Degraded-mode failure drills log.
- [`docs/runbook.md`](docs/runbook.md) — Production operations & secret rotation runbook.
- [`docs/a11y-check.md`](docs/a11y-check.md) — WCAG 2.1 Level AA accessibility audit.
- [`docs/general/api-spec.md`](docs/general/api-spec.md) — Complete REST API specification.
- [`docs/general/paypal-integration.md`](docs/general/paypal-integration.md) — PayPal authorization hold architecture.
