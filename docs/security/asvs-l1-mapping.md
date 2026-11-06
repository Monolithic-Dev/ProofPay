# OWASP ASVS Level 1 Compliance Mapping

This document maps ProofPay's security architecture against **32 selected OWASP Application Security Verification Standard (ASVS v4.0.3) Level 1** requirements.

---

| ASVS ID | Category | Requirement Description | Status | Evidence / Implementation File | Test File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **V1.1.1** | Architecture | A secure development lifecycle is followed. | **Implemented** | `.github/workflows/security.yml` | `scripts/self-audit.sh` |
| **V2.1.1** | Authentication | Password minimum length and strength enforced. | **Implemented** | `src/server/auth/credentials.ts` | `tests/unit/policy.test.ts` |
| **V2.1.9** | Authentication | Password entry masks sensitive characters. | **Implemented** | `src/components/security/StepUpDialog.tsx` | Component unit tests |
| **V2.2.1** | Authentication | Generic error messages on login failure (no user enumeration). | **Implemented** | `src/server/auth/credentials.ts` | `tests/unit/policy.test.ts` |
| **V2.3.1** | Authentication | Authenticator rate limits (5 attempts / 15 min). | **Implemented** | `src/server/auth/step-up.ts` | `tests/unit/step-up.test.ts` |
| **V2.4.1** | Authentication | Re-authentication required prior to sensitive transactions. | **Implemented** | `src/server/auth/step-up.ts` | `tests/unit/step-up.test.ts` |
| **V2.8.1** | Authentication | Time-based one-time passwords (TOTP) supported. | **Implemented** | `src/server/auth/step-up.ts` | `tests/unit/step-up.test.ts` |
| **V3.1.1** | Session | Session IDs generated with cryptographically strong RNG. | **Implemented** | `crypto.randomBytes(32)` | `tests/unit/env.test.ts` |
| **V3.2.1** | Session | Session tokens transmitted only via HTTPS. | **Implemented** | `src/server/config/env.ts` | `tests/unit/env.test.ts` |
| **V3.3.1** | Session | Inactive sessions terminate after idle timeout. | **Implemented** | `src/server/auth/step-up.ts` | `tests/unit/step-up.test.ts` |
| **V3.7.1** | Session | Session termination invalidates associated grants. | **Implemented** | Session binding on grants | `tests/unit/step-up.test.ts` |
| **V4.1.1** | Access Control | Enforce access control on server side, not relying on client. | **Implemented** | `src/server/auth/permissions.ts` | `tests/unit/permissions.test.ts` |
| **V4.1.2** | Access Control | Multi-tenant isolation enforced at database level. | **Implemented** | `src/server/db/rls.ts` | `tests/unit/rls.test.ts` |
| **V4.1.3** | Access Control | Principle of least privilege enforced across roles. | **Implemented** | RBAC matrix (`owner`, `admin`, `member`, `guest`) | `tests/unit/permissions.test.ts` |
| **V5.1.1** | Input Validation | Input validated against strict schemas (allowlist approach). | **Implemented** | Zod schemas across API routes | `tests/unit/contract-schema.test.ts` |
| **V5.1.3** | Input Validation | Input validation failures reject rather than sanitize. | **Implemented** | Zod parse rejections | `tests/unit/contract-schema.test.ts` |
| **V5.1.4** | Input Validation | Structured data conforms to machine-checkable schemas. | **Implemented** | `src/server/verify/schemas/*` | `tests/unit/deterministic-checks.test.ts` |
| **V5.2.1** | Sanitization | User-supplied data in emails is plain-text escaped. | **Implemented** | `src/server/security/email-abuse.ts` | `tests/unit/urls-and-redirects.test.ts` |
| **V5.3.1** | Injection | Parameterized queries prevent SQL Injection. | **Implemented** | Drizzle ORM query builder | `tests/unit/rls.test.ts` |
| **V5.3.3** | Injection | HTML output encoding prevents Cross-Site Scripting (XSS). | **Implemented** | React JSX auto-escaping + CSP | `tests/unit/csp.test.ts` |
| **V5.3.7** | Injection | Server-Side Request Forgery (SSRF) blocked by IP filter. | **Implemented** | `src/server/net/safe-fetch.ts` | `tests/unit/ip.test.ts` |
| **V5.5.1** | Injection | Prompt injection payloads sanitized before evaluation. | **Implemented** | `src/server/verify/adversarial.ts` | `tests/unit/adversarial.test.ts` |
| **V6.2.1** | Cryptography | Strong cryptographic hashing algorithms (SHA-256, HMAC). | **Implemented** | `src/server/auth/api-key-hardening.ts` | `tests/unit/api-key-hardening.test.ts` |
| **V6.2.5** | Cryptography | Cryptographic keys salted / peppered. | **Implemented** | `API_KEY_PEPPER` | `tests/unit/api-key-hardening.test.ts` |
| **V7.1.1** | Error Handling | Error messages never disclose stack traces or secrets. | **Implemented** | Standardized error wrappers | `tests/unit/errors.test.ts` |
| **V8.1.1** | Data Protection | Personally Identifiable Information (PII) masked in logs. | **Implemented** | `src/server/util/pii.ts` | `tests/unit/pii.test.ts` |
| **V10.1.1** | Malicious Code | Outbound network requests subject to size and time caps. | **Implemented** | `src/server/net/safe-fetch.ts` | `tests/unit/safe-fetch-net.test.ts` |
| **V11.1.1** | Business Logic | Transaction idempotency prevents double capture/release. | **Implemented** | `pp:{id}:fund:{attempt}` keys | `tests/unit/funding-hardening.test.ts` |
| **V11.1.2** | Business Logic | Auto-release timers frozen upon anomalous deliverables. | **Implemented** | Auto-release exploit guard | `src/server/jobs/handlers/auto-release.ts` |
| **V13.1.1** | API | API keys support CIDR allow-listing and automatic rotation. | **Implemented** | `src/server/auth/api-key-hardening.ts` | `tests/unit/api-key-hardening.test.ts` |
| **V13.2.1** | API | Abuse-limiting and sliding-window rate limiting. | **Implemented** | `src/server/util/rate-limit.ts` | `tests/unit/rate-limit.test.ts` |
| **V14.4.1** | Configuration | Content Security Policy (CSP) with nonces enforced. | **Implemented** | `src/server/security/csp.ts` | `tests/unit/csp.test.ts` |
