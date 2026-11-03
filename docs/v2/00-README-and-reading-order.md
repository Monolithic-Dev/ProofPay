# ProofPay — Product Spec v2 ("real product", not a demo)

> **Audience:** you (product owner) and your coding agents.
> **Date:** Tuesday, Nov 3, 2026 (an earlier plan assumed Nov 2; this package uses the real date).
> **Deadlines:** feature freeze **Nov 9 23:59 IST** · record **Nov 10** · submit **Nov 11 by 18:00 IST** · official cutoff Nov 12 12:00 PT = Nov 13 01:30 IST.

## Why this package exists (honest diagnosis)

Review of the running build (landing page at `localhost:3000`) shows a **demo, not a product**:

- The front door is "Judge Mode" with four hard-coded personas. There is **no sign-up, no login, no email verification, no organizations, no roles, no real users**.
- The earlier spec chose this on purpose to hit a 10-day hackathon: demo-persona auth, one sandbox merchant, no orgs, no RBAC. That choice was right for a proof of concept and wrong for what you now want. The agent built what the spec said.
- Marketing copy contains **claims the product does not support**: "escrow" (twice), "cryptographically verified proof of funds", "autonomous agents negotiate agreements". These contradict the product's own honesty rule and must be fixed.

This package replaces the demo assumptions with a real product design: real accounts, organizations, role-based access, onboarding, notifications, a proper app shell, and the existing money/verification engine underneath.

## What stays, what changes

| Area | Stays (already specified/built) | Changes (this package) |
|---|---|---|
| Money & verification engine | Authorize → verify → partial capture → void; ledger; policy engine; PayPal rules | Contracts belong to **organizations**; seller payout connection abstracted |
| Auth | – | **Replaced** by real auth (Better Auth: email+password, verification, reset, MFA, orgs, invitations, roles, admin) |
| Users & roles | – | Org-based RBAC, staff roles, service accounts for agents |
| UI | Timeline, Funds Bar, Report, Ledger components | New app shell, dashboard, inbox, templates, team, settings, developers, admin |
| Demo | Five scenarios | Moved to a separate **/demo playground**; no longer the front door |
| Spec docs superseded | – | `prd.md` §4 personas, `security-privacy.md` §2 (auth), `api-spec.md` §2/§4 (auth), `ux-flows.md` S0/S8, anything about `DEMO_MODE` persona login |

## Reading order

| # | File | Role | What it answers |
|---|---|---|---|
| 01 | `01-product-vision-and-scope.md` | Product owner | Who is this for, what is real vs simulated, what ships in R1/R2/R3, how we describe it truthfully |
| 02 | `02-users-auth-rbac.md` | PO + security + backend | Every kind of user, auth flows, organizations, roles, permission matrix, policies, agents, staff |
| 03 | `03-feature-specs.md` | PO + dev | ~100 user stories with acceptance criteria, by epic, tagged R1/R2/R3 |
| 04 | `04-ux-design-spec.md` | Designer | Sitemap, app shell, every screen and state, landing copy, emails, design system additions |
| 05 | `05-data-model-v2.md` | Backend/DB | New tables, changes to existing tables, migration from the demo schema |
| 06 | `06-api-and-permissions.md` | Backend | Endpoints, permission per endpoint, error codes, outbound webhooks |
| 07 | `07-release-plan-r1.md` | Tech lead | Phases 11–17 with tasks, tests, definition of done, day plan, cut list |
| 08 | `08-current-build-review.md` | Everyone | Exact problems found in the pasted build and the fix for each |

## Release tiers (summary)

- **R1 — "Real core" (ship by Nov 10, inside the sandbox):** real auth, organizations, roles (Owner/Admin/Finance/Member/Viewer), invitations, app shell + dashboard + needs-attention inbox, templates, counterparty invites, comments, notifications (in-app + email), org API keys with scopes, minimal admin console, audit log, honest marketing site, `/demo` playground.
- **R2 — "Money for real sellers" (next ~6 weeks):** PayPal partner onboarding for sellers, platform fees, disputes center, file attachments, outbound webhooks, MFA enforcement, amendments.
- **R3 — "Scale & trust":** SSO/SAML, custom roles, analytics, reputation, regional/currency support, mobile polish, billing.

## How to hand this to a coding agent

1. Put these files in `docs/product/` in the repo (and keep `docs/spec/` and `docs/plan/` from earlier).
2. Install the skills pack at the repo root (`.claude/skills/`).
3. Kickoff prompt (paste once):
   > Read `docs/product/00-README-and-reading-order.md`, then `02-users-auth-rbac.md`, `05-data-model-v2.md`, and `07-release-plan-r1.md`. We are executing Phase 11. Follow the phase runbook exactly: create the named files, write the named tests first, run the commands, and stop when the definition of done is met. Do not change the money path (`src/server/release`, `src/server/paypal`) except where the phase says so. Report deviations as ADR entries in `docs/decision-log.md`.
4. For each later phase: "Execute Phase N from `07-release-plan-r1.md`." Review each PR against the phase's definition of done before starting the next.
5. UI work: give the agent `04-ux-design-spec.md` plus the specific screen section, and ask it to build **all states** (loading, empty, error, success), not just the happy path.

## Glossary

- **Organization (org / workspace):** the account that owns contracts, money views, members and API keys. A person can belong to several.
- **Side:** on a contract an org is either the **buyer side** or the **seller side**. One org can be buyer on one contract and seller on another.
- **Member / role:** a user's membership in an org with a role (`owner`, `admin`, `finance`, `member`, `viewer`).
- **Staff:** ProofPay employees (`support`, `admin`) with platform-level access, separate from org roles.
- **Service account:** a non-human identity inside an org used by agents/integrations, with scoped API keys.
- **Hold:** a PayPal authorization on the buyer's PayPal funding source. **Not escrow.**
- **Proof Pack:** exportable evidence bundle (contract hash, submissions, verifications, ledger).

## Non-negotiables that carry over

AI proposes, code decides, PayPal moves the money · capture only from `PASSED` through the single release gateway · integer minor units · append-only hash-chained contract ledger · idempotency everywhere · sandbox-only until PayPal partner approval and legal review · honest copy ("authorization hold, not escrow").
