# 03 — Feature Specs (epics, stories, acceptance criteria)

> Release tags: **R1** (build now), **R2** (next ~6 weeks), **R3** (later). "AC" = acceptance criteria (each is testable). All money amounts are USD, shown with the sandbox badge. Permissions refer to `02-users-auth-rbac.md`. Existing engine behavior (verification, release, ledger) is unchanged unless stated.

## E1 — Public site & onboarding

| ID | Story | AC | Rel |
|---|---|---|---|
| E1-1 | As a visitor I understand what ProofPay does in 5 seconds | Landing shows headline, 3-step explainer, who it's for, honest trust section, CTA "Create a free sandbox workspace"; contains none of the forbidden claims (`01` §8); Lighthouse a11y ≥ 95 | R1 |
| E1-2 | As a visitor I can read how it works, pricing and docs | Pages `/how-it-works`, `/pricing` ("Sandbox: free; fees planned"), `/docs` (API + MCP quickstart), legal `/legal/terms`, `/legal/privacy` with version numbers | R1 |
| E1-3 | As a visitor I can try a guided playground without signing up | `/demo` explains the playground, offers scenarios with a clear "Sandbox playground" banner; not linked as the main CTA | R1 |
| E1-4 | As a new user I complete onboarding in under 3 minutes | Wizard: (1) workspace name, (2) intent (get paid / buy work / both), (3) optional PayPal connection, (4) optional invite teammates; each step skippable except (1); progress saved; resumable | R1 |
| E1-5 | As a new user I see a getting-started checklist | Dashboard checklist: verify email, create workspace, create first contract from a template, invite a teammate, connect PayPal; items tick automatically; dismissible | R1 |

## E2 — Accounts & security

| ID | Story | AC | Rel |
|---|---|---|---|
| E2-1 | Sign up with email/password | Password ≥ 12 chars; strength meter; Terms/Privacy checkbox recorded; verification email sent; unverified gate shown on app routes | R1 |
| E2-2 | Verify email | Link valid 24 h, single use; success signs user in; resend limited 3/h; expired link shows resend | R1 |
| E2-3 | Sign in / out | Generic error on failure; redirect to intended page; sign-out clears cookie and server session | R1 |
| E2-4 | Sign in with Google | Works when credentials configured; links to existing account if verified email matches; button hidden when not configured | R1 (if creds by Nov 5) |
| E2-5 | Reset password | Always-generic response; 1 h single-use token; reset revokes all sessions; notification email | R1 |
| E2-6 | Change password/email | Re-auth required; email change verifies new address, notifies old; other sessions revoked | R1 |
| E2-7 | Manage sessions | List with device/browser/last active; revoke one/all others; current session labeled | R1 |
| E2-8 | Enable TOTP MFA | QR + code confirm; 10 backup codes shown once; sign-in requires code; disable requires password+code | R1 (optional) |
| E2-9 | Org-enforced MFA | Owner can require MFA for roles; non-compliant users forced to enroll at next sign-in | R2 |
| E2-10 | Profile | Name, avatar initials, timezone, locale (en), notification preferences link | R1 |
| E2-11 | Delete account & export data | Per `02` §3.11; export JSON of profile/memberships | R1 (export) / R2 (delete) |

## E3 — Organizations & team

| ID | Story | AC | Rel |
|---|---|---|---|
| E3-1 | Create and switch workspaces | Creating a workspace makes me Owner; org switcher in top bar; active org persisted in session; data views filter by it | R1 |
| E3-2 | Invite teammates | Owner/Admin invites by email + role; pending invites list with resend/revoke; 7-day expiry; accepting adds membership | R1 |
| E3-3 | Manage members | Change role, remove member; last Owner protected; changes audited; takes effect on next request | R1 |
| E3-4 | Transfer ownership | Requires password re-entry + new owner acceptance; audit event | R1 |
| E3-5 | Workspace settings | Name, slug, default auto-release hours, funding approval threshold, members-can-accept toggle, notification defaults | R1 |
| E3-6 | Leave workspace | Allowed unless last Owner | R1 |
| E3-7 | Teams/groups | Group members and assign contracts to groups | R3 |

## E4 — RBAC & policies

