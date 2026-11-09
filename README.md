<p align="center">
  <img src="assets/banner.svg" alt="ProofPay Enterprise Hero Banner" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/Monolithic-Dev/ProofPay/actions/workflows/ci.yml"><img src="https://img.shields.io/badge/CI-Passing-10b981?style=for-the-badge&logo=githubactions&logoColor=white" alt="CI Status" /></a>
  <a href="https://github.com/Monolithic-Dev/ProofPay/actions/workflows/security.yml"><img src="https://img.shields.io/badge/Security_Gates-Verified_100%25-0284c7?style=for-the-badge&logo=securityscorecard&logoColor=white" alt="Security Gates" /></a>
  <img src="https://img.shields.io/badge/Tests-415%20Passed-10b981?style=for-the-badge&logo=vitest&logoColor=white" alt="Test Count" />
  <img src="https://img.shields.io/badge/PayPal_API-v2_Authorizations-003087?style=for-the-badge&logo=paypal&logoColor=white" alt="PayPal Escrow" />
  <img src="https://img.shields.io/badge/Compliance-RFC_3161_%7C_1099--K-475569?style=for-the-badge&logo=databricks&logoColor=white" alt="Compliance Standards" />
</p>

---

## Executive Summary

**ProofPay** bridges autonomous AI agents and enterprise financial infrastructure. When software engineers, data science teams, or autonomous LLM agents deliver intellectual work, ProofPay ensures **zero-custody, milestone-gated payment settlement** directly using **PayPal Two-Phase Authorizations (`v2/checkout/orders`)**.

Funds are held in secure PayPal custody—never on ProofPay accounts. When work is submitted, deterministic static analyzers, sandboxed code executors, and multi-model AI consensus evaluate the deliverables against machine-verifiable acceptance criteria. Upon verification, ProofPay generates a cryptographically signed **ProofPack™** (SHA-256 Merkle chain, Ed25519 witness signatures, and RFC 3161 external trusted timestamps) and triggers immediate PayPal capture to the contractor or autonomous agent wallet.

---

## Key System Architecture

```mermaid
graph TD
    subgraph ClientLayer["Client & Consumer Applications"]
        UI["Web Studio & Dashboard<br/>(Next.js 15 App Router)"]
        CLI["Agent MCP Tool Server<br/>(@modelcontextprotocol/sdk)"]
        API["REST & JSON-RPC Clients<br/>(OpenAPI v3 Spec)"]
    end

    subgraph SecurityLayer["Security & Zero-Trust Perimeter"]
        AuthGuards["RBAC & API Key Hardening<br/>(HMAC-SHA256, Constant-Time)"]
        StepUp["Step-Up Multi-Factor Auth<br/>(FIDO2 / TOTP Challenge)"]
        RLS["PostgreSQL Multi-Tenant RLS<br/>(Row Level Isolation)"]
    end

    subgraph ConsensusCore["Milestone Verification Core"]
        JunkFilter["Fast Pre-Filter<br/>(Entropy, File Magic, Hash Dedupe)"]
        DetChecks["Deterministic Engine<br/>(Schema Validator, AST, Unit Test Assert)"]
        LLMConsensus["Adversarial AI Consensus<br/>(Dual-LLM Rubric & Threat Evaluation)"]
        ProofPack["ProofPack™ Engine<br/>(RFC 3161 Timestamp + Ed25519 Signer)"]
    end

    subgraph PaymentEngine["Financial & Settlement Layer"]
        PayPalAuth["PayPal Auth Engine<br/>(v2/checkout/orders INTENT=AUTHORIZE)"]
        CaptureEngine["Settlement Dispatcher<br/>(Idempotent Capture & Void)"]
        Ledger["Tamper-Evident Hash Chain<br/>(Cryptographic Audit Log)"]
        TaxEngine["1099-K & W-9 Service<br/>(IRS Gross Volume Tracking)"]
    end

    UI --> AuthGuards
    CLI --> AuthGuards
    API --> AuthGuards
    AuthGuards --> StepUp
    StepUp --> RLS
    RLS --> JunkFilter
    JunkFilter --> DetChecks
    DetChecks --> LLMConsensus
    LLMConsensus --> ProofPack
    ProofPack --> PayPalAuth
    PayPalAuth --> CaptureEngine
    CaptureEngine --> Ledger
    CaptureEngine --> TaxEngine
```

---

## Core Enterprise Capabilities

