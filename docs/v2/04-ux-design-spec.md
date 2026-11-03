# 04 — UX & Design Spec (Designer view)

> Extends `ux-flows.md` (tokens, Funds Bar, Report, Ledger). Everything here is about turning the demo into a **product people live in**: app shell, role-aware navigation, real onboarding, and every screen with all of its states.

## 1. Design goals

1. **Feels like a financial product, not a hackathon page:** calm, precise, trustworthy; no gimmicks.
2. **Home = "what do I need to do next?"** (inbox + money at a glance).
3. **Every screen has loading, empty, error, forbidden and success states.** No blank panels, no raw JSON errors.
4. **Money is always legible:** amounts, hold status, countdowns, and "sandbox" labels in the same place on every contract.
5. **Role-aware, not role-split:** one app; navigation and actions adapt to the user's role and the org's side on each contract.
6. **Explain the AI:** reports show evidence and the policy decision; never "the AI approved it".

## 2. Sitemap and route mapping

```
Public        /                 landing            /how-it-works   /pricing   /docs   /legal/terms   /legal/privacy
              /help             help + contact     /demo           playground (separate from product)
Auth          /sign-up  /sign-in  /verify-email  /forgot-password  /reset-password  /invite/[token]  /mfa
Onboarding    /onboarding       4-step wizard
App           /app                              dashboard
              /app/inbox                        needs attention
              /app/contracts                    list      /app/contracts/new   template picker + prompt
              /app/contracts/[id]               tabs: Overview · Milestones · Discussion · Activity · Documents · Settings
              /app/contracts/[id]/edit          editor (form + lint + advanced JSON)
              /app/contracts/[id]/fund          fund
              /app/contracts/[id]/milestones/[key]   submit + verification report + review
              /app/payments                     holds / released / refunds        /app/payments/[captureId]  receipt
              /app/counterparties               directory                         /app/templates
              /app/team                         members · invitations · roles
              /app/developers                   service accounts · keys · docs · webhooks (R2)
              /app/settings/{profile,security,notifications,workspace,payments,audit,plans}
              /app/notifications                full list
Admin         /admin  /admin/users  /admin/orgs  /admin/contracts/[id]  /admin/jobs  /admin/emails   (staff only)
Errors        /403  /404  /500  (+ unverified-email gate, org-required gate)
```

**Existing → new route mapping (agent must migrate and keep redirects):** `/studio` → `/app/contracts/new`; `/studio/[id]` → `/app/contracts/[id]/edit`; `/contracts` → `/app/contracts`; `/contracts/[id]` → `/app/contracts/[id]`; `/contracts/[id]/fund|ledger|milestones/[mid]` → under `/app/contracts/[id]/...`; `/settings/api-keys` → `/app/developers`; `/agent-console/[runId]` → `/demo/run/[runId]`. API routes under `/api/v1` do not change.

## 3. App shell

- **Left sidebar (collapsible; bottom sheet on mobile):** Dashboard · Inbox (badge count) · Contracts · Payments · Counterparties · Templates · Team · Developers · Settings. Staff see an extra "Admin" link.
- **Top bar:** workspace switcher (avatar, name, role chip) · global search (⌘K) · **Sandbox badge** (always) · notifications bell (unread count) · user menu (Profile, Security, Switch workspace, Sign out).
- **Visibility rules:** hide items the role can't use (Viewer: no Templates write, no Developers; Finance: no Team management, no Templates write; Member: no Payments, Team read-only, no Developers). If a user opens a hidden URL: `/403` with "You need the **Finance** or **Admin** role. Ask <Owner name> to change your role."
- **Global banners (top, dismissible only when non-critical):** unverified email (blocking features), funding at risk, impersonation (red, not dismissible), maintenance.
- **Keyboard:** `g` then `d/i/c/p` for navigation, `/` focuses search, `n` new contract, `?` shortcut help.

## 4. Screens (purpose · layout · states · key copy)