| ID | Story | AC | Rel |
|---|---|---|---|
| E4-1 | Roles enforced server-side | Table-driven test over matrix (`02` §5.2) passes; every API route declares a permission; undeclared route fails CI | R1 |
| E4-2 | UI reflects permissions | Buttons/nav hidden or disabled with tooltip "Requires Finance or Admin"; direct URL access shows 403 page with explanation | R1 |
| E4-3 | Funding approval workflow | Above threshold: requester clicks "Request approval"; approvers get a notification; approve/reject with reason; requester notified; Fund enabled only after approval; approver ≠ requester | R1 |
| E4-4 | Custom roles | Create roles from permission checklist | R3 |

## E5 — PayPal connection & payouts

| ID | Story | AC | Rel |
|---|---|---|---|
| E5-1 | See PayPal connection status | Settings → Payments shows mode (`Platform sandbox account`), status, explanation: "Sandbox: captured funds go to the platform test merchant; no real payouts." | R1 |
| E5-2 | Buyer approval via PayPal | Funding redirects to PayPal; return/cancel handled; hold status visible with "Verified with PayPal" timestamp | R1 |
| E5-3 | Seller connects own PayPal Business account | Partner Referrals onboarding link; status tracking (pending/active/restricted); permissions granted shown; disconnect | R2 (requires PayPal partner approval) |
| E5-4 | Route funds to seller's account | Orders use the seller's merchant id with auth assertion; platform fee applied; reconcile handles seller-side states | R2 |
| E5-5 | Payout & fee transparency | Per capture: gross, platform fee, PayPal fee (as reported), net to seller; statement export | R2 |

## E6 — Contract creation

| ID | Story | AC | Rel |
|---|---|---|---|
| E6-1 | Start from a template | `/app/contracts/new` shows ≥ 3 system templates (Dataset + summary, Content batch, Translation) and "From plain English" and "Blank"; selecting a template asks for variables (title, quantities, amounts, due days) and generates a valid contract | R1 |
| E6-2 | AI compile + lint | As built: compile from prompt; lint issues with one-click fixes; errors block sending | R1 |
| E6-3 | Edit contract structurally | Form editor for milestones/criteria (add/remove/reorder, change amounts/due days, pick check type + parameters from a registry-driven form); JSON editor under "Advanced"; live lint | R1 |
| E6-4 | Save as org template | Owner/Admin/Member can save a contract as an org template with variables | R1 |
| E6-5 | Duplicate contract | Copy as new draft | R1 |
| E6-6 | Version history before acceptance | Each send creates a version with hash; seller sees diffs between versions | R1 (versions) / R2 (visual diff) |
| E6-7 | Draft autosave | Changes saved within 2 s; "Saved" indicator; conflict warning if edited elsewhere | R1 |
| E6-8 | Amendments after lock | Both orgs approve a change; new hash; PayPal authorization delta handling | R2 |

## E7 — Counterparties & invitations

| ID | Story | AC | Rel |
|---|---|---|---|
| E7-1 | Choose or invite the other party | Pick from saved counterparties or type an email; sending creates an invitation (token hashed, 14-day expiry, bound to email) and emails it | R1 |
| E7-2 | Invitee reviews the contract | Link → sign in/up with the invited email → contract view (read-only) with criteria, hash preview, discussion | R1 |
| E7-3 | Invitee chooses the acting org | If they have several orgs: select; if none: create one inline; contract's `seller_org_id` (or buyer) set on accept | R1 |
| E7-4 | Decline with reason | Decline records reason; sender notified; contract `CANCELLED` | R1 |
| E7-5 | Counterparty directory | CRUD of saved counterparties; auto-saved on first invite; shows past contracts | R1 |
| E7-6 | Resend/revoke invitation | Resend (rate-limited) and revoke; revoked link shows friendly page | R1 |

## E8 — Discussion & acceptance

