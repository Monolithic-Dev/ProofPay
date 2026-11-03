# 07 — Release Plan R1 ("Real core"): Phases 11–17

> Continues the existing phase plan (`docs/plan/phase-1…10`). **Today is Tue Nov 3.** Feature freeze **Nov 9 23:59 IST**, record **Nov 10**, submit **Nov 11 by 18:00 IST**. Capacity ≈ 4 people × 7 days = 28 person-days (pd) for Nov 3–9; this plan needs ≈ 26 pd, so the **cut list in §4 is part of the plan**.
> **Assumptions:** Phases 1–9 are functionally complete (money path, verification, scenarios, deployment). If something there is still broken, fix it first; it outranks every item here.
> **Money path is frozen:** do not change `src/server/release/**`, `src/server/paypal/**`, `src/server/verify/policy.ts`, `src/server/ledger/**` except where a task below says so (actor attribution and permission re-checks only).

## 0. Plan at a glance

| Phase | Name | Window (IST) | pd | Lead | Goal (done means) |
|---|---|---|---|---|---|
| 11 | Auth foundation | Nov 3–4 | 3 | A (+D email) | Real sign-up/sign-in/verify/reset with DB sessions; email outbox + worker; `REAL_AUTH` flag |
| 12 | Organizations, RBAC & audit | Nov 4–5 | 3 | A (B review) | Org membership, roles, `can()` on every route, org-scoped contracts, funding approvals, audit log |
| 13 | App shell, IA, dashboard & inbox | Nov 4–7 | 5 | C (+A APIs) | New app shell, onboarding, dashboard, inbox, contracts list, role-aware UI |
| 14 | Collaboration & templates | Nov 5–8 | 5 | A / C / B | Counterparty invites, versions, comments, notifications, templates, contract editor |
| 15 | Settings, developers & admin | Nov 6–8 | 4 | C / A / D | Settings hub, MFA, sessions, service accounts + scoped keys, minimal admin, help |
| 16 | Marketing site & demo playground | Nov 6–8 | 3 | C / D | Honest landing + pages; `/demo` playground; copy fixes |
| 17 | Hardening & submission refresh | Nov 7–10 | 3 | All | RBAC/IDOR/E2E/a11y/security/regression; README, Devpost, video v2 |

**Dependency chain:** 11 → 12 → (13 ∥ 14) → 15 → 17; 16 depends on 11–12 for `/demo` sessions and on 13 for screenshots. Frontend (13) starts on Nov 3 against mocks and integrates as 11/12 land.

## 1. Cross-cutting rules (apply to every phase)

1. **Branch per phase** (`phase-N/<topic>`), PR into `main`, one reviewer; **two reviewers** for migrations, `auth/`, `permissions.ts`, `apiHandler`.
2. **Additive migrations only.** Snapshot the DB before migration 0004 (`pg_dump`), test migrations on a copy of real dev data, run `.claude/skills/senior-database/scripts/check-migrations-additive.sh drizzle`.
3. **Feature flag `REAL_AUTH`:** `false` keeps the legacy demo auth for emergencies; target is `true` everywhere by end of Phase 12. Remove the flag in Phase 17.
4. **Every new route declares `permission`** (Phase 12 enforces in CI); every list query filters by the active org.
5. **Every task includes validation, error handling, logging and named tests.**
6. **Copy rules** from `01` §8 apply to every string you add.
7. **After each phase:** `npm run lint && npm run typecheck && npm run test:unit && npm run test:integration`, plus `.claude/skills/paypal-payments/scripts/check-money-invariants.sh`; tag `phase-N-…`.

---

## Phase 11 — Auth foundation (Nov 3–4, 3 pd)

**Implements:** `02` §2–§4, §9 · `03` E2 · `05` §3.1 (0004), §3.11 (email outbox).
**Preconditions:** `main` green; DB snapshot taken; branch `phase-11/auth`.