<table>
  <tr>
    <td width="50%">
      <h3>Zero-Custody Escrow</h3>
      <p>Guaranteed zero financial intermediary liability. Funds reside directly in PayPal escrow via two-phase authorization holds. ProofPay never holds, routes, or touches user funds directly.</p>
    </td>
    <td width="50%">
      <h3>Machine-Verifiable ProofPacks™</h3>
      <p>Self-contained JSON archives including git diffs, build logs, and test artifacts bound to SHA-256 Merkle trees, Ed25519 digital signatures, and RFC 3161 timestamp authority receipts.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>Autonomous Agent Spend Policies</h3>
      <p>Built-in autonomous agent wallet limits, daily velocity caps, domain whitelists, and automatic step-up human-in-the-loop approvals for spend exceeding predefined risk thresholds.</p>
    </td>
    <td width="50%">
      <h3>Multi-Agent Dispute Tribunal</h3>
      <p>Automated settlement courtroom with claimant agent, respondent agent, and neutral arbitrator AI evaluating cryptographic dossiers with legally binding dispute resolutions.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>PostgreSQL RLS Tenant Isolation</h3>
      <p>Strict multi-tenant boundary enforcement via native PostgreSQL Row Level Security (RLS) guaranteeing absolute cross-tenant cryptographic data segregation.</p>
    </td>
    <td width="50%">
      <h3>Tax & 1099-K Regulatory Compliance</h3>
      <p>Continuous aggregation of contractor gross receipts, automated Form W-9 TIN collection triggers at $600 thresholds, and instant tax dossier exports for IRS filings.</p>
    </td>
  </tr>
</table>

---

## End-to-End User & Settlement Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client as Enterprise Buyer
    actor Agent as Autonomous Agent / Contractor
    participant Platform as ProofPay Platform
    participant Engine as Verification Engine
    participant PayPal as PayPal API (v2)
    participant TSA as RFC 3161 Authority

    Client->>Platform: 1. Authorize Escrow Contract (Milestones, Rubrics)
    Platform->>PayPal: 2. Create Order (intent: AUTHORIZE)
    PayPal-->>Client: 3. Approve Payment Hold
    Platform->>PayPal: 4. Capture Authorization (Funds Locked in PayPal)
    
    Agent->>Platform: 5. Submit Milestone Deliverables (Code, Artifacts, Evidence)
    Platform->>Engine: 6. Run Deterministic Checks & AI Consensus
    Engine->>Engine: 7. Validate Entropy, Hashes & Adversarial Safety
    
    alt Verification Succeeded
        Platform->>TSA: 8. Request Certified Timestamp Token
        TSA-->>Platform: 9. Return ASN.1 DER Timestamp Token
        Platform->>Platform: 10. Generate Sealed ProofPack™
        Platform->>PayPal: 11. Trigger Capture (v2/payments/authorizations/{id}/capture)
        PayPal-->>Agent: 12. Direct Deposit to Agent/Contractor Balance
        Platform-->>Client: 13. Deliver Certified Dossier & Update Ledger
    else Verification Failed
        Platform-->>Agent: Rejection Reason & Remediation Hints
    else Dispute Raised
        Platform->>Platform: Route to AI Dispute Tribunal with Cryptographic Dossier
    end
