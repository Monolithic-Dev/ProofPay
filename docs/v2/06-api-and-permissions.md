# 06 — API & Permissions (v2 additions)

> Base path `/api/v1` for product APIs; Better Auth serves `/api/auth/*` (sign-up, sign-in, sign-out, verify, reset, session, two-factor, organization, admin). Existing contract/funding/submission/ledger endpoints in `api-spec.md` are unchanged except **authorization** (below).

## 1. Authorization model for every endpoint

Each route declares a permission string and (optionally) a resource loader:
```ts
export const POST = apiHandler(
  { auth: 'user', permission: 'contract:propose', resource: loadContract, body: ProposeBody, idempotent: true },
  async ({ actor, resource, body }) => proposeContract(resource.id, actor, body)
);
```
`auth` ∈ `none | user | service_account | user_or_service | staff`. The wrapper: authenticates (session cookie, Bearer key, or staff session) → requires verified email for user actors on write routes → resolves the **active organization** → loads the resource → calls `can(actor, permission, resource)` → executes. A CI test enumerates `src/app/api/v1/**/route.ts` and **fails if a handler has no `permission`** (explicit `permission: 'public'` allowed for public routes).

**Errors added:**

| Code | HTTP | When |
|---|---|---|
| `EMAIL_NOT_VERIFIED` | 403 | write attempt by an unverified user |
| `ORG_REQUIRED` | 409 | no active organization on the session |
| `FORBIDDEN` | 403 | actor is a party/member but lacks permission; details `{required_permission, your_role}` |
| `MFA_REQUIRED` | 403 | policy requires MFA enrollment (R2) |
| `APPROVAL_REQUIRED` | 409 | funding above threshold without an approved request |
| `PAYPAL_NOT_CONNECTED` | 409 | org lacks an active PayPal connection for the required action (R2) |
| `INVITE_EXPIRED` / `INVITE_REVOKED` / `INVITE_EMAIL_MISMATCH` | 410 / 410 / 403 | invitation problems |
| `SERVICE_ACCOUNT_CAP_EXCEEDED` | 403 | caps exceeded |
| `SCOPE_REQUIRED` | 403 | key lacks a scope; details `{scope}` |
| `IMPERSONATION_READ_ONLY` | 403 | write while impersonating |
| `LAST_OWNER` | 409 | removing/demoting the last Owner |

**404 vs 403:** no relationship to the resource → `404`; related but not permitted → `403 FORBIDDEN`.

## 2. Identity and workspace

| Method & path | Auth | Permission | Rel | Purpose |
|---|---|---|---|---|
| `GET /me` | user | public | R1 | `{user, email_verified, activeOrganization:{id,name,slug}, role, permissions[], memberships[], mfa_enabled, needs:{verify_email, org, onboarding}}` |
| `PATCH /me` | user | self | R1 | name, timezone |
| `GET /me/export` | user | self | R1 | JSON export |
| `GET /me/sessions` / `DELETE /me/sessions/{id}` | user | self | R1 | list/revoke (wrapping the auth library) |
| `GET /orgs/current` | user | `member:read` | R1 | org + settings + paypal connection summary |
| `PATCH /orgs/current/settings` | user | `organization:update` | R1 | threshold, defaults, toggles |
| `GET /orgs/current/members` | user | `member:read` | R1 | members + pending invitations |
| `POST /orgs/current/invitations` | user | `member:invite` | R1 | `{emails[], role, message?}` (wraps library; enqueues email) |
| `PATCH /orgs/current/members/{id}` | user | `member:update_role` | R1 | role change; `LAST_OWNER` guard |
| `DELETE /orgs/current/members/{id}` | user | `member:remove` | R1 | remove |
| `POST /orgs/current/transfer-ownership` | user | `organization:delete` | R1 | `{new_owner_user_id, password}` |
| `GET /orgs/current/paypal-connection` | user | `paypal:read` | R1 | mode/status/explanation |
| `POST /orgs/current/paypal-connection/start` | user | `paypal:connect` | R2 | returns partner onboarding URL |
| `GET /orgs/current/audit` | user | `audit:read` | R1 | filters `actor, action, from, to`, cursor pagination |

## 3. Contracts, collaboration, funding

| Method & path | Auth | Permission | Rel | Notes |
|---|---|---|---|---|
| `GET /templates` | user | `template:read` | R1 | system + org templates |
| `POST /templates` | user | `template:write` | R1 | save as template (from contract) |
| `POST /contracts` | user_or_service | `contract:create` (`contracts:write`) | R1 | `{template_id, variables}` or `{blank:true}`; compile stays `POST /contracts/compile` |
| `GET /contracts` | user_or_service | `contract:read` (`contracts:read`) | R1 | now org-scoped: either side; filters `status, side, counterparty, q, cursor` |
| `GET /contracts/{id}` | same | `contract:read` | R1 | adds `side`, `my_permissions` for UI |
| `PATCH /contracts/{id}` | user_or_service | `contract:update` | R1 | draft only; autosave |
| `POST /contracts/{id}/send` | user_or_service | `contract:propose` | R1 | `{counterparty:{email,name} \| counterparty_id}`; creates version + invitation + email (replaces `propose` + `seller_email`) |
| `GET /contracts/{id}/versions` | user | `contract:read` | R1 | versions with hashes |
| `GET /contract-invitations/{token}` | none | public | R1 | public preview (title, total, inviter org, expiry) — no sensitive data |
| `POST /contract-invitations/{token}/accept` | user | `contract:accept` | R1 | `{organization_id}` (acting org); email must match; sets seller org; transitions as `acceptContract` |
| `POST /contract-invitations/{token}/decline` | user | `contract:decline` | R1 | `{reason}` |
| `POST /contracts/{id}/invitations/resend` / `.../revoke` | user | `contract:propose` | R1 | rate limited |
| `GET/POST /contracts/{id}/comments` | user | `contract:comment` | R1 | cursor pagination |
| `POST /contracts/{id}/funding-approvals` | user | `funding:request_approval` | R1 | requester creates approval |
| `POST /funding-approvals/{id}/decision` | user | `funding:approve` | R1 | `{decision, note}`; approver ≠ requester |
| `POST /contracts/{id}/fund` | user_or_service | `funding:authorize` (`funding:link`) | R1 | enforces threshold/approval; service accounts get a link only |
| `POST /contracts/{id}/cancel` | user | `contract:cancel` | R1 | `forbidAgent` |
| Existing: `submissions`, `decision`, `retry-release`, `refund`, `ledger`, `proof-pack`, `events` | various | `submission:create`, `escalation:decide`, `release:retry`, `payment:refund`, `contract:read` | R1 | permission strings now declared per route |