**Tasks**
1. **Dependencies/env (A):** `npm i better-auth` and dev `@better-auth/cli`; add to `src/server/config/env.ts` + `.env.example`: `BETTER_AUTH_SECRET` (≥ 32 chars), `BETTER_AUTH_URL` (= `APP_BASE_URL`), `EMAIL_PROVIDER` (`resend|smtp|console`), `RESEND_API_KEY`, `EMAIL_FROM`, `SMTP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional pair), `REAL_AUTH` (bool). Test: `env rejects half-configured Google credentials`.
2. **Mailpit (D):** add `mailpit` service (`axllent/mailpit`, ports 1025/8025) to `docker-compose.yml`; document `http://localhost:8025`.
3. **Auth config (A):** `src/server/auth/auth.ts` per `02` §2 blueprint (email+password with `requireEmailVerification`, verification, reset, optional Google, `organization()`, `twoFactor()`, `admin()`, `nextCookies()` last). Organization/AC details arrive in Phase 12; for now default roles.
4. **Schema generation and merge (A):** run `npx @better-auth/cli generate --config src/server/auth/auth.ts` → review output; merge into `src/server/db/schema.ts` keeping existing `users` as the user table (extend columns per `05` §3.1); `npm run db:generate`; **hand-edit the migration to be additive**; apply `0004_better_auth.sql` to a copy of the dev DB first. Test `migration 0004 keeps existing users and contracts intact`.
5. **Email outbox + worker (D):** migration `0004b_email_outbox` (`email_outbox`, per `05` §3.11) and `…_job_send_email` (`ALTER TYPE job_type ADD VALUE 'SEND_EMAIL'`, own file). Files: `src/server/email/provider.ts` (`sendEmail({to,subject,html,text})` with Resend / SMTP / console adapters), `src/server/email/templates/{verify_email,welcome,password_reset,password_changed}.ts` (return `{subject, html, text}`), `src/server/email/enqueue.ts` (`enqueueEmail(tx|db, template, to, data, ctx)` inserts outbox row and `SEND_EMAIL` job, dedupe `email:{id}`), `src/server/jobs/handlers/send-email.ts` (`handleSendEmail`: loads row, honors preferences for non-security types, sends, marks `SENT`, backoff on failure, `FAILED` after 5 attempts). Register in worker. Tests: `enqueueEmail is atomic with the caller transaction`, `send-email retries then FAILED`, `console provider logs without secrets`.
6. **Routes/client (A):** `src/app/api/auth/[...all]/route.ts` (`toNextJsHandler(auth)`), `src/lib/auth-client.ts` (`createAuthClient` + org/twoFactor/admin clients).
7. **Session integration (A):** rewrite `src/server/auth/session.ts` `getActor(req)` using `auth.api.getSession({ headers })`; return `{ type:'user', id, email, emailVerified, activeOrganizationId, platformRole, impersonatedBy }`; Bearer keys unchanged for now. Keep `requireUser` signature; when `REAL_AUTH=false` use the legacy path. Test: `requireUser rejects unauthenticated`, `requireUser exposes emailVerified`.
8. **Auth pages (C):** route group `src/app/(auth)/` with `sign-up`, `sign-in`, `verify-email`, `forgot-password`, `reset-password`, `mfa` pages; components `AuthCard`, `PasswordField` (strength meter), `ResendButton` (cooldown); **consent**: sign-up posts `POST /api/v1/me/consent` for `terms`+`privacy` versions (constants in `src/lib/legal.ts`). All error text generic per `02` §3. States: loading, success ("Check your email"), expired link, rate-limited.
9. **Edge middleware (C/A):** `middleware.ts` (or `proxy.ts` if the repo is on Next 16): redirect unauthenticated requests for `/app/*`, `/onboarding` to `/sign-in?next=` based on session **cookie presence only** (no DB reads).
10. **Rate limits (A):** configure the auth library rate limit for `/sign-in/email` (5 per 15 min per IP), `/forget-password` (3/h), plus our `rateLimit` on sign-up (10/h/IP) and verification resend (3/h). Tests with a fake clock.
11. **Seeds (A):** `scripts/seed.ts` creates real users through `auth.api.signUpEmail` (buyer, seller, finance, member, viewer, + agents later), marks seeded emails verified directly in the DB **only when `SEED_ALLOW_VERIFIED=true`**; `scripts/create-staff.ts <email> <role>` for `support|admin` (prompts for password; requires MFA enrollment at first sign-in).

**Tests (named):** `sign-up creates unverified user and sends verification email`, `verification link verifies once and then fails`, `expired verification link shows resend`, `unverified user is redirected to verify gate`, `sign-in with wrong password returns generic error`, `sign-in and sign-up for existing email give indistinguishable responses`, `password reset token is single use`, `password reset revokes other sessions`, `session cookie has HttpOnly and SameSite=Lax`, `sign-out invalidates server session`, `rate limit blocks 6th sign-in attempt`.

**Definition of done**
- [ ] With `REAL_AUTH=true` a new user can sign up, receive the email in Mailpit, verify, sign in/out, reset password.
- [ ] Existing contracts and users survive migration (counts equal before/after).
- [ ] All named tests pass; CI green; `scan-secrets.sh` clean.
- [ ] Setting `REAL_AUTH=false` restores the legacy demo login (documented rollback).

