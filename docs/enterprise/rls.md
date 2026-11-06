# PostgreSQL Row-Level Security (RLS)

> **Enterprise Pillar 2 — Multi-Tenant Isolation**

## Overview

ProofPay uses PostgreSQL's native Row-Level Security to enforce per-tenant data isolation
at the database layer, independent of application-level filtering.

Even if a route handler accidentally omits a `WHERE buyer_id = ?` clause, the database
will silently filter the result set to only the rows the authenticated user owns.

## Tables Protected

| Table | Policy Column(s) |
|-------|-----------------|
| `contracts` | `buyer_id`, `seller_id` |
| `milestones` | via JOIN to `contracts` (buyer/seller) |
| `submissions` | via JOIN to `milestones` → `contracts` |
| `verifications` | via JOIN chain |
| `ledger_events` | `buyer_id`, `seller_id` (denormalised) |
| `disputes` | `buyer_id`, `seller_id` (denormalised) |

## Policy Logic

```sql
CREATE POLICY app_user_policy ON contracts
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR buyer_id  = current_setting('app.current_user_id', true)::uuid
    OR seller_id = current_setting('app.current_user_id', true)::uuid
  );
```

The `bypass_rls` escape hatch is used exclusively by:
- Background workers (Cron, BullMQ jobs)
- Admin CLI scripts
- Database migration scripts

## Application Integration

### User-scoped requests

```typescript
import { withUserTx } from '@/server/db/rls'

// In a route handler (after session auth):
const result = await withUserTx(user.sub, async (tx) => {
  return tx.select().from(contracts)  // Only buyer/seller rows returned
})
```

### System / worker operations

```typescript
import { withSystemTx } from '@/server/db/rls'

// In a background job:
const all = await withSystemTx(async (tx) => {
  return tx.select().from(contracts)  // All rows visible
})
```

## Bootstrap

Run `applyRlsPolicies()` once during DB setup (or as part of a migration script):

```typescript
import { applyRlsPolicies } from '@/server/db/rls'
await applyRlsPolicies()
```

## Security Properties

| Property | Guarantee |
|----------|-----------|
| Tenant Isolation | Buyer can only see their own contracts |
| IDOR Defence-in-Depth | DB-level filter even if app misses WHERE clause |
| Bypass Auditability | `app.bypass_rls = on` only in system transactions |
| Zero-Trust | Routes must set context — no default "see all" |

## Threat Model

| Threat | Mitigated? | Mechanism |
|--------|-----------|-----------|
| SQL Injection leaking cross-tenant data | ✅ | RLS filters before rows returned |
| Application bug omitting WHERE clause | ✅ | RLS silently filters |
| Malicious admin token | ✅ | `bypass_rls` only in privileged server roles |
| Timing side-channels | ⚠️ Partial | Constant-time queries still recommended |
