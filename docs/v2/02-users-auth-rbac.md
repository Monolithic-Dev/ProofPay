# 02 — Users, Authentication, Organizations & RBAC

> Replaces the demo-persona auth in `api-spec.md` §2/§4 and `security-privacy.md` §2. **Server-side enforcement is authoritative**; the UI only hides what a user cannot do.

## 1. Actor catalog

| Actor | Who | Authenticates with | Belongs to | Primary capabilities |
|---|---|---|---|---|
| **Visitor** | anyone | – | – | Marketing site, docs, `/demo` playground |
| **Org Owner** | founder/agency owner | email+password / Google; MFA optional (R1) | 1+ orgs | Everything in the org incl. delete org, transfer ownership |
| **Org Admin** | ops lead | same | org | Manage members, settings, contracts, API keys; no delete/transfer |
| **Finance** | finance approver | same | org | View payments; approve and authorize funding; issue refunds (seller side); no member management |
| **Member** | requester / contributor | same | org | Create/edit contracts, comment, submit deliverables (seller side), review (buyer side) within policy |
| **Viewer** | accountant/auditor | same | org | Read-only on contracts, payments, audit |
| **Invited counterparty** | external party invited by email | invitation link → sign-up/sign-in with the invited email | gets/creates an org on accept | View the contract they're invited to, discuss, accept/decline |
| **Service account** | agent/integration | API key (`pp_k_…`) scoped | org | Only the scopes granted; never approves, cancels, refunds or moves money |
| **Support (staff)** | ProofPay support | staff login + MFA required | platform | Read-only inspector of contracts, ledger, jobs; resend emails; trigger reconcile |
| **Platform admin (staff)** | ProofPay admin | staff login + MFA required | platform | Support powers + ban users, manage flags, re-run jobs, read-only impersonation |

Orgs have **no fixed type**. One org can buy on one contract and sell on another. Permissions are role-based and checked in the context of the org's **side** on a contract.

## 2. Authentication stack (decision)

Use **Better Auth** (self-hosted TypeScript auth framework) with the Drizzle/Postgres adapter and these plugins: `organization` (orgs, members, invitations, roles, active-org on session), `twoFactor` (TOTP + backup codes), `admin` (staff roles, ban, impersonation), `nextCookies` (must be the **last** plugin). Built-in: email+password, email verification, password reset, OAuth (Google), DB-backed sessions, rate limiting.

Why: it provides organizations/roles/invitations/2FA/admin out of the box, so the team spends R1 time on the product instead of rebuilding auth. If the team prefers another library, the requirements in §3–§8 still apply unchanged.