**Risks:** library API/naming differs from this spec (read the installed version's docs; log deviations in `docs/decision-log.md`) · table-name conflicts (map plural/singular via adapter options) · email deliverability in hosted env (use Resend sandbox sender or console fallback for demos) · demo scenarios depend on persona login (keep until Phase 16).
**Cut first:** Google sign-in, MFA page, password strength library (use length + simple meter).
**Handoff:** real sessions and verified-email gate exist; outbox email pipeline works; schema for orgs/members/invitations exists (unused yet). **Tag:** `phase-11-auth`.

---

## Phase 12 — Organizations, RBAC & audit (Nov 4–5, 3 pd)

**Implements:** `02` §5–§7, §9 · `05` §3.2–§3.4, §3.7b, §3.12 · `06` §1–§2 · `03` E3, E4.
**Preconditions:** Phase 11 tagged.

**Tasks**
1. **Access control (A):** `src/server/auth/access-control.ts`: `createAccessControl(statement)` with the statements in `02` §5.1 (start from the library's default statements), roles `owner, admin, finance, member, viewer` (`ac.newRole`), exported `ac`, `roles`; pass to `organization({ ac, roles })` server-side and `organizationClient({ ac, roles })` client-side. Export `PERMISSION_MATRIX` (typed const mirroring `02` §5.2) used by tests and `/me`.
2. **Migration `0006_orgs_contract_ownership` (A):** `org_settings`, `paypal_connections`, contract columns + indexes; run `scripts/backfill-orgs.ts` (idempotent) creating **Demo Workspace** and org ids for existing contracts. Test `backfill is idempotent`, `contracts get distinct buyer and seller orgs`.
3. **Permission engine (A, reviewed by B):** `src/server/auth/permissions.ts`: types `UserActor | ServiceActor | StaffActor`; `computeSide(contract, orgId): 'buyer'|'seller'|null`; `can(actor, action, resource?): {ok:true}|{ok:false, reason, required}` implementing the matrix, **contextual side rules**, and policies (`members_can_accept_contracts`, funding threshold); `loadContractForActor(tx, actor, contractId)` returns `{contract, side}` or throws `NOT_FOUND` (no relationship) — **404 vs 403 policy**.
4. **apiHandler upgrade (A):** extend `src/server/http/handler.ts` config with `permission`, `resource`, `requireVerified` (default true for writes), `scope` (service accounts); resolve active org (`ORG_REQUIRED`); impersonation guard (`IMPERSONATION_READ_ONLY` on non-GET); attach `actor` and `resource` to the handler context.
5. **Declare permissions on every existing route (A):** table in `docs/product/route-permissions.md` generated by the agent from `06` §2–§6 and `api-spec.md`; CI test `tests/integration/route-permissions.test.ts` walks `src/app/api/v1/**/route.ts` and fails when a handler lacks `permission`.
6. **Org-scope services/repos (A):** change `listContractsForUser` → `listContractsForOrg(orgId, filters)`; update `submitDeliverable`, `decideEscalation`, `startFunding`, `cancelContract`, `acceptContract`, `proposeContract` to use `{actor, side, orgId}`; write `buyer_org_id` at creation and `created_by_user_id`; keep legacy `buyer_id/seller_id` populated until Phase 17. Ledger payloads add `actor_org_id` (additive, optional).
7. **Org & identity APIs (A):** `GET /me` (permissions[] computed from `PERMISSION_MATRIX` + policies), `GET /orgs/current`, `PATCH /orgs/current/settings`, members/invitations wrappers with `LAST_OWNER` guard; onboarding completion sets `org_settings.onboarding_completed_at`. Hooks: org creation inserts `org_settings` + `paypal_connections(PLATFORM_ACCOUNT, ACTIVE)`.
8. **Funding approvals (A):** migration `…_funding_approvals` (pulled forward from `0006/0007`), `src/server/funding/approvals.ts`: `requestApproval(contractId, actor)`, `decideApproval(approvalId, actor, decision, note)`, `assertFundingAllowed(contract, actor)`; integrate into `startFunding` (before creating the PayPal order); endpoints `POST /contracts/{id}/funding-approvals`, `POST /funding-approvals/{id}/decision`; notifications arrive in Phase 14.
9. **Audit (A):** migration `…_audit_events` with append-only trigger; `src/server/audit/log.ts` `audit(ctx, action, target?, metadata?)`; call it from services listed in `05` §3.12 and from auth hooks (sign-in/out, failed sign-in, password change, session revoke, MFA).
10. **Staff & agents attribution (A):** extend ledger `actor_type` CHECK additively to include `service_account` (new constraint); no changes to release logic.

**Tests (named):** `matrix: every (role × action × side) cell matches PERMISSION_MATRIX` (table-driven, generated), `stranger gets 404 on every contract route`, `member without permission gets 403 with required_permission`, `unverified user gets EMAIL_NOT_VERIFIED on writes`, `no active org returns ORG_REQUIRED`, `last owner cannot leave or be demoted`, `removed member loses access on next request`, `members_can_accept_contracts=false blocks member accept`, `threshold blocks self-approval`, `second approver unlocks funding`, `approval for different total does not unlock funding`, `route without permission fails CI`, `impersonated session cannot write`, `audit rows are append-only`, `org scoping: list never returns other org's contracts`.

**Definition of done**
- [ ] Two real users in two orgs can see only their own contracts; cross-org access returns 404.
- [ ] The matrix test and route-permission test pass; unauthenticated/unauthorized behavior matches `06` §1.
- [ ] Funding above the org threshold requires a different approver; below it proceeds.
- [ ] Audit log records the listed events with request ids.
- [ ] Money-path code unchanged except actor attribution (`git diff` reviewed).

**Risks:** large cross-cutting change breaks existing tests (migrate tests to a `makeOrgFixture()` helper first) · `can()` bugs are security bugs (two reviewers, matrix test, property test that no `viewer` write action is ever allowed) · backfill mistakes (dry-run flag, snapshot).
**Cut first:** teams/groups (not in R1 anyway), invitation message field, `search` permission.
**Handoff:** all APIs are org-scoped and permissioned; `/me` returns permissions for UI; approvals and audit exist. **Tag:** `phase-12-orgs-rbac`.

---

## Phase 13 — App shell, IA, dashboard & inbox (Nov 4–7, 5 pd; starts against mocks)

**Implements:** `04` §2–§4.1–4.6, §4.9–4.11, §4.19, §6 · `03` E1-4/5, E16 · `06` §4.
**Preconditions:** Phase 11 for real sessions (C can start Nov 3 with MSW mocks of `/me`, `/inbox`, `/contracts`).

**Tasks**
1. **Route migration (C):** create route group `src/app/(app)/app/...`; move pages per the mapping in `04` §2; add `redirects()` in `next.config.ts` for old paths; keep components.
2. **Shell (C):** `src/components/shell/{AppShell,Sidebar,TopBar,OrgSwitcher,NotificationBell,UserMenu,CommandPalette}.tsx`; `src/lib/permissions-client.ts` (`usePermissions()`, `<Can action fallback>`); nav config `src/lib/nav.ts` with `requires` permission per item; mobile drawer; sandbox badge; banners (`UnverifiedBanner`, `FundingAtRiskBanner`).
3. **Gates (C):** `VerifyEmailGate`, `OrgRequiredGate` (redirect to `/onboarding`), 403/404/500 pages with copy from `04` §7.
4. **Onboarding (C+A):** `src/app/onboarding/page.tsx` four steps; server actions create org via auth client (`organization.create`), set active org, save `org_settings.intent`, optional invites; resumable.
5. **APIs (A):** `GET /inbox` via `src/server/inbox/build.ts` `buildInbox(actor)` (items: `accept_contract`, `fund_required`, `approval_requested`, `submit_work`, `fix_and_resubmit`, `escalation_review`, `retry_release`, `deadline_soon`), `GET /payments/summary`, `GET /contracts` upgraded (filters, cursor). SSE `GET /me/events` (polls notification/inbox change token every 1.5 s).
6. **Pages (C):** Dashboard, Inbox, Contracts list, Contract detail header (side chip, role-aware primary action), empty/loading/error states per `04`; Payments page (tiles + table) read-only.
7. **Realistic seed (D):** `scripts/seed-demo-data.ts` populates Demo Workspace with 6–8 contracts across statuses so every screen looks real.
8. **A11y/responsive (C):** keyboard nav for sidebar/switcher, aria-live for inbox updates, drawers on mobile.

**Tests (named):** unit `nav hides items without permission`, `<Can> renders fallback`, `buildInbox returns escalation only for users who can decide`, `buildInbox is org scoped`; integration `GET /inbox for buyer finance includes approval_requested`; E2E `unverified user is gated`, `new user is sent to onboarding`, `viewer cannot see Fund button`, `dashboard shows seeded data`, `old URLs redirect`; axe on dashboard/inbox/contracts.

**Definition of done**
- [ ] Fresh sign-up → onboarding → dashboard with checklist works end to end.
- [ ] Sidebar/actions reflect role (verified with Owner, Finance, Member, Viewer).
- [ ] All old routes redirect; no dead links.
- [ ] Dashboard, inbox, contracts list have loading/empty/error states; axe has no serious/critical issues.

**Risks:** biggest UI scope → start with Dashboard + Contracts + Inbox; defer Payments table polish. **Cut first:** command palette, keyboard shortcuts, payments filters, mobile bottom sheet polish.
**Handoff:** app shell and IA stable for Phases 14–16. **Tag:** `phase-13-app-shell`.

---

## Phase 14 — Collaboration & templates (Nov 5–8, 5 pd)

**Implements:** `03` E6, E7, E8, E14 · `05` §3.5–§3.10, §3.14 · `06` §3–§4 · `04` §4.7–4.8, 4.13, 4.17.
**Preconditions:** Phases 11–12 tagged; Phase 13 shell available (or build pages behind the old layout and move).

**Tasks**
1. **Migrations (A):** `0007_collaboration` (`counterparties`, `contract_versions`, `contract_invitations`, `contract_comments`, `templates`) and `0008_notifications_email` (`notifications`, `notification_preferences`, `consent_records`, `support_tickets`).
2. **Counterparties (A):** `src/server/counterparties/service.ts` CRUD + auto-save on invite; API per `06` §4.
3. **Send & invitations (A):** `src/server/contracts/send.ts` `sendContract({contractId, actor, counterparty})`: validate lint clean, create `contract_versions` row (hash), create `contract_invitations` (token = 32 random bytes base64url; store `sha256`), set `seller_invite_email`, transition `DRAFT→PROPOSED` (existing guard), ledger `CONTRACT_PROPOSED` (+version), enqueue `contract_invite` email + notification — all in one tx. `src/server/contracts/invitations.ts`: `previewInvitation(token)` (public, minimal fields), `acceptInvitation({token, actor, organizationId})` (email match, org membership with `contract:accept`, expiry, sets `seller_org_id`, then existing accept logic: hash lock, materialize), `declineInvitation`, `resendInvitation` (rate-limited), `revokeInvitation`. Tests: `token is stored hashed`, `accept requires matching email`, `expired token returns 410`, `accept sets seller_org_id and locks hash`, `cannot accept own contract (same org)`, `one pending invitation per side`.
4. **Invite pages (C):** `src/app/invite/[token]/page.tsx` states per `04` §4.2 (preview → sign in/up → choose acting workspace → accept/decline); preserve `next` through auth.
5. **Comments (A, C):** `src/server/comments/service.ts` (`addComment`, `listComments` with cursor), API; `components/contract/DiscussionTab.tsx` timeline mixing comments and system events; rate limit 60/h; markdown-lite sanitizer (bold/italic/links only; escape everything else).
6. **Notifications (A):** `src/server/notifications/notify.ts` `notify(tx, {recipients, type, title, body, link, data})` creating rows and (per preferences) `enqueueEmail`; `rules.ts` mapping domain events → recipients by **role + side** (e.g., `escalation_review` → buyer-org users with `escalation:decide`; `approval_requested` → users with `funding:approve`; `milestone_released` → both orgs' Owner/Admin/Finance + contract creator); hook calls into existing services **inside their transactions**: `applyDecision`, `releaseMilestone` TX-B (post-commit job instead, to keep the money path untouched: add a ledger-event subscriber job `NOTIFY_FROM_LEDGER` that reads new `ledger_events` and notifies — preferred), `submitDeliverable`, `decideEscalation`, funding handlers, expiry sweeps. API: list/read/preferences; `src/components/shell/NotificationBell.tsx` + page.
   *Preferred design:* a worker job `NOTIFY_FROM_LEDGER` (dedupe by ledger event id) generates notifications and emails from ledger events, so no money-path code changes and no duplicates.
7. **Templates (B, A):** system templates JSON in `src/server/templates/system/{dataset-summary,content-batch,translation}.json` with `variables`; `src/server/templates/render.ts` `renderTemplate(template, variables)` (substitute, validate with `ContractSchema`, run lint, reject if errors); seed via `scripts/seed-templates.ts`; API `GET /templates`, `POST /contracts` (from template), `POST /templates` (save as); UI: `new/page.tsx` picker + variable form (`TemplateVariablesForm`), "Save as template" action.
8. **Contract editor (C):** `src/components/contract/editor/*`: `MilestoneEditor`, `CriterionEditor` with registry-driven parameter forms (`row_count{min,max}`, `unique_field{field}`, `regex_field{field,pattern}`, `word_count{min,max}`, `required_keywords{keywords,mode}`, `json_schema{schema_ref}`, rubric{statement,threshold}, human{statement}), `LintPanel` (existing), autosave (`PATCH /contracts/{id}` debounced 1.5 s, optimistic version check via `updated_at`), Advanced JSON tab.
9. **Support/help (C, A):** `POST /support/tickets` + `/help` page (rate limited), email to staff address.

**Tests (named):** per above plus `notify rules: seller Owner receives funded notification`, `NOTIFY_FROM_LEDGER is idempotent per ledger event`, `preferences suppress email but keep in-app`, `security emails ignore preferences`, `comment markdown strips scripts`, `template render fails lint → 400 with issues`, `editor autosave conflict warns`, E2E `buyer sends contract; seller accepts via invite link in a second browser context`.

**Definition of done**
- [ ] Buyer creates a contract from a template, fixes lint in one click, sends to an email; seller (new account) signs up from the email link, accepts as their workspace; both see the hash.
- [ ] Comments exchange works; notifications and emails fire for the main events without touching money-path code (verify `git diff` on `release/`).
- [ ] Editor can change amounts, due days, and add/remove criteria; lint updates live; autosave works.

**Risks:** biggest backend surface → build in order: send/invite/accept → templates → comments → notifications; defer editor polish. **Cut first:** org templates ("save as"), markdown links, notification preferences UI (defaults only), version diff.
**Handoff:** contracts are collaborative between real orgs; notifications infrastructure exists. **Tag:** `phase-14-collaboration`.

---

## Phase 15 — Settings, developers & admin (Nov 6–8, 4 pd)

**Implements:** `04` §4.14–4.16, 4.18 · `02` §3, §5.4–5.5 · `05` §3.13 · `06` §5–§6 · `03` E2-7/8/10/11, E3, E15, E17, E18.

**Tasks**
1. **Settings hub (C):** `src/app/(app)/app/settings/{profile,security,notifications,workspace,payments,audit,plans}/page.tsx`. Security: change password, **MFA enrollment** (QR from `authClient.twoFactor.enable`, confirm, backup codes modal), sessions list/revoke. Workspace: settings form (threshold, toggles, defaults), danger zone (transfer ownership). Payments: PayPal connection card (honest copy; R2 button disabled). Audit: filterable table via `GET /orgs/current/audit`. Plans: static.
2. **Team page (C):** members/invitations/roles tabs wired to Phase 12 APIs; confirm dialogs; role matrix read-only view from `PERMISSION_MATRIX`.
3. **Service accounts & keys (A):** migration `0009_audit_service_accounts` part for `service_accounts` + `api_keys` columns (audit part done in Phase 12); `src/server/serviceaccounts/service.ts` (`createServiceAccount`, `createKey` returning secret once, `revokeKey`, scope validation against allowed list; DB CHECK forbids forbidden scopes); update `authenticateApiKey` to return a `ServiceActor { orgId, scopes, caps }`; `apiHandler` `scope` enforcement (`SCOPE_REQUIRED`); cap enforcement in `compile/create` and `startFunding` (`SERVICE_ACCOUNT_CAP_EXCEEDED`); ledger/audit attribute `service_account`. Tests: `forbidden scope cannot be granted`, `key shown once`, `revoked key rejected`, `scope map per endpoint (table-driven)`, `caps enforced`, `agent cannot call decision/cancel/refund`.
4. **Developers page (C):** service accounts list/create dialog (scope checklist with plain-language descriptions), key modal, quickstart snippets (curl + MCP config) with the real base URL.
5. **MCP update (D):** `src/mcp/server.ts` uses service-account keys, surfaces cap/scope errors clearly; tools unchanged (six).
6. **Admin console (A, C):** `/admin` guarded by staff role (`platformRole in ('support','admin')` **and** MFA enrolled); `GET /admin/search`, `GET /admin/contracts/{id}`, `POST /admin/contracts/{id}/reconcile`, `POST /admin/emails/{id}/resend`, `GET /admin/jobs`; pages: search, contract inspector, jobs, emails. Read-only by construction; no money actions anywhere in `/admin`.
7. **Data export (A):** `GET /me/export` JSON; button in profile.
8. **Account deletion (R2)** documented only.

**Tests (named):** `non-staff gets 404 on /admin`, `staff without MFA is redirected to enroll`, `admin inspector shows ledger read-only`, `reconcile enqueues job`, `export contains only the caller's data`, `MFA enrollment flow (E2E)`, `session revoke logs out the other context`, `workspace settings change is audited`.

**Definition of done**
- [ ] Owner creates a service account with limited scopes; a `curl` with the key creates a contract (201) and fails to cancel (403) and to submit without the scope (403).
- [ ] MFA can be enabled/disabled; sessions can be revoked; audit log shows the actions.
- [ ] Staff can find a contract and view its full state read-only.

**Cut first:** admin users/orgs pages (keep contract inspector + jobs), plans page, role matrix view, data export button.
**Handoff:** agents integrate via scoped keys; settings and admin exist. **Tag:** `phase-15-settings-dev-admin`.

---

## Phase 16 — Marketing site & demo playground (Nov 6–8, 3 pd)

**Implements:** `04` §4.1, §4.20, §9 · `03` E1, E19 · `08` (fix list).

**Tasks**
1. **Landing (C):** rewrite `src/app/page.tsx` using the copy deck in `04` §9; sections: hero, 3 steps, who it's for, trust, product screenshots (use seeded Demo Workspace captures), developers strip, FAQ, footer. **Remove** persona cards, credentials, scenario buttons. Header: logo, How it works, Pricing, Docs, Sign in, **Create workspace** (primary).
2. **Pages (C):** `/how-it-works`, `/pricing` (Sandbox free; fee model "planned"), `/docs` (quickstart page: create contract → fund link → submit → status, scopes, errors; MCP snippet), `/legal/terms`, `/legal/privacy` (placeholders marked "draft, not legal advice", version constants), `/help`.
3. **Copy guard (D):** `scripts/check-copy.sh`: fails on forbidden phrases (`escrow` not preceded by `not `, `cryptographically verified`, `guaranteed payment`, `autonomous agents negotiate`, `100% accurate`); run in CI against `src/app`, `src/components`, `README.md`, `docs/`.
4. **Demo playground (D, C):** `src/app/demo/page.tsx` and `src/app/demo/run/[runId]/page.tsx` (moved from `/agent-console`); `POST /api/v1/demo/session` (`DEMO_MODE` only): signs in a seeded demo user (`demo-buyer@…`, `demo-seller@…`) with `auth.api.signInEmail` using `DEMO_USER_PASSWORD` and sets the active org to **Demo Workspace**; scenario runner switches to **service accounts** (`procure-bot`, `synthetix-bot`) with scoped keys created by the seed; credentials panel collapsed and labeled; reset job `PURGE_DEMO_DATA` disabled until Dec 16.
5. **README/Devpost link updates (A):** point to `/demo` and sign-up; update "Try it in 3 steps".

**Tests (named):** `landing contains no forbidden phrases` (copy script), `landing has exactly one primary CTA`, E2E `visitor creates workspace from landing`, `demo session lands in Demo Workspace as real session`, `scenario happy_path completes using service accounts`, Lighthouse a11y ≥ 95 on `/`.

**Definition of done**
- [ ] Landing contains none of the issues in `08` and passes the copy check.
- [ ] `/demo` works logged-out → one click → real session → scenario runs.
- [ ] Footer has legal, help, status/Docs links; no hackathon branding except a small footer credit.

**Cut first:** pricing page detail, FAQ items beyond 4, screenshot strip (use static mocks).
**Tag:** `phase-16-site-demo`.

---

## Phase 17 — Hardening & submission refresh (Nov 7–10, 3 pd)

**Tasks**
1. **Security/RBAC (A/B):** complete matrix tests, IDOR route table, enumeration tests (sign-in/sign-up/forgot responses equal), header/CORS/CSRF checks, impersonation guard, secrets scan; remove `REAL_AUTH` flag and legacy JWT path; drop reads of deprecated columns (`users.role`, `persona_key`).
2. **E2E (C/D):** specs `tests/e2e/real-flow.spec.ts`: (1) buyer signs up, verifies (Mailpit API), onboards, creates contract from template, sends; (2) seller signs up via invite, accepts; (3) buyer funds (PayPal stubbed in test) ; (4) seller submits bad then good; (5) both see release; (6) viewer cannot act; (7) finance approves funding above threshold. a11y on 8 key pages.
3. **Regression (B/A):** `npm run eval` (all sets), `npm run chaos`, scenario goldens, `check-money-invariants.sh`; confirm **no diff** in money-path files except attribution.
4. **Performance/visual pass (C):** dashboard and detail load < 2.5 s; fix layout shifts; dark mode check; screenshot set for README/Devpost.
5. **Docs (A/D):** update `README.md` (real product, sign-up flow, roles, honest sandbox notes, results), `docs/spec/*` supersession notes, `docs/runbook.md` (email provider, auth secrets rotation), Devpost text, **video v2** (`09`), `docs/submission-checklist.md`.
6. **Pre-submit checks:** `.claude/skills/hackathon-submission/scripts/check-submission.sh`, `scan-secrets.sh`, hosted `smoke:hosted` updated to include sign-up→verify (Mailpit not available hosted → use provider sandbox or pre-verified seed users).

**Definition of done:** all prior DoDs still true; E2E green; eval/chaos numbers re-generated; docs updated; video recorded Nov 10; submitted Nov 11.
**Tag:** `phase-17-hardening` → then Phase 10 (submission) tags.

---

## 2. Day plan (IST)

| Day | A (backend/PayPal) | B (AI/verification) | C (frontend) | D (infra/demo) |
|---|---|---|---|---|
| **Nov 3 (today)** | P11: env, auth config, schema/migration 0004 | Review P11 config; list route→permission table | P13: shell + nav + mocks; P11 auth pages | P11: Mailpit, email outbox/worker; confirm Resend/provider |
| **Nov 4** | P11 finish; P12 start (AC, migration 0006, backfill) | P12: `can()` + matrix tests | P13: onboarding, dashboard (mocks→real) | P11 seeds; P16 copy-guard script |
| **Nov 5** | P12: apiHandler perms, org scoping, approvals, audit | P12 review; P14 templates JSON + render | P13: inbox, contracts list; P14 invite pages | P13 seed-demo-data; start P16 landing copy |
| **Nov 6** | P14: send/invitations/accept, comments | P14: lint/template validation; eval baseline unaffected | P14: template picker, editor | P15: service accounts (with A); P16 pages |
| **Nov 7** | P14: notifications (`NOTIFY_FROM_LEDGER`) | P17: regression runs | P14 editor, P15 settings | P16 `/demo` relocation; MCP update |
| **Nov 8** | P15: service accounts/scopes, admin APIs | Security/enumeration tests | P15 settings/team/developers/admin UI | P16 finish; hosted deploy + smoke |
| **Nov 9** | P17 fixes; **freeze 23:59** | P17 fixes/eval | P17 polish, screenshots | P17 docs, README, video prep |
| **Nov 10** | P0 fixes only | P0 fixes only | Record video (with D) | **Record/edit/upload video** |
| **Nov 11** | Submit by **18:00 IST** | QA | QA | Verify links logged-out |

## 3. Quality gates (every phase)

Lint/typecheck/unit/integration green · named tests present · money invariants script passes · additive migrations check · no new route without `permission` · copy check passes · tag created · changes noted in `docs/decision-log.md`.

## 4. Cut list (apply in this order if behind; the judged story must stay intact)

1. Google sign-in · 2. command palette and keyboard shortcuts · 3. org templates ("save as") and version diff · 4. notification preferences UI (defaults only) · 5. admin users/orgs pages (keep contract inspector) · 6. payments filters/CSV · 7. MFA UI (keep backend plugin) · 8. docs site → one page · 9. role matrix view · 10. refund UI.
**Never cut:** real sign-up/login/verification · organizations + roles + permission enforcement · contract send/invite/accept between two orgs · funding approval policy · dashboard + inbox · honest landing + `/demo` · scoped API keys · audit log · regression of eval/chaos · video.

## 5. R2 impact notes (so R1 doesn't paint us into a corner)

- **Partner onboarding (seller payouts):** needs PayPal partner approval and a BN code. Changes concentrated in `src/server/paypal/orders.ts` (`payee.merchant_id`, `PayPal-Partner-Attribution-Id`, `PayPal-Auth-Assertion`, `payment_instruction.platform_fees`), a new `src/server/paypal/partner.ts` (referrals, status), and `paypal_connections.mode='PARTNER_CONNECTED'`. **Validate on a partner sandbox that `AUTHORIZE` + multiple partial captures + platform fees behave as the single-merchant spike did** before promising it. Until then: platform-account mode with honest UI copy.
- **Attachments:** object storage (S3-compatible) with checksums and scanning; verification supports `human` criteria for non-text.
- **Outbound webhooks:** reuse the outbox pattern.

## 6. Kickoff prompts for the coding agent (copy/paste)

- **Per phase:** "Execute Phase N from `docs/product/07-release-plan-r1.md`. Read the referenced sections in `02/03/04/05/06` first. Write the named tests before the implementation, run the commands listed, keep money-path files unchanged, and stop when the definition of done is met. List any deviations and add ADRs to `docs/decision-log.md`."
- **UI phases:** "Build every state (loading, empty, error, forbidden, success) for each screen in `04-ux-design-spec.md` section X. No lorem ipsum. Use the tokens and components in `ux-flows.md` and `04` §6. Run axe and fix serious/critical issues."
- **Review prompt:** "Review this diff with the `code-reviewer` skill. Flag any route without a `permission`, any query not scoped to the active org, any change under `src/server/release/`, and any copy that violates `01` §8."
