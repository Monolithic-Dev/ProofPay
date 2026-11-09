# ProofPay Data Lifecycle, Retention Schedule & Subprocessor Map

> **Document Version:** 1.0.0 (Authoritative)  
> **Last Updated:** November 2026 · **Scope:** Appendix D-1, D-2, A-4  
> **Compliance Context:** Zero-Custody Architecture, GDPR Data Minimization, PayPal Developer Policy

---

## 1. Data Classification and Inventory Map

ProofPay collects only the minimal data elements strictly required to operate cryptographic agreements and dispatch PayPal v2 API requests.

| Data Domain | Specific Data Fields | Storage System | Retention Period | Access Controls | Subprocessor Shared With | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Identity & Account** | Email address, hashed password (Argon2id), full name, organization membership, role | PostgreSQL (`users`, `org_memberships`) | Account lifespan + 30 days post-deletion | Authenticated user session, strict RLS | None (Self-hosted / Cloud DB) | User authentication, session management, RBAC enforcement |
| **API Keys & Credentials** | Key prefix (e.g. `pp_live_...`), SHA-256 key hash, label, scopes, allowed IPs | PostgreSQL (`api_keys`) | Active lifespan; immediate invalidation upon revoke | Scoped bearer token validation | None | Scoped machine-to-machine authentication for AI agents |
| **Contract Specifications** | Title, milestone descriptions, criteria schemas (JSON Schema, regex, keywords, junk bounds), payout amounts | PostgreSQL (`contracts`, `milestones`) | Agreement lifecycle + 1 year audit archive | Organization members (Buyer & Seller), RLS isolated | LLM Providers (Groq / Anthropic) during rubric evaluation | Milestone definition, automated contract compilation, clarity linting |
| **Deliverable Payloads** | JSON arrays, structured text, CSV snippets, code deliverables submitted by workers | PostgreSQL (`submissions`), temporary worker memory | 7 days post-verification; permanent SHA-256 hash retained | Contract counterparties only | LLM Providers (only text snippets needed for rubric quotes) | Automated verification, evidence extraction, Proof Pack compilation |
| **Financial State & Rails** | PayPal authorization IDs (`AUTH-...`), PayPal capture IDs, order tokens, transaction amounts | PostgreSQL (`contracts`, `milestones`, `demo_pool`) | Active agreement lifespan + financial reconciliation window | Restricted to automated transaction worker and authorized finance users | **PayPal Inc.** (via PayPal v2 API rails) | Placing authorization holds, triggering verified captures, voiding holds |
| **Cryptographic Audit Trail** | SHA-256 event hash, previous block hash, canonical JSON payload snapshot, timestamp | PostgreSQL (`ledger_events`) | Append-only; permanent immutable ledger | Publicly auditable via Proof Pack & `/verify` | None (Client-side verifiable) | Tamper-evident ledger, Merkle checkpoint publication, dispute defense |
| **System & Security Telemetry** | Request IP address, User-Agent, endpoint latency, status codes, Prometheus metrics | Ephemeral memory, Prometheus endpoint (`/api/v1/metrics`) | 30 days rolling window | System administrators, rate-limit controllers | Monitoring infrastructure (OpenTelemetry) | DDoS prevention, SSRF defense, rate-limiting, uptime assurance |

---

## 2. Authoritative Subprocessor List (Appendix A-4)

ProofPay contracts only with SOC 2 / ISO 27001-certified enterprise infrastructure providers.

| Subprocessor | Corporate Entity | Purpose & Service Provided | Data Location | Safeguards & Security Standards |
| :--- | :--- | :--- | :--- | :--- |
| **PayPal Inc.** | PayPal, Inc. (San Jose, CA, USA) | Payment authorization holds, capture execution, webhook callbacks, dispute rail mediation | United States / Global | PCI-DSS Level 1 Service Provider, TLS 1.3 encrypted API endpoints, strict API key isolation |
| **Groq Inc.** | Groq, Inc. (Mountain View, CA, USA) | Fast LPU contract compilation, clarity scoring, and rubric quote extraction | United States | Zero data retention for model training, ephemeral inference processing |
| **Anthropic PBC** | Anthropic PBC (San Francisco, CA, USA) | Multi-model consensus verification and adversarial red-team evaluations | United States | Commercial zero-training API agreements, SOC 2 Type II compliance |
| **Render Services** | Render Services, Inc. (San Francisco, CA, USA) | Primary cloud application hosting, PostgreSQL database management, and container execution | United States (Oregon) | Encrypted storage at rest (AES-256), automated TLS certificate management, DDoS shield |

---

## 3. Data Retention & Purge Schedule (Appendix D-2)

1. **Demo Sandbox Purge:** All synthetic agreements, test submissions, and sandbox authorization pool entries are automatically purged on **December 16, 2026**.
2. **Deliverable Payloads:** Raw deliverable submission content is expired after 7 days post-verification. The cryptographic SHA-256 hash of the deliverable is permanently preserved in the ledger to maintain mathematical proof.
3. **Right to Erasure (GDPR Art. 17):** Users can trigger account deletion via workspace settings. Personal identity fields are deleted within 24 hours. Historical ledger events remain sealed using pseudonymous actor identifiers to preserve the mathematical continuity of the hash chain.

---

## 4. PII Redaction & Minimization Policy (Appendix D-4, D-5)

* **No Secrets in Logs:** Automated filters scrub Authorization headers, PayPal client secrets, and bearer tokens before log ingestion.
* **PII Shield for AI Prompts:** Email addresses, phone numbers, and physical addresses are redacted or masked before passing text to external LLM evaluation endpoints.
* **Zero-Custody Guarantee:** Credit card numbers, bank account details, and PayPal account passwords never enter or traverse ProofPay servers; all payment authorization occurs directly inside PayPal's hosted checkout experience.