### 4.1 Landing `/` (replace the current page; copy in §9)
Hero with one primary CTA ("Create a free sandbox workspace") and one secondary ("See how it works"); 3-step explainer; "Who it's for" (agencies, buyers, agent builders); **Trust section** (authorization hold not escrow, evidence trail, AI advises/rules decide, sandbox); product screenshot strip (dashboard, report, Funds Bar); developers/agents strip (API + MCP); FAQ (6 items); footer (Product, Developers, Legal, Status, "Built for the PayPal AI Hackathon" small credit). **No personas, no credentials, no scenario buttons here.**

### 4.2 Auth pages
- **Sign up:** email, password (strength meter), Terms/Privacy checkbox, Google button (if configured). Errors inline; "Check your email" confirmation screen with resend.
- **Sign in:** email, password, "Forgot password?", Google, link to sign up. Generic failure copy. MFA step: 6-digit input + "Use a backup code".
- **Verify email gate (in-app):** full-width card "Verify your email to start" with Resend (cooldown timer) and "Change email". All other app pages locked behind it except Settings → Profile.
- **Invite accept `/invite/[token]`:** shows who invited you and to what (workspace + role, or contract). States: valid, expired, revoked, wrong account ("You're signed in as a@x.com; this invite is for b@y.com — sign out and continue").
- **Forgot/reset:** generic confirmation; reset form with strength meter; success returns to sign-in.

### 4.3 Onboarding wizard `/onboarding`
Step 1 *Name your workspace* (required) → Step 2 *What will you do?* (Get paid for work / Buy work / Both; shapes dashboard emphasis) → Step 3 *PayPal* ("Connect later" default; shows honest sandbox note) → Step 4 *Invite teammates* (emails + role; skip). Progress dots, Back/Skip, saved state, finish → dashboard with checklist.

### 4.4 Dashboard `/app`
Top: greeting + role chip. Section A **Needs your attention** (max 5 items; links to Inbox). Section B **Money at a glance:** three stat tiles (Held · Released this month · At risk) + small Funds Bar summary. Section C **Active contracts** table (Title, Counterparty, Side chip, Status, Next deadline, Funds mini-bar). Section D **Getting started checklist** (until complete/dismissed). Seller-heavy orgs also see **Awaiting acceptance** and **Upcoming deadlines**.
States: empty (illustration + "Create your first contract" + templates shortcut), loading skeletons, error card with retry.

### 4.5 Inbox `/app/inbox`
Unified list: icon (type), title, contract link, counterparty, due/auto-release countdown, primary action button ("Review", "Approve funding", "Submit work", "Fix & resubmit", "Retry release"). Filters: All · Buyer tasks · Seller tasks · Approvals. Zero state "You're all caught up". Items disappear when resolved (SSE-driven).

### 4.6 Contracts list `/app/contracts`
Filters (status, side, counterparty, date range), search, sort, saved filters (R2); table with Side chip, status chip, total, held/released mini-bar, next deadline; pagination (25/page); row click → detail. Bulk actions: none in R1. Empty/filtered-empty states with reset.

### 4.7 New contract `/app/contracts/new`
Three cards: **From a template** (gallery: Dataset + summary, Content batch, Translation; org templates), **From plain English** (prompt box with examples), **Blank**. Template selection opens a variable form (title, quantity, amounts, due days) with a live preview of milestones and criteria. After creation → editor.

### 4.8 Contract editor `/app/contracts/[id]/edit`
Left: stepper **Parties → Milestones → Criteria → Policy → Review**. Center: forms (milestone cards with amount/due days/deliverable type; criteria rows with type badge and a registry-driven parameter form, e.g., "Row count ≥ [25]"). Right: **Lint panel** (errors/warnings/info with one-click fixes) and **Summary card** (total, milestones, hold window, "Funds held 29 days max"). Footer: Save draft (autosave indicator), **Send to counterparty** (disabled until lint errors cleared; tooltip lists blockers). Advanced: JSON editor with schema validation.
Counterparty step: pick saved, or enter email + name; shows what they'll see.