| ID | Story | AC | Rel |
|---|---|---|---|
| E8-1 | Comment on a contract or milestone | Threaded by contract/milestone; markdown-lite; author org/role shown; notifications to the other side; no editing after 5 min (edit history kept) | R1 |
| E8-2 | Request changes | Seller flags a criterion/amount with a suggested change; buyer can accept the suggestion which edits the draft and creates a new version | R2 |
| E8-3 | Accept & lock | Seller org Owner/Admin (or Member if policy) accepts; shows hash; ledger `CONTRACT_ACCEPTED`; contract immutable | R1 |
| E8-4 | Mutual cancellation before funding | Either side can cancel in `DRAFT/PROPOSED/ACCEPTED`; reason recorded | R1 |

## E9 — Funding & holds

| ID | Story | AC | Rel |
|---|---|---|---|
| E9-1 | Fund a locked contract | Fund page explains "held, not charged"; threshold policy enforced; PayPal approval; funded banner for both sides | R1 |
| E9-2 | Hold health | Contract header shows honor-period and expiry countdowns, "funding at risk" banner with action, "Verified with PayPal" badge | R1 |
| E9-3 | Re-fund flow | When expired/voided externally: buyer can re-fund to continue; ledger records | R2 |
| E9-4 | Cancel funded contract | Allowed when no milestone is in verification/escalation; voids remaining hold | R1 |

## E10 — Delivery & submissions

| ID | Story | AC | Rel |
|---|---|---|---|
| E10-1 | Submit deliverable (JSON/text) | As built; paste or upload file ≤ 1 MiB; client validation; progress stepper | R1 |
| E10-2 | Submission history | All attempts with hashes, timestamps, verification outcomes; download original | R1 |
| E10-3 | Attachments (files) | Upload to object storage (≤ 25 MB each), checksum, malware scan; attached to submissions for human review criteria | R2 |
| E10-4 | Contributors see only seller-side actions | Buyer members cannot submit; seller members cannot decide | R1 |

## E11 — Verification & review

| ID | Story | AC | Rel |
|---|---|---|---|
| E11-1 | Verification report | As built (decision, criteria, evidence highlight, manipulation callout) | R1 |
| E11-2 | Review inbox for escalations | Buyer-side users with permission see escalations in `/app/inbox` with countdown to auto-release; approve/reject with note | R1 |
| E11-3 | Re-verify on request | Seller may request re-verification after fixing (counts as a new attempt, no free retries) | R1 |
| E11-4 | Contest a rejection | Seller disputes a rejection → buyer must review within N hours or the milestone escalates to support mediation | R2 |
| E11-5 | Criteria transparency | Seller sees the exact criteria before work starts and the same criteria in the report | R1 |

## E12 — Release, payments & documents

| ID | Story | AC | Rel |
|---|---|---|---|
| E12-1 | Payments page | Per org: holds (open), released, voided, refunded, with totals and per-contract rows; filter by date/status/counterparty; CSV export | R1 (view) / R2 (CSV) |
| E12-2 | Receipts | Per captured milestone: receipt page + PDF (amount, PayPal capture id, contract id, hash, date) | R1 (page) / R2 (PDF) |
| E12-3 | Proof Pack | JSON (R1) and PDF (S) export from contract page | R1 |
| E12-4 | Refund | Seller-side Finance/Admin/Owner can refund partially/fully with reason; ledger + audit | R1 (S) |
| E12-5 | Retry failed release | Buyer-side Finance/Admin/Owner retry with banner explaining the decline | R1 |

## E13 — Disputes & support

| ID | Story | AC | Rel |
|---|---|---|---|
| E13-1 | Open a dispute | From contract: reason, description; freezes further auto-release on that milestone; notifies other side and support | R2 |
| E13-2 | Support mediation | Staff view evidence, add notes, propose resolution (no money actions by staff; parties execute via normal flows) | R2 |
| E13-3 | PayPal dispute evidence | Proof Pack submitted via provide-evidence API when a PayPal dispute exists | R2 |
| E13-4 | Help & contact | `/help` page and "Contact support" form creating a support ticket row + email | R1 |

## E14 — Notifications & email