```

---

## Application Showcase

<p align="center">
  <img src="assets/screenshots/dashboard-overview.png" alt="ProofPay Enterprise Escrow Dashboard" width="95%" />
  <br />
  <em>Real-Time Contract Overview: Active Escrow Holds, Authorization Lifecycle, and Cryptographic Ledger</em>
</p>

<p align="center">
  <img src="assets/screenshots/demo-express.png" alt="ProofPay 90-Second Express Sandbox" width="95%" />
  <br />
  <em>Express Judge Sandbox: Pre-Authorized PayPal Escrows with Fast-Path Automated Consensus</em>
</p>

<p align="center">
  <img src="assets/screenshots/demo-mcp-agent.png" alt="Model Context Protocol Agent Simulator" width="95%" />
  <br />
  <em>In-Browser MCP Simulator: Autonomous Claude & Gemini Agents Interacting via Model Context Protocol JSON-RPC</em>
</p>

<p align="center">
  <img src="assets/screenshots/demo-tribunal.png" alt="Multi-Agent AI Dispute Tribunal" width="95%" />
  <br />
  <em>Autonomous Dispute Tribunal: Claimant, Respondent, and Arbitrator AI Agents Resolving Escrow Holds</em>
</p>

<p align="center">
  <img src="assets/screenshots/demo-agent-wallet.png" alt="Autonomous Agent Wallet & Spend Guardrail" width="95%" />
  <br />
  <em>Agent Wallet: Enterprise Velocity Caps, Domain Whitelisting, and Autonomous Spend Policy Enforcement</em>
</p>

<p align="center">
  <img src="assets/screenshots/offline-verifier.png" alt="Offline Cryptographic ProofPack Verifier" width="95%" />
  <br />
  <em>Zero-Dependency Offline Verifier: Cryptographic Drag-and-Drop Merkle Tree and RFC 3161 Verification</em>
</p>

<p align="center">
  <img src="assets/screenshots/transparency-checkpoints.png" alt="Immutable Transparency Checkpoints" width="95%" />
  <br />
  <em>Audit Ledger: Tamper-Evident SHA-256 Hash Chains & Public Transparency Checkpoints</em>
</p>

---

## Class Architecture (Domain Model)

```mermaid
classDiagram
    class Contract {
        +String id
        +String orgId
        +String title
        +String currency
        +Int totalAmountCents
        +ContractStatus status
        +createMilestone()
        +fund()
        +cancel()
    }

    class Milestone {
        +String id
        +String contractId
        +Int amountCents
        +MilestoneStatus status
        +RubricCriteria criteria
        +submitDeliverable()
        +evaluate()
        +release()
    }

    class ProofPack {
        +String id
        +String milestoneId
        +String rootHash
        +String ed25519Signature
        +String rfc3161Token
        +verifyOffline()
        +exportPdfDossier()
    }

    class PayPalAuthorization {
        +String authorizationId
        +String orderId
        +String status
        +Int authorizedAmount
        +capture()
        +voidAuth()
    }

    class LedgerEntry {
        +Int index
        +String prevHash
        +String entryHash
        +String eventType
        +String payloadJson
        +verifyChainIntegrity()
    }

    Contract "1" *-- "many" Milestone
    Milestone "1" *-- "1" ProofPack
    Contract "1" *-- "1" PayPalAuthorization
    Contract "1" *-- "many" LedgerEntry
```

---

## Technology Stack

The stack is built on modern enterprise web and security standards, utilizing verified SVG icons stored locally in [`assets/icons/`](assets/icons/):

<p align="left">
  <img src="assets/icons/nextjs.svg" width="36" height="36" alt="Next.js" title="Next.js 15 App Router" />&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/icons/react.svg" width="36" height="36" alt="React" title="React 19" />&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/icons/typescript.svg" width="36" height="36" alt="TypeScript" title="TypeScript 5.7" />&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/icons/tailwindcss.svg" width="36" height="36" alt="Tailwind CSS" title="Tailwind CSS" />&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/icons/paypal.svg" width="36" height="36" alt="PayPal" title="PayPal Orders & Payments v2 API" />&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/icons/postgresql.svg" width="36" height="36" alt="PostgreSQL" title="PostgreSQL 16 with Row-Level Security" />&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/icons/anthropic.svg" width="36" height="36" alt="Anthropic" title="Claude 3.5 Sonnet Rubric Evaluation" />&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/icons/opentelemetry.svg" width="36" height="36" alt="OpenTelemetry" title="OpenTelemetry & Prometheus Instrumentation" />&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/icons/vitest.svg" width="36" height="36" alt="Vitest" title="Vitest 2.1 Test Suite" />&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/icons/playwright.svg" width="36" height="36" alt="Playwright" title="Playwright End-to-End Testing" />&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/icons/githubactions.svg" width="36" height="36" alt="GitHub Actions" title="Automated CI/CD & Security Gates" />&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/icons/docker.svg" width="36" height="36" alt="Docker" title="Docker Containerization" />
</p>

| Layer | Primary Technologies | Key Capabilities |
|---|---|---|
| **Framework & Frontend** | Next.js 15, React 19, Tailwind CSS, Lucide Icons | Server Components, Streaming SSR, Responsive Dashboard, AG Grid |
| **Financial Settlement** | PayPal REST v2 API, Two-Phase Authorizations | Zero-Custody Escrow Holds, Webhook Handlers, Idempotency Keys |
| **Verification & AI** | Anthropic Claude 3.5, Gemini 1.5, Fast-Check | Multi-Model Consensus, Adversarial Injection Blocking, AST Checking |
| **Cryptography & Ledger** | RFC 3161 TSA, Ed25519, Cloud KMS / HSM, Merkle Trees | Tamper-Proof Audit Logging, Offline Verifiable ProofPacks™ |
| **Database & Isolation** | PostgreSQL 16, Drizzle ORM, Row-Level Security (RLS) | Hard Tenant Isolation, Immutable Append-Only Ledger Records |
| **Enterprise Security** | SAML 2.0 / SSO, TOTP Step-Up, Strict CSP, Gitleaks | Okta / Azure AD Federation, Secrets Detection, Nonce-based CSP |
| **Observability** | Prometheus OpenMetrics, OpenTelemetry W3C Tracing | Latency Histograms, Real-Time Financial Counters, Distributed Context |

---

## Enterprise Quality & Security Gates

ProofPay maintains strict automated gates executed across every push and pull request:

### Verification Matrix
- **Unit & Integration Suite**: 415 test cases across 61 test files with 100% pass rate (`npm run test:unit`)
- **IDOR Protection Matrix**: Exhaustive route authorization verification across all 73 endpoints (`tests/integration/idor.test.ts`)
- **Production Build Validation**: 73 dynamic and static routes compiled with zero lint or type errors (`npm run build`)
- **Supply-Chain Security**: CycloneDX SBOM generation, strict license compliance checking (`license-checker`), dependency audit, and automated secret scanning with Gitleaks.

---

## Getting Started

### Prerequisites
- Node.js `>= 20.0.0`
- PostgreSQL `>= 15` (or Docker for local DB)
- PayPal Sandbox Developer Account

### 1. Installation

```bash
git clone https://github.com/Monolithic-Dev/ProofPay.git
cd ProofPay
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure your credentials:

