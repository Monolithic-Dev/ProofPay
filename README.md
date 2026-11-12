<p align="center">
  <img src="assets/banner.svg" alt="ProofPay — Pay when it's proven" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/Monolithic-Dev/ProofPay/actions/workflows/ci.yml"><img src="https://img.shields.io/badge/CI-Passing-10b981?style=for-the-badge&logo=githubactions&logoColor=white" alt="CI Status" /></a>
  <a href="https://github.com/Monolithic-Dev/ProofPay/actions/workflows/security.yml"><img src="https://img.shields.io/badge/Security_Gates-SBOM_%7C_CodeQL_%7C_Gitleaks-0284c7?style=for-the-badge&logo=securityscorecard&logoColor=white" alt="Security Gates" /></a>
  <img src="https://img.shields.io/badge/Unit_Tests-425_Passed_(63_Suites)-10b981?style=for-the-badge&logo=vitest&logoColor=white" alt="Unit Tests" />
  <img src="https://img.shields.io/badge/PayPal_API-v2_Authorization_Holds-003087?style=for-the-badge&logo=paypal&logoColor=white" alt="PayPal v2 Authorization Holds" />
  <img src="https://img.shields.io/badge/Audit_&_Compliance-RFC_3161_%7C_1099--K-475569?style=for-the-badge&logo=postgresql&logoColor=white" alt="Audit and Compliance" />
</p>

<p align="center">
  <strong>Zero-custody, milestone-gated settlement for digital deliverables and autonomous agent workflows.</strong><br/>
  PayPal V2 Authorization Holds (Not Escrow) · Deterministic + Dual-LLM Verification · Tamper-Evident ProofPacks
</p>

---

## Table of Contents