| ID | Story | AC | Rel |
|---|---|---|---|
| E14-1 | In-app notification center | Bell with unread count; list with deep links; mark read/all; real-time via SSE polling | R1 |
| E14-2 | Transactional emails | Verify email, welcome, password reset/changed, org invite, contract invite, contract proposed, accepted, funded (seller), submission received, verification result (seller), escalation (buyer), released (both), failed/voided, expiry warnings (72 h/24 h), approval requested/decided | R1 |
| E14-3 | Preferences | Per event type: in-app/email toggles; org defaults; security emails cannot be disabled | R1 |
| E14-4 | Email outbox | Emails sent by worker with retry/backoff; failures visible to staff; resend support | R1 |
| E14-5 | Slack/webhook notifications | Outbound webhooks (signed) for contract events | R2 |

## E15 — Developer platform

| ID | Story | AC | Rel |
|---|---|---|---|
| E15-1 | Service accounts & scoped keys | Per `02` §5.4; keys shown once; last used; revoke; caps | R1 |
| E15-2 | API docs | `/docs` with quickstart (create contract, fund link, submit, status), auth, scopes, errors, rate limits; OpenAPI JSON download | R1 (quickstart) / R2 (OpenAPI generated) |
| E15-3 | MCP server | Six tools with scoped key; config snippet; tool list excludes approvals/refunds | R1 (S) |
| E15-4 | Outbound webhooks | Endpoints with secret, event selection, delivery log, retries with backoff, signature header | R2 |
| E15-5 | Sandbox/production switch | Environment badge; keys tied to environment | R2 |

## E16 — Dashboard, inbox, search

| ID | Story | AC | Rel |
|---|---|---|---|
| E16-1 | Role-aware dashboard | Needs-attention list (top), money summary (held/released/at risk), active contracts, upcoming deadlines; buyer and seller sections appear based on org activity | R1 |
| E16-2 | Inbox | Unified list of items requiring action with type icons, contract link, due time; filters; zero-state "You're all caught up" | R1 |
| E16-3 | Contracts list | Filters (status, side, counterparty, date), sort, search by title/id/counterparty, pagination; empty state with CTA | R1 |
| E16-4 | Global search (⌘K) | Search contracts, counterparties, templates, members; keyboard navigable | R1 (S) |
| E16-5 | Reports | Cycle time, pass rate, escalation rate, cash flow by month | R3 |

## E17 — Admin / back-office

| ID | Story | AC | Rel |
|---|---|---|---|
| E17-1 | Staff console | `/admin` for staff only: users, orgs, contracts search; contract inspector (state, ledger, verification, PayPal ids, jobs); health and queue | R1 (minimal) |
| E17-2 | Support actions | Resend emails, reconcile contract, view webhooks | R1 |
| E17-3 | Admin actions | Ban/unban, revoke sessions, feature flags, rerun jobs | R2 |
| E17-4 | Read-only impersonation | Per `02` §4 with banner and audit | R2 |

## E18 — Settings, privacy, legal

| ID | Story | AC | Rel |
|---|---|---|---|
| E18-1 | Settings hub | Profile, Security, Notifications, Workspace, Team, Payments, Developers, Audit log, Plans | R1 |
| E18-2 | Audit log view | Filter by actor/action/date; shows request id | R1 |
| E18-3 | Legal pages | Terms/Privacy with versions; consent history in profile | R1 |
| E18-4 | Data export | JSON export from profile | R1 |

## E19 — Demo playground

| ID | Story | AC | Rel |
|---|---|---|---|
| E19-1 | Playground separate from product | `/demo` signs a visitor into a **real session** as a seeded demo user inside a **Demo Workspace**; banner "Sandbox playground — data resets"; five scenarios as built | R1 |
| E19-2 | Sandbox credentials shown only in `/demo` | Not on landing; labeled sandbox-only | R1 |
| E19-3 | Reset | Scheduled purge of demo workspace data older than 24 h (disabled until Dec 16 to keep judges' runs) | R1 |

## Cross-cutting non-functional requirements

- **Accessibility:** WCAG 2.1 AA; keyboard paths for all flows; status not color-only; axe clean on key pages.
- **Performance:** dashboard TTI < 2.5 s on broadband; API p95 < 400 ms excluding LLM/PayPal.
- **Security:** per `02` and `security-privacy.md`; all new routes covered by the IDOR/permission route-table test.
- **Observability:** request id in every error and email footer for support; structured logs; audit log.
- **i18n:** English only; timezone-aware date display; currency USD.
- **Resilience:** email/notification failures never block money or verification flows.