### 4.9 Contract detail `/app/contracts/[id]`
Header: title, status chip, side chip ("You are the **buyer**"), counterparty, **Funds Bar**, countdown chips, Verified-with-PayPal badge, funding-at-risk banner, primary action button (contextual: Send, Accept, Fund, Submit, Review, Retry release). Tabs:
- **Overview:** milestone timeline cards with statuses and next actions; summary of criteria; contract hash and acceptance info.
- **Milestones:** table with attempts, decisions, links to reports.
- **Discussion:** thread (comments by org/role), composer, system events inline (collapsible).
- **Activity:** AG Grid ledger (as built) + chain badge + drawer.
- **Documents:** Proof Pack (JSON/PDF), receipts, submission downloads (R2 for attachments).
- **Settings:** cancel contract, duplicate, save as template, auto-release hours (before accept only).
States: draft (limited tabs), forbidden, not found, loading.

### 4.10 Fund `/app/contracts/[id]/fund`
Summary card; "Held, not charged" explainer; policy panel: if threshold applies → "Approval required from Finance/Admin/Owner" with **Request approval** (shows status Pending/Approved/Rejected with approver name and reason). When approved or not required: **Continue to PayPal**. Return states: success toast + funded banner; cancelled; PayPal error with debug id in a collapsible.

### 4.11 Milestone page (submit + report + review)
As built plus: attempt selector, **side-aware actions** (seller sees Submit/Fix; buyer sees Review/Approve/Reject for escalations), countdown to auto-release, "Discuss this milestone" link, "Request re-verification".

### 4.12 Payments `/app/payments`
Tiles (Open holds, Released, Voided, Refunded) + table of captures/holds by contract with receipt links; filters; export CSV (R2); sandbox note: "Sandbox amounts are test money." Receipt page: amount, capture id, contract id/hash, date, parties, "View in ledger".

### 4.13 Counterparties, Templates
Directory table (name, email, org if linked, contracts count, last contract). Templates: cards with name, category, last used, "Use template"; editor reuses contract editor with variables panel (R1: create from a contract via "Save as template"; separate template editor R2).

### 4.14 Team `/app/team`
Tabs **Members** (name, email, role select, joined, last active, remove) · **Invitations** (email, role, status, resend/revoke) · **Roles** (read-only matrix of permissions; custom roles R3). Invite dialog: emails (multi), role, message. Destructive actions confirm with consequences ("Removing Alex ends their access immediately").

