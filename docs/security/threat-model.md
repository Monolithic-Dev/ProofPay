# ProofPay Threat Model (STRIDE)

This document provides a systematic **STRIDE** threat model across all architectural components of ProofPay.

---

## 1. Threat Classification Matrix

| Component | Threat Category | Threat Description | Severity | Mitigating Control in ProofPay | Verification / Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Web Frontend** | **Tampering** | Stored or Reflected XSS via deliverable payloads | High | Nonce-based CSP (`strict-dynamic`, no `'unsafe-inline'`), React auto-escaping, HTML tag stripping | `src/server/security/csp.ts`, `tests/unit/csp.test.ts` |
| **Web Frontend** | **Repudiation** | Clickjacking / iframe embedding | Medium | `frame-ancestors 'none'` in CSP header | `tests/unit/csp.test.ts` |
| **API Endpoints** | **Spoofing** | Session hijacking / stolen cookie used to drain funds | Critical | Step-up authentication required within 600s bound to `session_id` | `src/server/auth/step-up.ts`, `tests/unit/step-up.test.ts` |
| **API Endpoints** | **Information Disclosure** | Server-Side Request Forgery (SSRF) targeting cloud metadata | Critical | `safeFetch` client blocking loopback, RFC 1918, and `169.254.169.254` | `src/server/net/safe-fetch.ts`, `tests/unit/ip.test.ts` |
| **API Endpoints** | **Denial of Service** | Volumetric brute-force / API flooding | High | Persistent sliding-window rate limiter (in-memory + DB KV fallback) | `src/server/util/rate-limit.ts`, `tests/unit/rate-limit.test.ts` |
| **API Endpoints** | **Elevation of Privilege** | Cross-tenant data access (IDOR) | Critical | PostgreSQL Row-Level Security (`withUserTx`) enforcing tenant boundaries | `src/server/db/rls.ts`, `tests/unit/rls.test.ts` |
| **Worker / Background** | **Elevation of Privilege** | Auto-release timer exploited on malicious deliverables | Critical | Auto-release exploit guard freezing timer upon adversarial detection | `src/server/jobs/handlers/auto-release.ts` |
| **Database** | **Information Disclosure** | SQL Injection exposing tenant data | High | Drizzle ORM parameterized queries + forced RLS on tenant tables | `src/server/db/rls.ts` |
| **PayPal Rail** | **Tampering** | Stale order authorization / return URL replay | High | Attempt-scoped request IDs (`pp:{id}:fund:{attempt}`) and single-use return `state` | `src/server/funding/funding-state.ts`, `tests/unit/funding-hardening.test.ts` |
| **PayPal Rail** | **Repudiation** | Untracked fund movement / ledger drift | Critical | Dual-key cryptographic authorization barrier & double-entry ledger | `src/server/release/authorizer.ts`, `tests/unit/money.test.ts` |
| **AI / LLM Oracles** | **Tampering** | Prompt injection overriding acceptance criteria | Critical | Multi-pass Red Team scanner, delimiter isolation, code test superiority | `src/server/verify/adversarial.ts`, `tests/unit/adversarial.test.ts` |
| **Email Relay** | **Spoofing / Abuse** | Platform used as phishing/spam relay | Medium | Daily invite caps (5/day for new orgs, 30/day existing), suppression lists, plain-text escaping | `src/server/security/email-abuse.ts`, `tests/unit/urls-and-redirects.test.ts` |

---

## 2. Core Architectural Invariants

1. **Zero Fund Custody:** ProofPay never holds user funds in its own bank accounts. All funds remain in PayPal under `AUTHORIZE` holds.
2. **Deterministic Code Decides:** LLMs are never permitted to authorize payment captures. Pure deterministic code and unit test exit codes govern settlement.
3. **Cryptographic Immutability:** Deliverables and milestone specs are sealed with SHA-256 digests and attested via RFC 3161 timestamps.
