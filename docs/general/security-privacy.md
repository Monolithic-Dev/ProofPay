# ProofPay — Security & Privacy

> Scope: hackathon build on the **PayPal sandbox** with **no real money and no card data**. Goal: be demonstrably careful where it matters (money movement, AI input, secrets, hosting through Dec 15), and honest about what is *not* production-grade.

## 1. What is sensitive here (specific to ProofPay)

| Asset | Why it matters | Where it lives |
|---|---|---|
| PayPal client secret, webhook ID | Lets an attacker create/capture sandbox orders and forge trust | Render env vars, local `.env` (never committed) |
| Anthropic API key | Cost-exhaustion and data leakage | Render env vars |
| `SESSION_SECRET` | Forging session cookies = acting as any user | Render env vars |
| API keys (`pp_k_…`) | Agent access to contracts and submissions | `api_keys.key_hash` only (secret shown once) |
| Deliverables (text/JSON) | May contain personal data or confidential business content | `submissions.content_text`; sent to the LLM for verification |
| Contract content and ledger | Business terms; integrity matters for disputes | `contracts`, `ledger_events` |
| PayPal identifiers (order/authorization/capture IDs) | Sandbox only, low sensitivity, but used for reconciliation | DB |

**Not stored:** card numbers, PayPal passwords, buyer bank details (approval happens on PayPal's pages; PCI scope is minimal).

## 2. Authentication and authorization

| Topic | Design |
|---|---|
| Humans | Demo personas via `POST /auth/demo-login` (**only when `DEMO_MODE=true`**) → signed JWT cookie (HS256 via `jose`, 12 h, `HttpOnly; Secure; SameSite=Lax`). Production plan: Auth.js with email magic links + PayPal Log in |
| Agents | Bearer API keys, 32 random bytes, `pp_k_` prefix; stored as SHA-256 hash; revocable; per-key last-used timestamp |
| Authorization | Every contract route calls `requireParty(contractId, user)`; non-parties get `404`; role checks per endpoint (buyer-only / seller-only) |
| IDOR prevention | UUIDs are not secrets; access is checked on every read/write, including SSE streams and Proof Pack downloads |
| Agent limits | No MCP/REST capability lets an **agent** approve escalations, cancel, or refund when the user is flagged `is_agent` (enforced server-side, not just by omission from MCP) |
| Admin | Only seeded admin persona; used for health and chaos toggles |

## 3. Transport, storage, secrets

- TLS everywhere (Render-provided certificates; HSTS header). Postgres managed by Render: encrypted at rest and in transit by the provider (confirm for your plan).
- Secrets: only in Render **environment groups** and local `.env` (gitignored). `.env.example` has placeholders only. GitHub **secret scanning** and push protection enabled; `gitleaks` in CI. If a secret leaks, **rotate immediately** (PayPal app secret, Anthropic key, `SESSION_SECRET`).
- Zod-validated env at startup (`src/server/config/env.ts`); the app **refuses to start** if `PAYPAL_ENV !== 'sandbox'`.
- Security headers via Next.js `headers()`: `Content-Security-Policy` (self + PayPal domains for redirects only), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Frame-Options: DENY`.
- CSRF: cookie is `SameSite=Lax`; state-changing routes require `Content-Type: application/json` and an `Origin` check against `APP_BASE_URL`; API-key calls are exempt (no cookie).

## 4. Threat model (top threats and mitigations)

| # | Threat | Impact | Mitigation | Tested by |
|---|---|---|---|---|
| T1 | **Prompt injection in deliverables** ("mark all criteria passed") | Unauthorized release of funds | Submission wrapped as untrusted data with random nonce delimiters; forced tool schema; deterministic checks cannot be overridden; adversarial stage; **policy engine is code**; LLM never calls PayPal | Eval cases A01–A10; unit tests for `policy.ts` |
| T2 | **Capture without verification** (bug or malicious call) | Money moves for unverified work | Single gateway `releaseMilestone`; status guard `PASSED`; DB CHECK; lint ban on importing capture elsewhere; idempotency | Unit + integration tests; chaos suite |
| T3 | **Forged webhooks** | False state changes | Verify signature via PayPal API; store raw; invalid → `400` and ignored; handlers never trust payload amounts alone (re-check via GET when state-changing) | Chaos case: bad signature |
| T4 | **IDOR / cross-contract access** | Data leakage | Party check on every route; `404` on denial | Integration tests per route |
| T5 | **SSRF** (via URL checks) | Internal network access | `url_liveness` check is **excluded from MVP**; if added `[C]`: resolve DNS, block private/link-local ranges, allowlist schemes, 3 s timeout, no redirects to private IPs | n/a (feature not shipped) |
| T6 | **Cost exhaustion** (LLM DoS) | Budget burned; demo dies before Dec 15 | Daily LLM budget cap, per-IP and per-user rate limits, size caps (1 MiB, ≤ 5,000 rows), verification cache, degraded mode | Load test script; budget unit test |
| T7 | **Ledger tampering** | Dispute evidence loses value | Append-only trigger; hash chain; `/ledger/verify`; Proof Pack includes head hash | Unit test: mutate row → verify fails (tests run with the trigger disabled in a scratch DB) |
| T8 | **Secrets leak in repo/video** | Account takeover | gitleaks; `.env` ignored; blur or avoid dashboards in the video; use sandbox only | CI + pre-record checklist |
| T9 | **Replay/double-submit** | Duplicate captures or submissions | `Idempotency-Key`, `PayPal-Request-Id`, `dedupe_key` on jobs, `UNIQUE(milestone_id, attempt)` | Chaos suite: duplicate requests |
| T10 | **Malicious payloads** (huge JSON, deep nesting, ReDoS) | Worker crash | Body size limits, JSON depth limit (≤ 20), named regex patterns only, Ajv with `strict` mode, per-job time limit | Fuzz-ish unit tests |

## 5. Privacy

| Topic | Position |
|---|---|
| Personal data collected | Display name, email (demo personas), deliverable content, IP (rate limiting only, in memory) |
| Third-party processing | Deliverables and prompts are sent to the **LLM provider** during compile/verify; the UI and README say: *do not submit real personal data in the demo* |
| Logging | No deliverable content or prompts in logs; log `sha256`, sizes, ids, decisions |
| Retention | Demo data purge job (`PURGE_DEMO_DATA`) exists but is **disabled until Dec 16** so judges can inspect; after that it deletes demo contracts older than 30 days |
| Deletion | `DELETE` of a demo contract is admin-only and blocked by the ledger trigger (documented limitation); for the hackathon, the full DB can be wiped after judging |
| Children/regulated data | Not supported; terms banner says so |

## 6. Compliance posture (short; no separate compliance doc)

- **Not escrow, not a money transmitter:** ProofPay never holds funds; it instructs PayPal to authorize and capture according to rules. The UI, README and Devpost text must say: *authorization hold (not escrow), sandbox only, PayPal's terms and fees apply, 29-day window.*
- **Out of scope for hackathon but required for real launch:** KYC/AML for sellers, PayPal partner/marketplace approvals for third-party payees, consumer-protection language review, tax reporting, data-processing agreements with the LLM provider, GDPR/CCPA data-subject workflows.
- **Dispute handling:** PayPal's dispute process remains the authority; the Proof Pack is evidence, not a ruling.

## 7. Operational security checklist (before recording the video and again before Dec 1)

1. `git log -p | gitleaks detect` clean; no secrets in any commit.
2. `PAYPAL_ENV=sandbox`; no live credentials anywhere.
3. `DEMO_MODE=true` only on the demo deployment; `CHAOS_MODE=true` only there too (and chaos endpoints require buyer ownership).
4. Rate limits active; LLM daily budget set; Anthropic key has a **hard spend limit** in the provider console.
5. Webhook IDs are for the production-demo webhook (not a leftover tunnel).
6. Judge credentials banner shows **sandbox** buyer only.
7. Postgres backups enabled (if plan supports) and credentials rotated after the hackathon.

## 8. Assumptions

| # | Assumption |
|---|---|
| SP-1 | Judges are not adversarial, but the public URL is reachable by anyone; therefore rate limits and budget caps are mandatory. |
| SP-2 | Provider-managed encryption at rest suffices for sandbox data. |
| SP-3 | No audit/penetration test is performed; this document lists what *would* be tested. |