### 4.15 Developers `/app/developers`
Tabs **Service accounts** (list; create → name, scopes checklist, caps; keys list with last used, revoke, rotate) · **Quickstart** (curl + MCP config with the user's base URL) · **Webhooks** (R2) · **Docs** link. Keys shown once in a modal with copy and "I've stored it" confirm.

### 4.16 Settings
Profile (name, timezone, avatar initials, export data) · Security (password, MFA setup with QR + backup codes, sessions list with revoke) · Notifications (matrix: event × in-app/email; security rows locked) · Workspace (name, slug, defaults, **funding approval threshold**, members-can-accept toggle, danger zone: transfer ownership, delete workspace) · Payments (PayPal connection card with mode/status and honest explanation; R2 "Connect PayPal Business" button disabled with "Requires PayPal partner approval — coming soon") · Audit log (filterable table) · Plans ("Sandbox: free", fee model "planned").

### 4.17 Notifications `/app/notifications`
List grouped by day; unread dot; click → deep link; "Mark all read"; filter by type.

### 4.18 Admin (staff only; minimal R1)
Search bar (user email / org / contract id) → results; **Contract inspector**: state, parties, ledger (read-only), verifications, jobs, PayPal ids, emails sent, actions (Reconcile, Resend email). Users page (verified?, orgs, last sign-in). Jobs page (counts by status, failing jobs). Emails page (outbox with status).

### 4.19 System pages
403 (explains missing role and who can grant it), 404, 500 with request id + copy, offline/SSE-lost toast ("Live updates paused; refreshing every 5 s").

### 4.20 Demo playground `/demo`
Clear "Sandbox playground" header and short explainer; **Start as**: Buyer or Seller (creates a real session in the **Demo Workspace** via the demo-session endpoint); five scenario cards (as built, renamed: Happy path, Self-correction, Injection defense, Declined payment recovery, Silent buyer); sandbox buyer credentials panel (collapsed by default, copy buttons, "sandbox only"); link to the recorded demo. Footer: "This playground uses test money."

## 5. Key flows

1. **Sign-up → first contract:** Sign up → verify email → onboarding (workspace) → dashboard checklist → New contract → template → edit → lint clean → **Send** to `seller@…` → confirmation with "We emailed Alex" and share link.
2. **Counterparty:** Email → `/invite/[token]` → sign in/up with the invited email → choose acting workspace → read contract, discuss → **Accept** → buyer notified.
3. **Funding with approval:** Requester opens Fund → threshold applies → Request approval → Finance gets notification/email → Approve → requester notified → Continue to PayPal → approve hold → funded banner → seller notified "Funds secured".
4. **Delivery:** Seller → milestone → submit → stepper → rejected (exact fixes) → resubmit → passed → "Released $60.00 via PayPal" toast → receipt.
5. **Escalation:** Buyer inbox item → review evidence → approve/reject (or auto-release countdown).
6. **Agent:** Developers → create service account (scopes) → key → curl/MCP quickstart → contract created by agent appears in dashboard with an "agent" chip; funding requires human PayPal approval.

## 6. Design system additions

- **Tokens, typography, Funds Bar, status chips, evidence highlight, AG Grid ledger:** unchanged from `ux-flows.md`.
- **New components:** `AppShell`, `Sidebar`, `OrgSwitcher`, `CommandPalette`, `NotificationBell`, `RoleChip`, `SideChip` (Buyer/Seller), `DataTable` (sortable, filterable, paginated), `StatTile`, `Stepper`, `EmptyState` (icon, title, body, CTA), `ForbiddenState`, `Banner` (info/warn/critical), `ConfirmDialog` (money variant shows amount and consequence), `InviteDialog`, `PermissionGate` (`<Can action="funding:approve" fallback={...}>`), `Avatar` (initials), `CopyField`, `Timeline` (comments + system events), `ChecklistCard`.
- **Layout:** 12-column grid, 1280 px max content width, 24 px page padding, 8-pt spacing; tables use 44 px rows; forms single column up to 560 px.
- **Money confirm pattern:** dialog title "Release $60.00?", body states the result ("This captures $60.00 from the hold. It can't be undone."), primary button repeats the verb and amount.
- **Loading:** skeletons matching final layout; never spinners over blank pages. **Errors:** inline field errors, page-level `ErrorState` with request id.
- **Icons:** lucide-react; **avatars:** initials only.

## 7. Microcopy and tone

Plain, specific, calm. Verbs on buttons ("Send to Alex", "Approve funding $100.00"). Explain consequences. Say "hold" and "held", never "escrow". Replace "AI approved" with "Checks passed". Error pattern: *what happened · why · what to do* ("Payment was declined by PayPal. Your hold is intact. Retry release or contact the buyer."). Never expose stack traces; show `request_id`.

## 8. Email catalog

| Template | Trigger | To | Subject (example) | Content/CTA |
|---|---|---|---|---|
| verify_email | sign-up | user | Verify your ProofPay email | Button "Verify email"; expiry 24 h |
| welcome | verified | user | Welcome to ProofPay | 3 next steps |
| password_reset / password_changed | forgot / changed | user | Reset your password / Your password was changed | link / "Wasn't you? Secure account" |
| org_invite | org invitation | invitee | Alex invited you to Acme on ProofPay | Accept button; role; expiry |
| contract_invite | contract sent to email | counterparty | Acme sent you a contract: <title> | Review button; total; hold explainer |
| contract_accepted | seller accepts | buyer side | <Seller> accepted <title> | Fund button |
| approval_requested / approval_decided | threshold policy | approvers / requester | Approval needed: fund $100.00 | Approve/Review |
| contract_funded | authorization ok | seller side | Funds secured for <title> | Start work; due dates |
| submission_received | submit | buyer side | New submission: <milestone> | View |
| verification_result | verification done | seller side | Milestone <n> passed / needs fixes | Report link |
| escalation_review | escalated | buyer approvers | Review needed: <milestone> | Review; auto-release time |
| milestone_released | capture complete | both | $60.00 released for <milestone> | Receipt link |
| release_failed | capture failed | buyer approvers | Payment declined: action needed | Retry release |
| funding_at_risk / expiring | window ends | both | Hold expires in 72 hours | Action |
| contract_completed / failed / cancelled | terminal | both | … | Proof Pack link |
Each email: plain-text alternative, one primary CTA, footer with workspace name, "Sandbox" note, and request id for support; no tracking pixels in R1.

## 9. Landing page copy deck (replace the current text)

**Hero:** *Get paid for work that's proven.* / Sub: *ProofPay secures the payment on PayPal before work starts and releases it milestone by milestone when delivered work meets criteria both sides agreed. Humans and AI agents can use it.* / CTA: **Create a free sandbox workspace** · *See how it works*.
Fine print under CTA: *PayPal authorization hold, not escrow. Sandbox only: no real money.*

**How it works (3 steps):**
1. **Agree on measurable criteria.** Describe the job in plain English or start from a template. ProofPay turns it into checkable criteria and flags vague wording before anyone commits.
2. **Secure the payment.** The buyer approves a PayPal authorization for the total. It's a hold on their funding source, not a charge. The seller can see the funds are secured before starting.
3. **Verify and release.** Each delivery runs through rule-based checks and an AI reviewer that must quote its evidence. If it passes, PayPal captures that milestone automatically. If not, the seller gets exact feedback.

**Who it's for:** *Agencies and freelancers* (stop chasing payment) · *Buyers* (pay only for work that passes) · *AI-agent builders* (a safe way for agents to buy and sell work; scoped API keys, MCP tools).

**Trust section:** *AI advises, rules decide.* The AI can't approve payments; a rules engine does. · *Evidence you can export.* Every decision is recorded in a tamper-evident log. · *PayPal moves the money.* ProofPay never holds your funds. · *Honest about limits.* Sandbox today. Not escrow. Not legal advice.

**FAQ:** What is a hold and how long does it last? (up to 29 days) · Is this escrow? (No.) · What if the AI is wrong? (Escalation to the buyer; rules and evidence checks.) · Who pays fees? (Planned; sandbox is free.) · Can my agent use it? (Yes, via API/MCP with scoped keys; a human approves the PayPal hold.) · Is my data safe? (Link to privacy page; no deliverable content in logs.)

## 10. Accessibility and responsive

WCAG 2.1 AA; focus management on route change and dialogs; `aria-live` for status changes; keyboard-accessible tables and menus; reduced motion; 44 px targets; breakpoints 360/768/1280; sidebar becomes a drawer on mobile; tables become stacked cards below 640 px except the ledger grid (scrolls horizontally).

## 11. "Looks real in the demo video" checklist

Dashboard with realistic seeded data (not empty) · inbox with 2–3 items · contract detail with Funds Bar mid-release · report with highlighted evidence · team page showing roles · developers page with a service account · consistent org name/avatar · dark mode for recording · no lorem ipsum, no placeholder avatars, no console errors · sandbox badge visible but unobtrusive.