- [Overview & Honest Settlement Model](#overview--honest-settlement-model)
- [System Architecture](#system-architecture)
- [End-to-End Payment & Verification Flow](#end-to-end-payment--verification-flow)
- [4-Stage Verification & Adversarial Defense Pipeline](#4-stage-verification--adversarial-defense-pipeline)
- [Signature Capabilities](#signature-capabilities)
- [Domain Model & PostgreSQL Schema](#domain-model--postgresql-schema)
- [Complete Feature & Route Coverage (47 Pages)](#complete-feature--route-coverage-47-pages)
- [Cloud Deployment & Multi-Language SDKs](#cloud-deployment--multi-language-sdks)
- [Verified Evaluation & Chaos Resilience Benchmarks](#verified-evaluation--chaos-resilience-benchmarks)
- [Model Context Protocol (MCP) Server](#model-context-protocol-mcp-server)
- [Enterprise Security & Multi-Tenant Architecture](#enterprise-security--multi-tenant-architecture)
- [Application Showcase](#application-showcase)
- [Technology Stack](#technology-stack)
- [Getting Started (Local Development)](#getting-started-local-development)
- [Environment Variables Reference](#environment-variables-reference)
- [Repository Layout & NPM Scripts](#repository-layout--npm-scripts)
- [CI/CD & Automated Quality Gates](#cicd--automated-quality-gates)
- [License](#license)

---

## Overview & Honest Settlement Model

Digital contractors, software teams, and autonomous AI agents routinely exchange structured datasets, code modules, and analytical reports over email or ad-hoc invoices—leaving buyers exposed to junk submissions and sellers exposed to non-payment.

**ProofPay** solves both sides of that trust gap without becoming a money transmitter or taking custody of customer funds:

1. **Contracts Become Machine-Verifiable Specifications:** Natural-language scopes compile into strict canonical JSON agreements (`contract_json`) containing integer minor-unit milestone budgets, revision caps, deterministic schema/data checks, and explicit AI rubric thresholds.
2. **Authorization Hold, Not Escrow:** ProofPay initiates a **PayPal Orders v2 (`intent: "AUTHORIZE"`, `user_action: "CONTINUE"`)** payment hold in the buyer's PayPal account (`v2/payments/authorizations`). ProofPay **never** acts as an escrow agent, never holds pooled balances, and never touches card numbers.
   - Authorizations follow standard PayPal 29-day hold lifecycle rules (with a 3-day honor period monitored by background reauthorization checks).
   - Funds are captured milestone by milestone via `POST /v2/payments/authorizations/{id}/capture`, and unspent hold amounts can be voided cleanly on cancellation or expiration.
3. **Zero-Custody Verification Before Release:** When a contractor or AI agent submits a deliverable, ProofPay runs a 4-stage pipeline (**Stage 1 Deterministic Analyzers → Stage 2 Verbatim-Evidence LLM Rubric → Stage 3 Dual-Layer Prompt Injection Shield → Stage 4 Pure Policy Engine**) before dispatching an idempotent PayPal partial capture.
4. **Independent Offline Auditability:** Every contract state transition and financial action appends to a SHA-256 hash-chained `ledger_events` log exported as **ProofPacks**—downloadable JSON + PDF dossiers verifiable offline in the browser (`/verify`) with zero trust required in ProofPay's servers.

---

## System Architecture

```mermaid
graph TD
    subgraph ClientLayer["Client & Integration Layer (47 App Pages · 73 API Routes)"]
        WebUI["Web Studio, Dashboards & Playground<br/>(Next.js 15 App Router · React 19 · AG Grid v33)"]
        MCP["MCP Server over stdio<br/>(src/mcp/server.ts · 6 Guarded Tools)"]
        REST["Versioned REST API & SSE Streams<br/>(/api/v1/* · OpenAPI · Outbound Webhooks)"]
    end

    subgraph SecurityPerimeter["Identity & Zero-Trust Perimeter"]
        Auth["Signed Session Cookies, SAML 2.0 SSO & API Keys<br/>(jose JWT · SHA-256 Constant-Time Hash · CIDR Rules)"]
        StepUp["Step-Up Authentication<br/>(600s TTL · Password / TOTP for High-Risk Actions)"]
        RLS["PostgreSQL 16 Row-Level Security<br/>(withUserTx · app.current_user_id Isolation)"]
    end

    subgraph VerificationCore["4-Stage Verification & Security Core"]
        Loophole["Adversarial Loophole Finder<br/>(Exploit Generation · Deterministic Bypass Test · RFC 6902 Patch)"]
        Stage1["Stage 1: 10 Deterministic Checks<br/>(ajv schema, row_count, unique_field, entropy, regex, csv, links)"]
        Stage2["Stage 2: LLM Rubric & Dual-Model Consensus<br/>(Anthropic Claude Sonnet/Haiku + Groq LPU · Verbatim Quote Check)"]
        Stage3["Stage 3: Prompt Injection Shield<br/>(11 Regex Classes + Zero-Width Bidi Detector + AI Audit)"]
        Stage4["Stage 4: Pure Policy Engine<br/>(Rules 1–8 Strictly Ordered · 0 I/O Side Effects)"]
    end

    subgraph SettlementLayer["Worker Outbox, PayPal Rails & Cryptographic Ledger"]
        Worker["Transactional PostgreSQL Job Queue<br/>(src/worker/index.ts · SKIP LOCKED · Auto-Release & Reconcile)"]
        PayPal["PayPal REST v2 Adapter<br/>(Authorize · Partial Capture · Void · Verified Webhooks)"]
        Ledger["Append-Only Hash-Chained Ledger & ProofPacks<br/>(SHA-256 Chain · Ed25519 KMS Signer · RFC 3161 TSA)"]
        Tax["1099-K & W-9 Compliance Tracker<br/>(Federal $5k / State $600 Thresholds & TIN Alerts)"]
    end

    WebUI --> Auth
    MCP --> REST
    REST --> Auth
    Auth --> StepUp
    StepUp --> RLS
    RLS --> Loophole
    RLS --> Stage1
    Stage1 --> Stage2
    Stage2 --> Stage3
    Stage3 --> Stage4
    Stage4 --> Worker
    Worker --> PayPal
    PayPal --> Ledger
    Worker --> Ledger
    PayPal --> Tax
```

---

## End-to-End Payment & Verification Flow

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Buyer / Organization
    actor Seller as Seller / Worker Agent
    participant App as ProofPay API & UI
    participant Verify as 4-Stage Pipeline & Policy
    participant PayPal as PayPal v2 API (Sandbox)
    participant Proof as Ledger & ProofPack™

    Buyer->>App: Compile natural-language scope into canonical contract_json
    App->>App: Run Satisfiability Lint & Loophole Finder (RFC 6902 patch fixes)
    Buyer->>App: Propose contract to Seller & request PayPal authorization
    Seller->>App: Accept contract specification (computes SHA-256 contract_hash)
    App->>PayPal: POST /v2/checkout/orders (intent: AUTHORIZE, CONTINUE)
    PayPal-->>Buyer: Buyer approves authorization hold on PayPal
    App->>PayPal: POST /v2/checkout/orders/{order_id}/authorize
    PayPal-->>Proof: Append PAYPAL_AUTHORIZED (authorization_id, auth_expires_at)

    Seller->>App: Submit deliverable for Milestone m_k (SHA-256 hashed)
    App->>Verify: Enqueue VERIFY_SUBMISSION in PostgreSQL outbox
    Verify->>Verify: Stage 1 Deterministic Checks (< 50 ms short-circuit on fail)
    Verify->>Verify: Stage 2 Rubric Evaluation + Verbatim Substring Verification
    Verify->>Verify: Stage 3 Heuristic & LLM Adversarial Injection Scan
    Verify->>Verify: Stage 4 Pure Policy Engine decide()

    alt Decision == PASS
        Verify->>Proof: Sign attestation (KMS Ed25519 + RFC 3161 TSA)
        App->>PayPal: POST /v2/payments/authorizations/{id}/capture (idempotent PayPal-Request-Id)
        PayPal-->>Seller: Settlement captured for milestone amount_minor
        Proof-->>Buyer: Seal ProofPack (JSON + PDF) & update ledger hash chain
    else Decision == REJECT
        Verify-->>Seller: Detailed per-criterion failure reasons & fix hints
    else Decision == ESCALATE
        Verify-->>Buyer: Flag for manual review / multi-agent advisory tribunal dossier
    end
```

---

## 4-Stage Verification & Adversarial Defense Pipeline

All deliverable evaluations run through [`runVerificationPipeline`](src/server/verify/pipeline.ts) with input caching keyed on `(artifactSha256, criteria, promptVersion, model)`:

| Stage | Module | Behavior & Safety Guarantees |
|---|---|---|
| **Stage 1: Deterministic Engine** | [`registry.ts`](src/server/verify/deterministic/registry.ts) | Executes up to **10 zero-cost checks** locally in `< 50 ms`: `json_schema` (AJV + formats), `row_count`, `unique_field`, `regex_field`, `word_count`, `required_keywords`, `csv_schema`, `forbidden_terms`, `link_check` (SSRF/loopback URL protection), and `junk_detector` (Shannon entropy, duplicate ratio, placeholder density). Any failed `required` check short-circuits Stage 2 to eliminate wasted LLM tokens. |
| **Stage 2: Rubric + Grounding** | [`rubric.ts`](src/server/verify/rubric.ts), [`consensus.ts`](src/server/verify/consensus.ts), [`evidence.ts`](src/server/verify/evidence.ts) | Forces structured tool calling via Anthropic (`claude-sonnet-4-5` / `claude-haiku-4-5`) and optional dual-model consensus with Groq LPU. Every claimed `"pass"` must cite **exact verbatim substrings** verified against the raw deliverable—ungrounded passes automatically downgrade to `cannot_verify`. |
| **Stage 3: Adversarial Shield** | [`adversarial.ts`](src/server/verify/adversarial.ts) | Scans for **11 injection patterns** (instruction overrides, fake system/assistant JSON turns, multilingual overrides, delimiter escapes, `[SYSTEM]` tags, base64 payloads), detects **zero-width / bidi Unicode clusters** (`>= 3` within 20 chars), and pairs heuristics with an LLM adversarial classifier. |
| **Stage 4: Pure Policy Engine** | [`policy.ts`](src/server/verify/policy.ts) | **100% pure function (zero DB, network, or LLM I/O)**. Evaluates Rules 1–8 in strict priority order: `DET_FAIL → MANIPULATION_DETECTED → RUBRIC_FAIL → HUMAN_SIGNOFF_REQUIRED → DEGRADED/ESCALATE → LOW_CONFIDENCE → ALL_PASSED`. Verified across a **5,000-case property fuzz test** guaranteeing it never returns `PASS` when any required check or injection gate fails. |

---

## Signature Capabilities

### 1. Zero-Hallucination Loophole Finder (`/demo/loophole` & `POST /api/v1/contracts/[id]/loophole-scan`)
- [`loophole-finder.ts`](src/server/contracts/loophole-finder.ts) actively red-teams contract acceptance rules **before** a buyer authorizes funds.
- Generates concrete exploit payloads tailored to the deliverable type (`repeated_rows`, `placeholder_values`, `filler_text`, `keyword_stuffing`, `shallow_variation`, `schema_only_garbage`, `internal_links`), executes **real** Stage 1 deterministic analyzers against each exploit to prove whether it bypasses the current contract, emits **RFC 6902 JSON Patch (`patch_ops`)**, and lets buyers seal every confirmed loophole in one click and re-test the exploit live.

### 2. Interactive Fault-Injection & Resilience Lab (`/demo/lab` & `POST /api/v1/demo/lab`)
- Demonstrates recovery from real distributed-payment failures without violating the core conservation law (`authorized == captured + voided + remaining`):
  - PayPal `504` / socket capture timeouts with reused `PayPal-Request-Id` idempotency keys
  - Duplicate `PAYMENT.AUTHORIZATION.CREATED` webhook replay deduplication
  - Worker process crash recovery mid-capture via `/api/v1/admin/reconcile`
  - LLM provider `503` degradation failing closed to `ESCALATE` (`VERIFIER_UNAVAILABLE`)

### 3. 90-Second Express Sandbox Lane (`/demo/express` & `src/server/demo/pool.ts`)
- Backed by the `demo_pool` PostgreSQL table using atomic `FOR UPDATE SKIP LOCKED` claims, allowing evaluators to run an end-to-end **pre-authorized hold → deliverable verification → partial PayPal capture → ProofPack export** flow in under 90 seconds without configuring personal sandbox credentials.

### 4. Tamper-Evident Hash Chains, KMS Signatures & Offline ProofPacks (`/verify`, `/transparency`, `/ledger`)
- Every ledger event computes `SHA-256(prev_hash | contract_id | seq | type | actor_type | payload_canonical | created_at)` enforced by a PostgreSQL append-only trigger (`drizzle/0001_ledger_trigger.sql`).
- [`verifyProofPack`](src/lib/proofpack/verify.ts) validates canonical contract hashes and full Merkle/hash chains offline using Web Crypto in the browser—no server calls needed.
- Pluggable [`kms-signer.ts`](src/lib/crypto/kms-signer.ts) (`local`, `aws-kms`, `gcp-kms`, `vault-hsm` interfaces) and [`rfc3161.ts`](src/lib/crypto/rfc3161.ts) ASN.1 DER timestamp authority requests sign milestone attestations and batch checkpoints (`/transparency`).

### 5. Autonomous Agent Governance & Multi-Agent Advisory Tribunal (`/demo/agent-wallet`, `/demo/tribunal`)
- **Service Accounts & Spend Policies ([`service-accounts`](src/app/api/v1/service-accounts/route.ts)):** Scope restrictions (`contracts:read`, `contracts:write`, `submissions:write`), per-contract caps (`max_contract_total_minor`), open-hold ceilings (`max_open_holds_minor`), and separation-of-duties guards (`forbidAgent` on human funding/release endpoints).
- **Advisory Dispute Tribunal (`/demo/tribunal`):** When automated verification escalates borderline evidence, three role-specialized agents (`SentinelBot` buyer advocate, `LexiBot` seller respondent, `JusticeBot` neutral reviewer) analyze git diffs, test logs, and rubrics to produce **advisory settlement recommendations for human sign-off** (never autonomous unapproved payouts).

### 6. Organization Governance & 1099-K Tax Compliance (`/settings/*`, `/app/*`)
- Multi-tenant workspaces with role-based access control (`owner`, `admin`, `finance`, `member`, `viewer`), four-eyes `funding_approvals` thresholds, counterparty directory (`/app/counterparties`), reusable templates (`/app/templates`), versioned contracts (`contract_versions`), outbound webhook signing (`/settings/webhooks`), and IRS Form 1099-K / W-9 volume tracking ([`compliance.ts`](src/server/tax/compliance.ts)) across federal (`$5,000`) and low-threshold states (`$600` in MA, VT, VA, MD; `$1,000` / 4 txns in IL) with 24% missing-TIN backup withholding alerts.

### 7. Contract Studio, Replay & Deterministic Satisfiability Linter (`/studio`, `/contracts/[id]/replay`, `/contracts/[id]/receipts/[milestoneId]`)
- Natural-language scope compiler translates plain English requirements into strict canonical `contract_json` specifications, runs deterministic satisfiability linting before proposal, tracks full chronological event replay (`/contracts/[id]/replay`), and issues cryptographic milestone settlement receipts (`/contracts/[id]/receipts/[milestoneId]`).

### 8. AG Grid Interactive Financial Audit Ledger (`/ledger`, [`LedgerGrid.tsx`](src/components/ledger/LedgerGrid.tsx))
- Built on **AG Grid Community v33**, rendering filterable, multi-column sortable contract and financial ledger trails with dynamic light/dark Quartz theme synchronization (`ag-theme-quartz` / `ag-theme-quartz-dark`), status badges, minor-unit reconciliation totals, and instant contract drill-down.

### 9. Safety Evidence, Live Health & Reconciliation Ops (`/trust`, `/status`, `/admin`)
- Public safety transparency & red-team benchmark scores at `/trust`, live database/PayPal/worker probe health at `/status`, real-time agent execution logs at `/agent-console/[runId]`, and operational payment reconciliation at `/admin`.

---

## Domain Model & PostgreSQL Schema

[`src/server/db/schema.ts`](src/server/db/schema.ts) defines **30 PostgreSQL tables** across **11 migrations** (`drizzle/0000_init.sql` – `drizzle/0010_demo_pool.sql`) with all monetary quantities stored in integer minor units (USD cents):

```mermaid
classDiagram
    class Organization {
        +UUID id
        +String slug
        +Int funding_approval_threshold_minor
        +Int default_auto_release_hours
    }

    class Contract {
        +UUID id
        +UUID buyer_id
        +UUID seller_id
        +ContractStatus status
        +JSONB contract_json
        +String contract_hash
        +Int total_minor
        +String paypal_order_id
        +String authorization_id
        +Timestamp auth_expires_at
    }

    class Milestone {
        +UUID id
        +UUID contract_id
        +String milestone_key
        +Int amount_minor
        +MilestoneStatus status
        +SmallInt revisions_used
        +String capture_id
    }

    class Verification {
        +UUID id
        +UUID submission_id
        +VerificationDecision decision
        +JSONB stage1_json
        +JSONB stage2_json
        +JSONB stage3_json
        +String manipulation_severity
    }

    class LedgerEvent {
        +UUID id
        +UUID contract_id
        +Int seq
        +String type
        +String prev_hash
        +String hash
    }

    Organization "1" --> "many" Contract : governs
    Contract "1" *-- "many" Milestone : contains
    Milestone "1" *-- "many" Verification : evaluates
    Contract "1" *-- "many" LedgerEvent : appends
```

<details>
<summary><strong>Complete List of 30 Schema Tables</strong></summary>

| Domain | Tables |
|---|---|
| **Identity & Access** | `users`, `api_keys`, `organizations`, `org_members`, `org_invitations`, `service_accounts` |
| **Contracts & Revisions** | `contracts`, `milestones`, `criteria`, `contract_versions`, `contract_comments`, `contract_invitations`, `templates`, `counterparties` |
| **Submissions & AI Verification** | `submissions`, `verifications`, `llm_calls` |
| **PayPal & Settlement Governance** | `paypal_connections`, `paypal_events`, `funding_approvals`, `disputes` |
| **Ledger, Outbox & Platform** | `ledger_events`, `jobs`, `idempotency_keys`, `kv`, `audit_events`, `notifications`, `support_tickets`, `demo_runs`, `demo_pool` |

</details>

---

## Complete Feature & Route Coverage (47 Pages)

Every route across `src/app/` is organized into focused user, agent, audit, and operational workflows:

<details>
<summary><strong>Click to expand all 47 App Router routes by module</strong></summary>

| Module | Routes & Purpose |
|---|---|
| **Public & Trust Portal** | `/` (Landing), `/how-it-works` (Interactive Architecture Guide), `/pricing` (Tiers), `/docs` (REST & SDK Reference), `/help` (Support), `/trust` (Safety & Benchmark Evidence), `/status` (System Health Probes), `/verify` (Offline ProofPack Verifier), `/transparency` (Merkle Checkpoints), `/legal/terms`, `/legal/privacy` |
| **Interactive Sandbox (`/demo/*`)** | `/demo` (Sandbox Hub), `/demo/express` (90s Pre-Authorized Pool Flow), `/demo/loophole` (Contract Exploit Red-Teamer + RFC 6902 Patch), `/demo/lab` (PayPal & LLM Fault-Injection Lab), `/demo/mcp` (Live MCP Tool & Guardrail Simulator), `/demo/tribunal` (3-Agent Advisory Dispute Tribunal), `/demo/agent-wallet` (Agent Caps & Spend Governance) |
| **Contract Lifecycle & Studio** | `/studio`, `/studio/[contractId]` (Natural-Language Contract Compiler & Rubric Editor), `/contracts` (Contracts List), `/contracts/[id]` (Detail & Actions), `/contracts/[id]/fund` (PayPal `AUTHORIZE` Flow), `/contracts/[id]/milestones/[mid]` (Deliverable Submission & 4-Stage Pipeline Report), `/contracts/[id]/ledger` (Contract Hash Chain), `/contracts/[id]/receipts/[milestoneId]` (Signed Receipt), `/contracts/[id]/replay` (Chronological Event Replay), `/invite/[token]` |
| **Workspace, Ledger & Ops** | `/app` (Executive Dashboard), `/app/payments` (PayPal Authorizations & 1099-K Compliance), `/app/counterparties` (Vendor Directory & W-9 Status), `/app/templates` (Reusable Verified Specs), `/app/developers` (API & SDK Setup), `/app/security` (Session Posture), `/ledger` (AG Grid Financial Audit Ledger), `/inbox` (Action Notifications), `/agent-console/[runId]` (Agent Trace Viewer), `/admin` (Reconciliation & Ops) |
| **Auth & Organization Settings** | `/auth/login`, `/auth/register`, `/settings` (Overview), `/settings/workspace`, `/settings/team` (RBAC Roles & Invites), `/settings/payments` (PayPal Connection & Holds), `/settings/api-keys`, `/settings/webhooks`, `/settings/security-center` (Step-Up Auth & SAML SSO) |

</details>

---

## Cloud Deployment & Multi-Language SDKs

### Render Blueprint Infrastructure ([`render.yaml`](render.yaml))
ProofPay ships a turnkey multi-service Infrastructure-as-Code Blueprint (`render.yaml`) provisioning three isolated components in `oregon`:
- **`proofpay-web` (`type: web`):** Next.js 15 App Router UI & 73 API route handlers with `/api/v1/health` readiness probes.
- **`proofpay-worker` (`type: worker`):** Standalone `SKIP LOCKED` outbox verification & settlement reconciliation worker (`npm run worker`).
- **`proofpay-postgres` (`postgresMajorVersion: 16`):** Managed PostgreSQL 16 database automatically wired via `fromDatabase` connection strings.

### APIMatic OpenAPI & Multi-Language SDKs ([`apimatic.json`](apimatic.json))
ProofPay exposes its formal OpenAPI contract at [`public/openapi.json`](public/openapi.json) paired with [`apimatic.json`](apimatic.json) to generate strongly typed client SDKs across **TypeScript, Python, C#, Java, Go, and PHP**, alongside an interactive authenticated explorer at `/docs`.

---

## Verified Evaluation & Chaos Resilience Benchmarks

All metrics below are directly recorded in [`docs/eval-results.md`](docs/eval-results.md) and [`docs/chaos-results.md`](docs/chaos-results.md) with prompt caching disabled (`noCache: true`) and strict dev / held-out splitting to prevent overfitting:

### Verification Pipeline Benchmark (30 Fixtures: 20 Dev + 10 Held-Out)

| Metric | Target | Dev Set (20) | Held-Out Set (10) | Full Suite (30) |
|---|---|---|---|---|
| **False Passes on Non-Pass Cases** | `0 / 19` | `0 / 11` (0.0%) | `0 / 8` (0.0%) | **`0 / 19` (0.0%)** |
| **False Rejects on Valid Cases** | `<= 1 / 10` | `0 / 8` | `0 / 2` | **`0 / 10` (0.0%)** |
| **Escalation Rate** | Report only | `0.0%` | `10.0%` | **`3.3%`** |
| **Verified Verbatim-Quote Rate** | `100%` | `100.0%` | `100.0%` | **`100.0%`** |
| **Raw Hallucination Rate** | Report only | `0.0%` | `0.0%` | **`0.0%`** |
| **Latency (p50 / p95)** | `p95 <= 20 s` | `16 ms / 7213 ms` | `14 ms / 3833 ms` | **`15 ms / 7213 ms`** |
| **Mean Cost per Verification** | `<= $0.03` | `$0.0097` | `$0.0126` | **`$0.0107`** |

> **Honest Statistical Disclosure:** With 0 false passes observed across 19 non-pass test cases, the 95% Rule-of-Three upper bound on false-pass probability is `3 / 19 (~15.8%)`. Optional criteria (`F10`, `required: false`) emit warnings while allowing pass per spec.

### PayPal Chaos & Failure Recovery Suite (`13 / 13` Passing · `0` Double Captures)

| Fault Injected (`C01`–`C13`) | Verified Invariant & Recovery Behavior |
|---|---|
| `INSTRUMENT_DECLINED` / `TRANSACTION_REFUSED` (`C01`–`C02`) | Transitions milestone to `RELEASE_FAILED`, records failure in ledger; zero unmanaged captures. |
| PayPal `500` / `DUPLICATE_INVOICE_ID` / Socket Timeout (`C03`–`C05`) | Reuses identical `PayPal-Request-Id` idempotency key; reconciliation converges to `<= 1` capture. |
| HTTP `429` Rate Limit & Webhook Races (`C06`–`C09`) | Respects exponential backoff; rejects invalid webhook signatures (`400`, `signature_valid=false`); deduplicates replays. |
| Worker Crash Mid-Release (`C10`) | Startup reconciliation recovers in-flight `RELEASING` jobs cleanly without double capture. |
| Expired Auth / Over-Capture / Reauth Failure (`C11`–`C13`) | Pre-capture guards block expired holds and over-captures (`CAPTURE_BLOCKED_EXPIRED`, `OVER_CAPTURE_PREVENTED`). |

---

## Model Context Protocol (MCP) Server

[`src/mcp/server.ts`](src/mcp/server.ts) exposes **exactly 6 MCP tools** over `StdioServerTransport` (`@modelcontextprotocol/sdk`) with strict money guardrails—agents can propose contracts, submit artifacts, and check status, while human buyers approve PayPal authorization holds directly:

| MCP Tool Name | Description & Built-In Safety Rail |
|---|---|
| `create_contract` | Compiles natural-language requirements into structured milestones/rubrics, auto-applies deterministic lint fixes, and optionally proposes to `seller_email`. |
| `accept_contract` | Worker/seller accepts contract terms, computing canonical `contract_hash`. |
| `get_funding_link` | Generates PayPal authorization approval URL—**explicitly instructs that a human payer must approve in PayPal**. |
| `submit_deliverable` | Submits `json_records` or `text` deliverable, records SHA-256 hash, and enqueues asynchronous 4-stage verification. |
| `get_verification_report` | Returns full Stage 1–3 evidence, adversarial scan findings, and Stage 4 decision reasons. |
| `get_contract_status` | Returns current contract state, authorization expiration window, and per-milestone capture status. |

Run the standalone MCP server:
```bash
npm run mcp:start
```

Configure in Claude Desktop / Cursor (`mcp_config.json`):
```json
{
  "mcpServers": {
    "proofpay": {
      "command": "npx",
      "args": ["tsx", "c:/path/to/ProofPay/src/mcp/server.ts"],
      "env": {
        "PROOFPAY_API_URL": "http://localhost:3000",
        "PROOFPAY_API_KEY": "pp_live_your_api_key"
      }
    }
  }
}
```

---

## Enterprise Security & Multi-Tenant Architecture

- **Tenant & Route Authorization:** Every state-changing endpoint enforces `requireParty()` / `requireRole()` plus PostgreSQL RLS (`withUserTx` setting `SET LOCAL app.current_user_id`), verified against the route authorization matrix in [`tests/integration/idor.test.ts`](tests/integration/idor.test.ts).
- **Step-Up Authentication ([`step-up.ts`](src/server/auth/step-up.ts)):** Sensitive operations (`funding.start`, `funding.approve`, `payment.refund`, `apikey.create`, `apikey.rotate`, `serviceaccount.create`, `member.role_change_privileged`, `org.transfer_ownership`, `me.export`, `account.delete`) enforce session-bound short-lived step-up grants (`600s` TTL, brute-force throttled at 5 failures / 15 min).
- **SSRF & Outbound Fetch Hardening ([`safe-fetch.ts`](src/server/net/safe-fetch.ts), [`ip.ts`](src/server/net/ip.ts)):** Blocks loopback (`127.0.0.0/8`, `::1`), RFC 1918 private subnets, link-local metadata endpoints (`169.254.169.254`), and IPv4-mapped IPv6 bypasses on `link_check` and webhook delivery.
- **Strict Content Security Policy & Security Headers ([`next.config.ts`](next.config.ts), [`csp.ts`](src/server/security/csp.ts)):** Enforces `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, strict referrer policy, PayPal sandbox connect/frame allowlisting, `font-src 'self' data:`, and `/api/v1/csp-report` telemetry.
- **SAML 2.0 SSO Profile Adapter ([`saml-sso.ts`](src/server/auth/saml-sso.ts)):** Parses SAML assertions with clock-skew checks and nonce replay prevention for Okta, Microsoft Entra ID, and Google Workspace.

---

## Application Showcase

<p align="center">
  <img src="assets/screenshots/dashboard-overview.png" alt="ProofPay Workspace Dashboard" width="95%" />
  <br />
  <em>Workspace Overview: Active PayPal Authorization Holds, Released Payouts, and Action Queue</em>
</p>

<p align="center">
  <img src="assets/screenshots/contract-studio.png" alt="ProofPay Contract Compiler Studio" width="95%" />
  <br />
  <em>Contract Studio: Natural-Language Compiler, Satisfiability Lint, and Acceptance Criteria Editor</em>
</p>

<p align="center">
  <img src="assets/screenshots/demo-express.png" alt="90-Second Express Sandbox Lane" width="95%" />
  <br />
  <em>Express Sandbox Lane: Pre-Authorized PayPal Pool, Deliverable Verification, and Live Partial Capture</em>
</p>

<p align="center">
  <img src="assets/screenshots/demo-mcp-agent.png" alt="Model Context Protocol Agent Simulator" width="95%" />
  <br />
  <em>In-Browser MCP Simulator: JSON-RPC 2.0 Client Tool Calls Paired with PayPal Authorization Caps</em>
</p>

<p align="center">
  <img src="assets/screenshots/demo-tribunal.png" alt="Multi-Agent AI Dispute Tribunal" width="95%" />
  <br />
  <em>AI Dispute Tribunal: Three-Agent Adversarial Evidence Review Generating Advisory Settlement Briefs</em>
</p>

<p align="center">
  <img src="assets/screenshots/demo-agent-wallet.png" alt="Autonomous Agent Spend Policy" width="95%" />
  <br />
  <em>Agent Spend Guardrails: Per-Contract Caps, Open-Hold Ceilings, and Scoped Machine Credentials</em>
</p>

<p align="center">
  <img src="assets/screenshots/offline-verifier.png" alt="Offline ProofPack Verifier" width="95%" />
  <br />
  <em>Zero-Dependency Offline Verifier: Browser-Side SHA-256 Hash-Chain Validation</em>
</p>

<p align="center">
  <img src="assets/screenshots/transparency-checkpoints.png" alt="Public Transparency Log" width="95%" />
  <br />
  <em>Transparency Checkpoints & Audit Ledger: Batched Merkle Roots and Ed25519 Key Fingerprints</em>
</p>

---

## Technology Stack

<p align="left">
  <img src="assets/icons/nextjs.svg" width="34" height="34" alt="Next.js" title="Next.js 15.3.3" />&nbsp;&nbsp;
  <img src="assets/icons/react.svg" width="34" height="34" alt="React" title="React 19" />&nbsp;&nbsp;
  <img src="assets/icons/typescript.svg" width="34" height="34" alt="TypeScript" title="TypeScript 5.7" />&nbsp;&nbsp;
  <img src="assets/icons/tailwindcss.svg" width="34" height="34" alt="Tailwind CSS" title="Tailwind CSS 3.4" />&nbsp;&nbsp;
  <img src="assets/icons/nodejs.svg" width="34" height="34" alt="Node.js" title="Node.js" />&nbsp;&nbsp;
  <img src="assets/icons/postgresql.svg" width="34" height="34" alt="PostgreSQL" title="PostgreSQL 16 + Drizzle ORM" />&nbsp;&nbsp;
  <img src="assets/icons/paypal.svg" width="34" height="34" alt="PayPal" title="PayPal REST v2 Orders & Authorizations" />&nbsp;&nbsp;
  <img src="assets/icons/anthropic.svg" width="34" height="34" alt="Anthropic" title="Anthropic SDK + Groq LPU" />&nbsp;&nbsp;
  <img src="assets/icons/opentelemetry.svg" width="34" height="34" alt="OpenTelemetry" title="OpenTelemetry & Prometheus Metrics" />&nbsp;&nbsp;
  <img src="assets/icons/vitest.svg" width="34" height="34" alt="Vitest" title="Vitest + fast-check" />&nbsp;&nbsp;
  <img src="assets/icons/playwright.svg" width="34" height="34" alt="Playwright" title="Playwright + axe-core" />&nbsp;&nbsp;
  <img src="assets/icons/docker.svg" width="34" height="34" alt="Docker" title="Docker Compose" />&nbsp;&nbsp;
  <img src="assets/icons/githubactions.svg" width="34" height="34" alt="GitHub Actions" title="GitHub Actions CI & Security" />
</p>

| Layer | Technologies Used |
|---|---|
| **Frontend** | Next.js `15.3.3` (App Router), React `19`, Tailwind CSS `3.4`, AG Grid Community `33.0.4`, TanStack React Query `5.62`, Lucide Icons |
| **Backend & Queue** | Next.js Route Handlers (73 routes), `tsx` Background Worker (`src/worker/index.ts`), `postgres` (`^3.4.5`), Drizzle ORM (`^0.41.0`) |
| **Payments** | PayPal REST v2 Orders & Payments (`AUTHORIZE`, partial/final `capture`, `void`, `refund`, webhook verification) |
| **AI & Determinism** | `@anthropic-ai/sdk` (`claude-sonnet-4-5` / `claude-haiku-4-5`), Groq LPU (`qwen/qwen3.8-27b`), `ajv` + `ajv-formats`, `fast-json-patch` (RFC 6902) |
| **Agent Protocol** | `@modelcontextprotocol/sdk` (`^1.0.4`), `zod` (`^3.25.23`), `zod-to-json-schema` |
| **Security & Crypto** | `jose` (`^5.9.6`), Web Crypto / Node `crypto` (SHA-256, Ed25519 KMS signer, RFC 3161 DER TSA), `pdfkit` (`^0.16.0`), PostgreSQL RLS |
| **Observability & Testing** | `pino` (`^9.5.0`), Prometheus metrics (`/api/v1/metrics`), Vitest (`2.1.8`), `fast-check`, `msw`, Playwright (`1.49.1`), `@axe-core/playwright` |

---

## Getting Started (Local Development)

### Prerequisites
- **Node.js** `>= 20.0.0` (Node 20 LTS or 22 recommended)
- **PostgreSQL 16** (or Docker Desktop for the bundled `docker-compose.yml`)
- **PayPal Developer Sandbox** credentials (`PAYPAL_CLIENT_ID` & `PAYPAL_CLIENT_SECRET`)
- **Anthropic API Key** (plus optional `GROQ_API_KEY` for dual-model consensus)

### 1. Clone & Install
```bash
git clone https://github.com/Monolithic-Dev/ProofPay.git
cd ProofPay
npm ci
```

### 2. Start PostgreSQL 16 via Docker Compose
[`docker-compose.yml`](docker-compose.yml) exposes PostgreSQL 16 on port **`5435`** by default (`POSTGRES_PORT:-5435`) with user `proofpay`, password `proofpay`, and database `proofpay`:
```bash
npm run db:up
```

### 3. Configure Environment Variables
```bash
cp .env.example .env
```
Update `.env` so `DATABASE_URL` points to port `5435` (when using Docker Compose), set your PayPal Sandbox and Anthropic keys, and generate a 32+ character `SESSION_SECRET`:
```bash
openssl rand -hex 32
```

### 4. Run Database Migrations & Seed Demo Data
```bash
npm run db:migrate
npm run seed
```
Seeding provisions pre-configured sandbox personas (`buyer`, `seller`, `buyer_agent`, `worker_agent`), sample hash-chained contracts, and the pre-authorized `demo_pool`.

### 5. Run the Web App, Worker & MCP Server
Open separate terminals as needed:
```bash
# Terminal 1: Next.js web portal & API (http://localhost:3000)
npm run dev

# Terminal 2: Background job worker (verifications, auto-release, PayPal reconciliation)
npm run worker

# Terminal 3 (optional): MCP server on stdio
npm run mcp:start
```

Visit [http://localhost:3000](http://localhost:3000) for the landing page, or [http://localhost:3000/demo](http://localhost:3000/demo) for the interactive sandbox playground.

---

## Environment Variables Reference

All runtime variables are strictly validated at startup by [`src/server/config/env.ts`](src/server/config/env.ts):

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection URI (e.g. `postgresql://proofpay:proofpay@localhost:5435/proofpay`). |
| `PAYPAL_ENV` | **Yes** | — | Must be `sandbox` in this build. |
| `PAYPAL_CLIENT_ID` | **Yes** | — | PayPal Developer Sandbox REST app client ID. |
| `PAYPAL_CLIENT_SECRET` | **Yes** | — | PayPal Developer Sandbox REST app secret. |
| `PAYPAL_WEBHOOK_ID` | Optional | — | PayPal webhook ID for incoming event signature verification. |
| `ANTHROPIC_API_KEY` | **Yes** | — | Anthropic API key for Stage 2 rubric verification and compilation. |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-5` | Primary Anthropic model for rubric grading and compilation. |
| `ANTHROPIC_MODEL_FAST` | No | `claude-haiku-4-5` | Fast Anthropic model for adversarial classification and linting. |
| `GROQ_API_KEY` | Optional | — | Optional Groq API key enabling dual-model consensus evaluation. |
| `GROQ_MODEL` | No | `qwen/qwen3.8-27b` | Groq model identifier used for dual-LLM verification consensus. |
| `LLM_DAILY_BUDGET_USD` | No | `5` | Daily hard cap on LLM verification spend in USD (`llm_calls` ledger). |
| `SESSION_SECRET` | **Yes** | — | HMAC/JWT signing secret (minimum 32 characters enforced at boot). |
| `APP_BASE_URL` | No | `http://localhost:3000` | Public origin used for PayPal return/cancel URLs and invitation links. |
| `DEMO_MODE` | No | `true` | Enables `/demo/*` sandbox routes and demo persona switching (`true` \| `false`). |
| `DEMO_TIME_SCALE` | No | `1` | Time compression multiplier (`>= 1`); guarded against accidental production use unless `ALLOW_TIME_SCALE_IN_PROD=true`. |
| `CHAOS_MODE` | No | `false` | Enables synthetic fault injection paths (`true` \| `false`). |
| `MAX_CONTRACT_DAYS` | No | `28` | Maximum contract duration (`1`–`28`), staying within PayPal's 29-day authorization window. |
| `RUN_ROLE` | No | `web` | Process mode identifier (`web` \| `worker` \| `mcp`). |
| `LOG_LEVEL` | No | `info` | Pino structured log verbosity (`trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal`). |

---

## Repository Layout & NPM Scripts

```text
ProofPay/
├── .github/workflows/        # CI pipeline (ci.yml) & supply-chain security gates (security.yml)
├── assets/
│   ├── banner.svg            # Repository hero banner
│   ├── icons/                # Local technology SVGs (14 icons)
│   └── screenshots/          # UI showcase screenshots (8 captures)
├── docs/                     # Specs, eval-results.md, chaos-results.md, runbook, MCP guide
├── drizzle/                  # 11 PostgreSQL SQL migrations (0000_init.sql – 0010_demo_pool.sql)
├── scripts/                  # DB migrate/seed, check-copy.mjs, eval/chaos/canary/attack runners
├── src/
│   ├── app/                  # 47 Next.js 15 pages & 73 versioned /api/v1 route handlers
│   ├── components/           # Navigation, dashboards, AG Grid ledger, verification & wizard UI
│   ├── demo/                 # Fixtures and sandbox scenario orchestrators
│   ├── lib/                  # Offline ProofPack verifier, RFC 3161 TSA, KMS signer, SSRF fetch, SSE
│   ├── mcp/                  # Model Context Protocol server (6 guarded tools)
│   ├── server/               # Core domain: AI prompts, auth/RBAC/SAML/step-up, contracts, loophole-finder,
│   │                         # PayPal v2 adapters, RLS helpers, 4-stage pipeline, 1099-K compliance, worker queue
│   ├── shared/               # Shared API client, ledger reducer, TypeScript contracts
│   └── worker/               # Background job processor and deadline schedulers
└── tests/
    ├── unit/                 # 63 Vitest unit suites (425 passing tests)
    └── integration/          # IDOR authorization matrix, PayPal client, webhooks, reconcile, funding
```

### Core Commands
```bash
npm run check:copy        # Enforce honesty policy (Authorization Hold vs Escrow, no overclaims)
npm run typecheck         # TypeScript check (tsc --noEmit)
npm run lint              # Next.js ESLint check
npm run test:unit         # Run 63 Vitest unit suites (425 tests)
npm run test:integration  # Run integration & IDOR matrix suites (requires DB)
npm run build             # Production Next.js build (78 routes / pages)
npm run eval              # Run verifier evaluation suite
npm run chaos             # Run PayPal chaos & resilience harness
```

---

## CI/CD & Automated Quality Gates

ProofPay runs two GitHub Actions workflows across pushes and pull requests to `development` / `main`:

1. **[`ci.yml`](.github/workflows/ci.yml):** Executes `npm run typecheck`, `npm run test:unit`, and a clean `npm run build`.
2. **[`security.yml`](.github/workflows/security.yml):** Executes `scripts/self-audit.sh`, strict permissive license auditing (`license-checker`), CycloneDX SBOM generation (`sbom.json`), `npm audit --omit=dev --audit-level=critical`, CodeQL static analysis (`javascript-typescript`), and full git-history secret scanning via Gitleaks.
3. **Copy & Honesty Gate (`npm run check:copy`):** Scans `src/` via [`scripts/check-copy.mjs`](scripts/check-copy.mjs) to reject inaccurate `"escrow"`, `"0% fee"`, `"100% accurate"`, `"legally binding"`, or `"locks authorization funds"` claims before shipping.

---

## License

This project is licensed under the [MIT License](LICENSE).