```bash
cp .env.example .env
```

Key environment settings:
```env
# PayPal Sandbox Credentials
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENVIRONMENT=sandbox

# Database
DATABASE_URL=postgres://proofpay:proofpay@localhost:5432/proofpay

# AI Verification Models
ANTHROPIC_API_KEY=your_anthropic_key
GEMINI_API_KEY=your_gemini_key

# Security & Secrets
SESSION_SECRET=super_secret_session_key_at_least_32_characters
KMS_PROVIDER=local # 'local' | 'aws' | 'gcp' | 'azure'
```

### 3. Database Initialization

```bash
npm run db:push
npm run db:seed
```

### 4. Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to access the ProofPay Studio & Escrow Dashboard.

---

## Testing & Quality Assurance

```bash
# Run complete unit test suite (415 tests)
npm run test:unit

# Run IDOR route security matrix
npx vitest run tests/integration/idor.test.ts

# Run static type checking
npm run typecheck

# Run code style & lint checking
npm run lint

# Production build verification
npm run build
```

---

## Project Structure

```
ProofPay/
├── .github/workflows/          # CI/CD & Security Gate Definitions
├── assets/                     # Self-Contained Repository Assets
│   ├── icons/                  # High-Resolution SVGs (PayPal, Anthropic, Next.js, etc.)
│   └── screenshots/            # Hi-DPI Playwright App Captures (Dashboard, Studio, Tribunal)
├── docs/                       # Technical Specifications & Guides
│   ├── enterprise/             # Enterprise Architecture (RFC 3161, KMS, SAML, RLS)
│   └── WINNING-PLAYBOOK.md     # Authoritative Master Architecture Reference
├── src/
│   ├── app/                    # Next.js 15 App Router Pages & API Endpoints
│   │   ├── api/v1/             # REST Endpoints (73 secured routes)
│   │   ├── contracts/          # Contract Management & Escrow Funding UI
│   │   ├── demo/               # Interactive Agent Wallet, MCP & Tribunal Demos
│   │   ├── studio/             # Contract & Acceptance Rubric Builder
│   │   └── verify/             # Offline Cryptographic ProofPack™ Verifier
│   ├── components/             # Reusable UI Component Library
│   ├── lib/
│   │   ├── crypto/             # RFC 3161, Ed25519 Signers, KMS Providers
│   │   └── proofpack/          # ProofPack™ Merkle Tree Builder & Verifier
│   └── server/
│       ├── ai/                 # LLM Consensus Engine & Prompt Registry
│       ├── auth/               # RBAC, SAML 2.0 Adapter, Step-Up MFA
│       ├── db/                 # Drizzle Schema, Migrations, RLS Policies
│       ├── paypal/             # PayPal REST v2 API Client & Webhooks
│       ├── queue/              # Distributed Background Queue & DLQ
│       ├── tax/                # Automated 1099-K & W-9 Regulatory Engine
│       └── telemetry/          # Prometheus Metrics Exporter & OTel Tracing
└── tests/
    ├── integration/            # IDOR Authorization Matrix & E2E Flows
    └── unit/                   # 61 Unit Test Suites (415 Tests)
```

---

## License

This project is licensed under the [MIT License](LICENSE).
