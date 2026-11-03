# Degraded-Mode & Failure Drills Log

This document records the empirical results of failure drills 1–5 as required by ProofPay Phase 8 specification (§8.5) and `testing.md`.

**Date:** 2026-11-03  
**Environment:** Local testbed / Staging Docker Postgres (Port 5434)  
**Operator:** Lead Engineer / Automated Suite  
**Test Suite:** `tests/integration/degraded.test.ts`

---

## Drill 1: Daily LLM Budget Exhaustion

- **Objective:** Verify that when daily LLM budget is exceeded, new contract compilations fail fast with HTTP 429 (`BUDGET_EXCEEDED`), while existing verification pipelines gracefully escalate to human review (`VERIFIER_UNAVAILABLE`) rather than producing false passes.
- **Procedure:**
  1. Configured `LLM_DAILY_BUDGET_USD=0.01`.
  2. Submitted compile request to `POST /api/v1/contracts/compile`.
  3. Submitted milestone verification with semantic rubric criteria.
- **Observed Result:**
  - **Compile Route:** Returned HTTP `429 Too Many Requests` with payload `{"error":{"code":"BUDGET_EXCEEDED","message":"Daily LLM budget exceeded. Try again tomorrow."}}`.
  - **Verification Pipeline:** Rubric stage flagged `unavailable: true`; Stage 4 Policy Engine applied Rule 4 and transitioned milestone to `ESCALATED_TO_HUMAN` with reason code `VERIFIER_UNAVAILABLE`.
- **Verdict:** **PASS** (Zero false passes; system failed closed and escalated).

---

## Drill 2: Upstream LLM Transport Outage (500 Error / Revoked API Key)

- **Objective:** Verify that when the Anthropic Messages API drops or throws HTTP 500 errors, deterministic criteria checks continue to function and reject invalid deliverables without invoking the LLM or failing open.
- **Procedure:**
  1. Simulated Anthropic network outage throwing 500 Internal Server Error.
  2. Submitted an artifact failing the deterministic row count criterion (`min_row_count`).
  3. Evaluated multi-stage pipeline verdict.
- **Observed Result:**
  - Stage 1 Deterministic Engine detected `det_row_count` failure (`passed: false`).
  - Stage 2 Rubric caught the upstream error, returning `unavailable: true`.
  - Stage 4 Policy Engine evaluated Rule 1 before Rule 4: Rule 1 triggered an immediate `REJECT` decision with reason `DET_FAIL`.
- **Verdict:** **PASS** (Deterministic rejection invariants hold unconditionally even during full AI provider outages).

---

## Drill 3: Worker Process Termination (`kill -9`) Mid-Release

- **Objective:** Verify that terminating the worker process while a milestone release job is claimed does not cause a double capture or leave the contract permanently wedged.
- **Procedure:**
  1. Enqueued a release job in `job_outbox`.
  2. Claimed job via `claimNextJob()`, setting status to `RUNNING` with `locked_at`.
  3. Simulated ungraceful worker termination (`SIGKILL`).
  4. Advanced lock expiry and executed `reclaimStaleLocks()` on worker restart.
- **Observed Result:**
  - Stale lock reclaimed successfully (`RUNNING` reverted to `PENDING` with incremented `attempts`).
  - Restarted worker re-polled the pending job.
  - Idempotency key (`proofpay:release:<milestone_id>:<attempt>`) sent to PayPal prevented duplicate capture; release concluded with exactly one capture event on the ledger.
- **Verdict:** **PASS** (0 double captures; resilient to hard process termination).

---

## Drill 4: Outbound PayPal Network Partition During Funding / Hold

- **Objective:** Verify graceful recovery when network connectivity to `api.sandbox.paypal.com` is interrupted during order creation or authorization hold capture.
- **Procedure:**
  1. Injected simulated network timeout / DNS failure on PayPal client calls.
  2. Attempted contract funding initiation `POST /api/v1/contracts/:id/fund`.
- **Observed Result:**
  - PayPal client caught socket connection failure and returned 502 `PAYPAL_ERROR` with structured diagnostic request id.
  - Database contract status remained safely in `ACCEPTED` (no partial funding state).
  - Contract can be safely retried once network connectivity is restored.
- **Verdict:** **PASS** (No orphaned authorization states; clean error response).

---

## Drill 5: Disabled PayPal Webhooks & Scheduled Reconciliation Recovery

- **Objective:** Verify that if inbound PayPal webhooks fail to arrive (e.g. webhook endpoint down or firewall misconfiguration), the background reconciliation scheduler detects the completed capture and finalizes the release within 5 minutes.
- **Procedure:**
  1. Simulated capture completion on PayPal side without firing the webhook to `/api/v1/webhooks/paypal`.
  2. Enqueued reconciliation job `RECONCILE_PAYPAL` in `job_outbox`.
  3. Restarted worker and polled outbox.
- **Observed Result:**
  - Outbox job claimed by worker immediately on startup.
  - `handleReconcilePaypal` queried PayPal Order status, detected `COMPLETED` capture, inserted the corresponding capture event into `ledger_events`, and transitioned milestone to `RELEASED`.
  - Final milestone capture closed the authorization cleanly.
- **Verdict:** **PASS** (Full eventual consistency achieved independently of webhook delivery).

---

## Summary Matrix

| Drill ID | Failure Mode | Expected Behavior | Observed Result | Status |
|---|---|---|---|---|
| **D01** | LLM Daily Budget Exhausted | Compile 429; Verifier escalates with `VERIFIER_UNAVAILABLE` | HTTP 429; `ESCALATED_TO_HUMAN` | **PASS** |
| **D02** | LLM API Outage (500) | Deterministic criteria reject unconditionally | Immediate `REJECT` (`DET_FAIL`) | **PASS** |
| **D03** | Worker `kill -9` Mid-Release | Outbox lock reclaimed; 0 double captures | Lock recovered; 1 capture recorded | **PASS** |
| **D04** | PayPal Network Partition | Clean 502; contract remains in `ACCEPTED` | Status preserved; retryable | **PASS** |
| **D05** | Dropped PayPal Webhooks | Outbox sweeps catch up within scheduled cycle | Outbox executed; milestone `RELEASED` | **PASS** |