**Implementation notes for the agent (verify against the installed version's docs; names may differ):**
- Generate schema with the Better Auth CLI (`npx @better-auth/cli generate`), then reconcile with `drizzle/` and `05-data-model-v2.md` (keep plural table names via the adapter's table-name options or map accordingly).
- Route handler: `src/app/api/auth/[...all]/route.ts` using `toNextJsHandler(auth)`; client: `src/lib/auth-client.ts` with `createAuthClient` + `organizationClient` + `twoFactorClient` + `adminClient`, passing the **same** access-control (`ac`, `roles`) objects as the server.
- **No database reads in Next middleware/proxy** (it runs on every matched request, including prefetches). Use it only for cheap cookie-presence redirects; do real authorization in route handlers and server components.
- Send emails **asynchronously** (outbox + worker) so response time never reveals whether an account exists.

```ts
// src/server/auth/auth.ts (blueprint)
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true, minPasswordLength: 12, requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => enqueueEmail('password_reset', user.email, { url }),
  },
  emailVerification: {
    sendOnSignUp: true, autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => enqueueEmail('verify_email', user.email, { url }),
  },
  socialProviders: env.GOOGLE_CLIENT_ID ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } } : {},
  session: { expiresIn: 60*60*24*7, updateAge: 60*60*24, cookieCache: { enabled: false } },
  rateLimit: { enabled: true, window: 60, max: 100 },        // plus custom stricter rules for sign-in/forgot-password
  plugins: [
    organization({ ac, roles, sendInvitationEmail: async (d) => enqueueEmail('org_invite', d.email, d), invitationExpiresIn: 60*60*24*7 }),
    twoFactor({ issuer: 'ProofPay' }),
    admin({ adminRoles: ['admin'], impersonationSessionDuration: 60*30 }),
    nextCookies(),   // keep last
  ],
});
```

## 3. Account flows (all with acceptance criteria in `03-feature-specs.md`)

1. **Sign up:** email + password (min 12 chars, no max under 128, show strength) → account created `emailVerified=false` → verification email → click link → verified, signed in → **onboarding wizard** (create org). Unverified users can sign in but see a verification gate; they **cannot create orgs, send contracts, fund, or accept**.
2. **Sign in:** email+password or Google; throttled (5 failures/15 min/account+IP → progressive delay + email notice); generic error text ("Email or password is incorrect"); if MFA enabled → TOTP or backup code step.
3. **Forgot/reset password:** always responds "If an account exists, we sent a link"; token valid 1 hour, single use; reset revokes all sessions; notification email "Your password was changed".
4. **Change password / email:** requires current password (or recent re-auth); email change verifies the new address and notifies the old; both revoke other sessions.
5. **Sessions & devices:** list active sessions (device, browser, IP region, last active); revoke one/all others; sessions expire 7 days sliding (cookie `HttpOnly; Secure; SameSite=Lax`).
6. **MFA (TOTP):** enroll via QR + confirm code → show 10 one-time backup codes once; disable requires password + code; **R1 optional but nagged for Owner/Finance**; **R2 enforceable per org**; **staff always required**.
7. **Organizations:** create org (name, slug) → creator is **Owner**; org switcher sets the **active organization** on the session; all org-scoped data is filtered by it.
8. **Invitations:** Owner/Admin invites by email with a role; link valid 7 days, single use, bound to the invited email (mismatch → `INVITE_EMAIL_MISMATCH`); existing users sign in then accept; new users sign up (email pre-filled, verification implied by the link click but password setup required); resend and revoke supported; duplicates blocked.
9. **Counterparty contract invites:** different from org invites: inviting an **email** to a **contract**. Accepting requires sign-in, then the invitee picks/creates the org that will act as seller (or buyer) on that contract. See `03` E7.
10. **Leave/remove/transfer:** a member can leave unless last Owner; Admin/Owner can remove members (their sessions keep working for other orgs; org-scoped actions stop immediately); **transfer ownership** requires password re-entry and acceptance by the new owner; last Owner cannot be removed or demoted.
11. **Delete account:** blocked while the user is the only Owner of an org with open (non-terminal) contracts; otherwise anonymizes the profile (keeps ledger/audit with a pseudonymous id) within 30 days; export of personal data available (R1: JSON export of profile and memberships).
12. **Terms & privacy consent:** record `consent_records` (document, version, timestamp, IP) at sign-up.

## 4. Session, cookie and credential requirements

- Passwords hashed by the auth library's current recommended algorithm (scrypt/argon2); never logged; reset tokens stored hashed; email tokens single use and expiring.
- Cookies: `HttpOnly`, `Secure` in production, `SameSite=Lax`; `Origin` check on state-changing requests; CSRF protection enabled in the auth library.
- Rate limits: sign-in 5/15 min per (account, IP) and 20/hour per IP; forgot-password 3/hour per email and 10/hour per IP; sign-up 10/hour per IP; invitation sends 20/day per org; verification resend 3/hour.
- Account enumeration defenses: identical responses and similar timing for sign-in, forgot-password and sign-up-existing-email (the existing user gets an informational email).
- Optional breached-password check (k-anonymity range lookup) at sign-up/reset (R2).
- Impersonation (staff): read-only; persistent red banner "Viewing as <user> — read-only"; every request audited; auto-expires in 30 minutes; **cannot** perform any write, funding, or decision action (enforced centrally: if `session.impersonatedBy` is set, all non-GET requests return `403 IMPERSONATION_READ_ONLY`).

## 5. RBAC model

### 5.1 Resources and actions (Better Auth access-control statements)

```
organization: update, delete        member: read, invite, remove, update_role     invitation: create, cancel
contract: create, read, update, propose, accept, decline, cancel, comment
funding: request_approval, approve, authorize
submission: create, read            escalation: decide        release: retry
payment: read, refund               template: read, write     counterparty: manage
paypal: read, connect               apikey: manage            serviceaccount: manage
webhook: manage                     audit: read               dispute: open, respond
```

### 5.2 Org role × permission matrix

Legend: ✓ allowed · own = only for contracts the user created or is assigned to (R1: creator) · ctx = allowed only when the org is on the required **side** of the contract · — not allowed.

| Permission | Owner | Admin | Finance | Member | Viewer |
|---|---|---|---|---|---|
| organization:update | ✓ | ✓ | — | — | — |
| organization:delete, transfer ownership | ✓ | — | — | — | — |
| member:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| member:invite / remove / update_role | ✓ | ✓ (cannot grant/remove Owner) | — | — | — |
| contract:create, update (draft) | ✓ | ✓ | — | ✓ | — |
| contract:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| contract:propose (send) | ✓ | ✓ | — | ✓ own | — |
| contract:accept / decline (seller side, ctx) | ✓ | ✓ | — | own (if policy allows) | — |
| contract:cancel | ✓ | ✓ | — | own (before funding only) | — |
| contract:comment | ✓ | ✓ | ✓ | ✓ | — |
| funding:request_approval | ✓ | ✓ | ✓ | ✓ | — |
| funding:approve (ctx buyer, ≠ requester) | ✓ | ✓ | ✓ | — | — |
| funding:authorize (start PayPal hold, ctx buyer) | ✓ | ✓ | ✓ | below threshold own | — |
| submission:create (ctx seller) | ✓ | ✓ | — | ✓ | — |
| submission:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| escalation:decide (ctx buyer) | ✓ | ✓ | ✓ | own | — |
| release:retry (ctx buyer) | ✓ | ✓ | ✓ | — | — |
| payment:read | ✓ | ✓ | ✓ | — | ✓ |
| payment:refund (ctx seller) | ✓ | ✓ | ✓ | — | — |
| template:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| template:write | ✓ | ✓ | — | ✓ | — |
| counterparty:manage | ✓ | ✓ | — | ✓ | — |
| paypal:read | ✓ | ✓ | ✓ | — | — |
| paypal:connect | ✓ | ✓ | — | — | — |
| apikey / serviceaccount / webhook manage | ✓ | ✓ | — | — | — |
| audit:read | ✓ | ✓ | ✓ | — | ✓ |
| dispute:open / respond | ✓ | ✓ | ✓ | own | — |

### 5.3 Policies (org settings that tighten the matrix)

- **Funding approval threshold** (`org_settings.funding_approval_threshold_minor`, default `null` = off): contracts with `total_minor ≥ threshold` cannot be authorized until a **different** user with `funding:approve` approves (4-eyes). Members below the threshold may authorize their own contracts.
- **Member contract acceptance** (`members_can_accept_contracts`, default `false`): when false, only Owner/Admin may accept on the seller side.
- **MFA requirement** (R2): require MFA for roles Owner/Admin/Finance.
- **Auto-release hours default**, **default template**, **notification defaults** (org-level, overridable per user).

### 5.4 Service accounts (agents)

- Created by Owner/Admin: name, scopes, caps. Keys shown once (`pp_k_…`), hashed at rest, revocable, optional expiry, last-used tracking, rotation supported (two active keys).
- **Scopes:** `contracts:read`, `contracts:write` (create/compile/edit/propose), `submissions:write`, `verifications:read`, `ledger:read`, `funding:link` (create the PayPal approval link; a **human payer** must approve in PayPal).
- **Never grantable:** `escalation:decide`, `release:retry`, `payment:refund`, `contract:cancel` after funding, member/org management, API key management.
- **Caps:** `max_contract_total_minor` per contract and `max_open_holds_minor` across open contracts; exceeding returns `403 SERVICE_ACCOUNT_CAP_EXCEEDED`.
- Service account actions are attributed in the ledger and audit log as `actor_type=service_account` with the account name.

### 5.5 Staff (platform) roles

| Capability | Support | Platform admin |
|---|---|---|
| Search users/orgs/contracts (read-only) | ✓ | ✓ |
| View ledger, jobs, webhooks, emails | ✓ | ✓ |
| Resend verification/invite email | ✓ | ✓ |
| Trigger reconcile for a contract | ✓ | ✓ |
| Ban/unban user, revoke sessions | — | ✓ |
| Re-run/cancel jobs, toggle feature flags | — | ✓ |
| Read-only impersonation | ✓ (with ticket id) | ✓ |
| Any money action (capture/void/refund/decision) | **never** | **never** |
Staff accounts require MFA and are created only via seed/CLI (`npm run staff:create`), never via public sign-up.

## 6. Enforcement design

- **One function decides:** `can(actor, action, resource?)` in `src/server/auth/permissions.ts`. Inputs: actor (user + active membership role, or service account + scopes, or staff), action string `resource:verb`, and optional resource (contract, org). It computes the org **side** from `contract.buyer_org_id/seller_org_id` and applies the matrix and policies. Returns `{ok: true}` or `{ok:false, reason, required}`.
- **Where it runs:** every `apiHandler` call declares `permission: 'contract:propose'` (and optionally `resource: 'contract'`); the wrapper loads the actor, calls `can`, and throws `AppError`. Services re-check domain rules (state, side). **UI never trusts itself:** `/me` returns `permissions[]` for display only.
- **404 vs 403 policy:** if the actor has **no relationship** to the resource (not in either org) → `404 NOT_FOUND`. If the actor is in a party org but lacks permission → `403 FORBIDDEN` with `{required_permission}`. Unverified email → `403 EMAIL_NOT_VERIFIED`. No active org → `409 ORG_REQUIRED`.
- **Always re-validate on money actions:** funding authorization, escalation decisions, retry-release, refunds recheck membership/role at execution time (jobs store the acting user id and re-verify the actor still has permission when executing user-initiated work).
- **Agent restrictions** are scope-based, plus the global rule that agent actors fail `forbidAgent` on decision/cancel/refund/retry-release.

## 7. Audit logging (separate from the contract ledger)

`audit_events` records who did what in the org context: sign-in/out, failed sign-in (account, IP), password/email change, MFA enable/disable, session revoke, org settings change, member invite/remove/role change, ownership transfer, API key create/revoke, service account create/update, PayPal connection change, contract create/send/accept/cancel, funding approval/authorization start, escalation decisions, refunds, staff access/impersonation start-stop, data export/delete requests. Fields: actor type/id, org id, action, target, metadata, IP, user agent, request id, time. Viewable by Owner/Admin/Finance/Viewer (`audit:read`), exportable CSV (R2). **Contract state changes also continue to write to the hash-chained contract ledger** (evidence); the two logs serve different purposes.

## 8. Privacy and data rights (R1 minimum)

Terms and privacy pages with version numbers; consent records; JSON export of profile/memberships; account deletion flow (§3.11); retention policy note (demo data purge disabled until Dec 16); no deliverable content in logs; sandbox banner everywhere money appears.

## 9. Migration from demo personas (what the agent must do)

1. Add Better Auth tables; map `users` to the auth user table; deprecate `users.role` and `users.persona_key` (keep columns, stop reading them).
2. Create a **Demo Workspace** org and memberships for the existing seeded users so existing contracts remain accessible; backfill `contracts.buyer_org_id/seller_org_id`.
3. Replace `requireUser`/`requireParty` internals to read the Better Auth session + active org; keep their signatures so routes don't change.
4. Replace `POST /auth/demo-login` with a **demo-session endpoint** used only by `/demo` (creates a real session for a seeded demo user inside the Demo Workspace; disabled when `DEMO_MODE=false`).
5. Keep API keys; add `org_id`, `service_account_id`, `scopes`.
6. Feature flag `REAL_AUTH=true` switches the app to real auth; demo personas remain only under `/demo`.

## 10. Test plan (named tests; implement with the phase that builds each)

- Sign-up creates unverified user; unverified cannot create org/send/fund/accept; verification link verifies once and expires; reset token single-use; reset revokes sessions; generic responses for unknown emails (status + body equal); rate limits trigger.
- Org: create → creator Owner; invite flows (existing/new user, wrong email rejected, expired link rejected, revoked link rejected); last Owner can't leave/demote; role change takes effect immediately; removed member loses access on next request.
- RBAC matrix: **table-driven test over every (role × action × side) cell** against `can()`; IDOR: stranger → 404, wrong role → 403 across **every route** (route-table test fails if a route lacks a permission declaration).
- Policies: funding threshold blocks self-approval, allows a second approver; `members_can_accept_contracts=false` blocks Members.
- Service accounts: scope enforcement per endpoint; forbidden scopes cannot be granted; caps enforced; key shown once; revoked key rejected.
- Impersonation: all non-GET rejected with `IMPERSONATION_READ_ONLY`; audited; expires.
- Sessions: revoke other sessions works; password change revokes; cookie flags present.
- Audit: each listed action creates an event with request id; audit table rejects UPDATE/DELETE (trigger).