## 4. Payments, inbox, notifications, search

| Method & path | Auth | Permission | Rel | Purpose |
|---|---|---|---|---|
| `GET /inbox` | user | `contract:read` | R1 | `{items:[{type, contract_id, milestone_key?, title, counterparty, due_at?, action}]}` computed per org and role |
| `GET /payments/summary` | user | `payment:read` | R1 | `{held_minor, released_minor_month, voided_minor, refunded_minor, at_risk_minor}` |
| `GET /payments` | user | `payment:read` | R1 | rows by capture/hold with filters |
| `GET /payments/{captureId}/receipt` | user | `payment:read` | R1 | JSON (PDF R2) |
| `GET /notifications` / `POST /notifications/read` | user | self | R1 | list, mark read (ids or all) |
| `GET/PUT /notification-preferences` | user | self | R1 | matrix |
| `GET /search?q=` | user | `contract:read` | R1 (S) | contracts, counterparties, templates, members |
| `GET /counterparties` / `POST` / `PATCH` / `DELETE` | user | `counterparty:manage` (read: `contract:read`) | R1 | directory |
| `POST /support/tickets` | user or none | public (rate limited) | R1 | contact form |

## 5. Developers

| Method & path | Auth | Permission | Rel | Purpose |
|---|---|---|---|---|
| `GET/POST /service-accounts` | user | `serviceaccount:manage` | R1 | create with name, scopes, caps |
| `PATCH/DELETE /service-accounts/{id}` | user | `serviceaccount:manage` | R1 | update, disable |
| `POST /service-accounts/{id}/keys` | user | `apikey:manage` | R1 | returns secret once |
| `DELETE /service-accounts/{id}/keys/{keyId}` | user | `apikey:manage` | R1 | revoke |
| `GET /webhook-endpoints` etc. | user | `webhook:manage` | R2 | outbound webhooks |
| `GET /openapi.json` | none | public | R2 | generated spec |

**Scope → endpoint mapping (service accounts):** `contracts:read` → GETs on contracts, versions, comments (read), inbox; `contracts:write` → create, patch, send, comments (write), lint, compile; `submissions:write` → submissions; `verifications:read` → verification GETs; `ledger:read` → ledger, proof-pack, events; `funding:link` → `POST /contracts/{id}/fund` returning the approval URL. Everything else → `403 SCOPE_REQUIRED` or `403 FORBIDDEN_FOR_AGENT`.

## 6. Staff/admin

| Method & path | Auth | Permission | Rel |
|---|---|---|---|
| `GET /admin/search?q=` | staff | `staff:read` | R1 |
| `GET /admin/contracts/{id}` | staff | `staff:read` | R1 (state, ledger, verifications, jobs, PayPal ids, emails) |
| `POST /admin/contracts/{id}/reconcile` | staff | `staff:support` | R1 |
| `POST /admin/emails/{id}/resend` | staff | `staff:support` | R1 |
| `GET /admin/jobs` | staff | `staff:read` | R1 |
| `POST /admin/users/{id}/ban` / `unban` / `revoke-sessions` | staff | `staff:admin` | R2 |
| `POST /admin/impersonate` / `stop` | staff | `staff:support` (ticket id required) | R2 |
| `PUT /admin/flags/{key}` | staff | `staff:admin` | R2 |

## 7. Conventions

- **Pagination:** cursor-based (`?cursor=&limit=` default 25, max 100), response `{items, next_cursor}`.
- **Filtering:** explicit query params; unknown params → `400 VALIDATION_FAILED`.
- **Idempotency:** `Idempotency-Key` on fund, send, submissions, decision, retry-release, refund, invitation accept, approval decision.
- **Rate limits (per user unless noted):** `send` 30/h, `comments` 60/h, `search` 120/min, `support/tickets` 5/h/IP, invitation resend 5/h/contract.
- **Org scoping:** every list endpoint filters by the session's active org (or the service account's org) — never by an `org_id` parameter.
- **Events for UI/agents:** `GET /contracts/{id}/events` (SSE) as before; add `GET /me/events` (SSE) for notifications and inbox invalidation.

## 8. Outbound webhooks (R2 outline)

Event types: `contract.sent, contract.accepted, contract.funded, submission.received, verification.completed, milestone.released, release.failed, contract.completed, contract.failed, contract.cancelled`. Delivery: `POST` JSON `{id, type, created_at, data}` with headers `ProofPay-Event`, `ProofPay-Delivery`, `ProofPay-Signature: t=<unix>,v1=<hex hmac-sha256(secret, t + '.' + body)>`; retries at 1 m, 5 m, 30 m, 2 h, 12 h; endpoint auto-disabled after 48 h of failures; replay protection window 5 minutes; deliveries logged and visible to the org.
