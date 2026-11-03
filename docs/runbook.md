# ProofPay Operational Runbook

This document details secret rotation procedures, rate limit and quota monitoring, dependency risk acceptance, and incident response procedures for the ProofPay platform.

---

## 1. Secret Rotation Procedures

### 1.1 PayPal App Secret Rotation
1. **Navigate to PayPal Developer Dashboard**:
   - Access **Apps & Credentials** → Select active ProofPay app (Sandbox / Live).
2. **Generate New Secret**:
   - Click **Generate New Secret** to create a second active credential.
3. **Update Staging / Production Environment Variables**:
   - Update `PAYPAL_CLIENT_SECRET=<new_secret>` in production secret manager (e.g., AWS Secrets Manager, Doppler, or Fly secrets).
   - Trigger rolling deployment of application and worker instances.
4. **Verify Functionality**:
   - Run health check: `GET /api/v1/health`.
   - Execute one test capture / verification in sandbox: `npm run chaos -- --case C01`.
5. **Revoke Old Secret**:
   - Return to PayPal Developer Dashboard and delete the retired secret.

### 1.2 PayPal Webhook ID Rotation
1. In PayPal Developer Dashboard, navigate to **Webhooks** → Create webhook pointing to `https://<domain>/api/v1/webhooks/paypal` subscribing to:
   - `PAYMENT.AUTHORIZATION.CREATED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
2. Note the generated Webhook ID.
3. Update `PAYPAL_WEBHOOK_ID=<new_webhook_id>` in the production environment.
4. Redeploy and monitor `/api/v1/webhooks/paypal` endpoint for incoming events.
5. Delete the previous webhook subscription in PayPal.

### 1.3 Application Session Secret (`SESSION_SECRET`)
- ProofPay uses Jose HS256 JWTs with a 12-hour expiration for session cookies.
- To rotate:
  1. Generate a fresh 32+ byte cryptographic secret: `openssl rand -hex 32`.
  2. Set `SESSION_SECRET` in environment and restart app containers.
  3. Existing sessions will expire immediately; users re-authenticate via `/api/v1/auth/demo-login` or OAuth.

---

## 2. LLM Quota, Budget & Fail-Safe Controls

### 2.1 Provider Limits & Monitoring
- **Anthropic API Limit**:
  - Set hard monthly and daily spend limits in Anthropic Console settings.
  - Runtime enforcement: ProofPay tracks daily spend in `llm_calls` table and enforces `LLM_DAILY_BUDGET_USD` (default $25/day).
- **Graceful Verifier Escalation**:
  - When LLM budget is exhausted or provider returns 429/500, `src/server/verify/service.ts` catches `VerifierUnavailableError` and flags the milestone with `VERIFIER_UNAVAILABLE`.
  - The milestone status changes to `ESCALATED_TO_HUMAN`, alerting the buyer rather than falsely passing or silently failing.

---

## 3. Incident Response Playbooks

### 3.1 Stuck Milestone Release (`RELEASING` or `RELEASE_FAILED`)
1. **Symptom**: Milestone remains in `RELEASING` status > 5 minutes or transitions to `RELEASE_FAILED` after a transient PayPal outage.
2. **Triage**:
   - Check contract ledger: `GET /api/v1/contracts/:id/ledger`.
   - Inspect PayPal events table for corresponding capture IDs.
3. **Remediation**:
   - Trigger manual reconciliation via Admin API:
     ```bash
     curl -X POST https://api.proofpay.io/api/v1/admin/reconcile \
       -H "Authorization: Bearer <ADMIN_API_KEY>" \
       -H "Content-Type: application/json" \
       -d '{"contract_id": "<contract_uuid>"}'
     ```
   - Alternatively, human buyer can click "Retry Release" in the Studio Console UI (`POST /api/v1/contracts/:id/milestones/:mid/retry-release`).

### 3.2 Double-Capture Prevention Invariant
- **Invariant**: The sum of captured minor amounts on any PayPal authorization MUST NOT exceed the authorized total. Each milestone may be captured at most once (`final_capture: true` on the final milestone).
- If PayPal webhook reports a duplicate capture or if an unexpected `CAPTURE_REQUESTED` event fires:
  1. The idempotency guard in `src/server/release/service.ts` rejects any secondary release attempt with `ALREADY_RELEASED`.
  2. Database constraint on milestone releases prevents double record insertion.
  3. If inconsistency is suspected, verify hash chain: `GET /api/v1/contracts/:id/ledger/verify`.

### 3.3 Database Reconnection & Deadlock Recovery
- Postgres connection pool uses exponential backoff reconnection.
- If a deadlock or connection blip occurs:
  - Client receives 503 `SERVICE_UNAVAILABLE`.
  - Background worker resumes uncommitted outbox jobs on next poll interval (500ms).

---

## 4. Accepted Upstream Dependency Advisories

Audited via `npm audit --omit=dev`:
1. **Next.js (`GHSA-g5qg-72qw-gw5v`, `GHSA-4342-x723-ch2f`, etc.)**:
   - *Mitigation*: ProofPay does not utilize Next.js Image Optimization API endpoints (`next/image`), and edge runtime server functions are disabled. Full CSP and strict origin checks are enforced in `next.config.ts`.
2. **Drizzle ORM (`GHSA-gpj5-g38j-94v9`)**:
   - *Mitigation*: All SQL queries are strictly compiled with typed schema bindings and parameterized arguments. No dynamic SQL identifiers or unescaped user inputs are passed to raw SQL fragments.
3. **Zod (`GHSA-mrhx-c7xc-m3w5`)**:
   - *Mitigation*: `src/server/http/handler.ts` enforces a strict 50KB request body size cap and a maximum JSON nesting depth of 20 (`PAYLOAD_TOO_DEEP`) *prior* to invoking Zod parsing.
