# PostgreSQL Row-Level Security (RLS) Privileged Paths

This document catalogs every legitimate use of `withSystemTx` in the ProofPay codebase, as required by **PLAT-5** and enterprise audit policy.

---

## 1. Privileged Context Rules

`withSystemTx` bypasses tenant-level RLS policies by setting:
```sql
SET LOCAL app.bypass_rls = 'on'
```

### Strict Restrictions:
1. **Forbidden in User-Facing API Route Handlers:** No standard user request may invoke `withSystemTx`. User requests MUST use `withUserTx(userId, ...)`.
2. **ESLint & Code Review Enforcement:** Any new call site must be documented here with justification.
3. **Audit Logging:** Any execution in system mode logs an audit event for forensic traceability.

---

## 2. Catalog of Privileged Paths

| File Path | Function / Context | Justification |
| :--- | :--- | :--- |
| `src/server/jobs/worker.ts` | Background job execution loop | Worker polls across all tenant queues to process auto-release timers, email deliveries, and verification jobs. |
| `src/server/paypal/webhooks.ts` | PayPal Webhook ingestion | Inbound webhooks from PayPal are signed by PayPal, not a logged-in user session. Must look up contracts by external PayPal Order ID across all tenants. |
| `src/server/db/migrations/*` | Database schema migrations | Schema definition and DDL migrations run with administrative database credentials. |
| `src/server/jobs/handlers/auto-release.ts` | Scheduled timer auto-capture | Runs unattended on timer expiry; evaluates deliverable integrity across tenant contracts. |
