# ProofPay — UX Flows & Design System

> Design is a judging criterion ("a complete, coherent product, not just a technical proof of concept"). The goal: a calm, trustworthy "financial trust" look, one signature element (the **Funds Bar**), and a demo that reads clearly in 3 minutes. Routes match `project-structure.md`.

## 1. Design principles

1. **Show the money state at all times.** Authorized / Captured / Remaining is always visible on a contract.
2. **Never make the AI look like it decides.** Wording: "Checks run", "Evidence found", "Policy decision". The AI is shown as *evidence*, the policy engine as the *decision*.
3. **Plain language over jargon.** "Held, not charged" instead of "authorization".
4. **Every state has an explanation** and a next action ("Why is this escalated?" → button).
5. **Status is never color-only** (icon + label + color).

## 2. Design tokens (`globals.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F7F8FA` | `#0E1116` | App background |
| `--surface` | `#FFFFFF` | `#161B22` | Cards |
| `--text` | `#0F172A` | `#E6EDF3` | Primary text |
| `--muted` | `#64748B` | `#8B98A9` | Secondary text |
| `--brand` | `#1D4ED8` | `#5B8DEF` | Primary actions, "held" segment |
| `--ok` | `#15803D` | `#3FB950` | Released/pass |
| `--warn` | `#B45309` | `#D29922` | Escalated/at risk |
| `--bad` | `#B91C1C` | `#F85149` | Rejected/failed |
| `--void` | `#94A3B8` | `#6E7681` | Voided/neutral |
| Radius | 12 px cards, 8 px controls | | |
| Font | Inter (UI), JetBrains Mono (hashes, ids, JSON) | | |
| Spacing | 4-pt scale | | |
All text/background pairs must meet WCAG AA (4.5:1). Light and dark via `prefers-color-scheme` plus a manual toggle.

## 3. Signature components

**Funds Bar** (`components/contract/FundsBar.tsx`): a horizontal stacked bar for the contract total.
- Segments in order: **Released** (`--ok`), **Held** (`--brand`), **Voided** (`--void`, diagonal stripes).
- Labels beneath: `Released $60.00 · Held $40.00 · Voided $0.00 · Total $100.00`.
- Tooltip per segment explains in plain language ("Held: authorized on PayPal, not yet charged").
- Animates width on change (150 ms), respects `prefers-reduced-motion`.

**Countdown chips** (`Countdown.tsx`): `Best capture window: 2d 4h left` (honor period) and `Hold expires in 26d` (29-day window). Turn `--warn` under 24 h/72 h with text, not just color.

**Status chips:** `PENDING` (neutral), `VERIFYING` (spinner), `PASSED`, `RELEASED` (check), `REJECTED` (x), `ESCALATED` (eye), `RELEASE_FAILED` (alert), `VOIDED` (slash).

**"Verified with PayPal" badge:** shows live authorization status from `GET /v2/payments/authorizations/{id}` with timestamp ("✓ Verified with PayPal 10:42:08").

**Chain badge:** `Ledger intact ✓ (14 events)` from `/ledger/verify`; turns red with the broken sequence number if invalid.

## 4. Screens and states

### S0 — Landing + Judge Mode (`/`)
Above the fold: tagline **"Pay when it's proven."**, one-sentence value, three bullets (Compile · Hold · Prove & release), the honesty line ("PayPal authorization hold, not escrow. Sandbox only.").
**Judge Mode panel** (visible when `DEMO_MODE`): persona buttons (*Continue as Buyer / Seller*), five scenario buttons with one-line descriptions and expected duration, **Sandbox credentials banner** (buyer email/password with copy buttons and a "sandbox only" label), and links to the recorded demo video, README, and Proof Pack sample.
States: loading personas; error "Demo temporarily unavailable. Watch the recorded demo."

### S1 — Contract Studio (`/studio`, `/studio/[contractId]`)
Two-column layout.
- Left: prompt box (2,000 char counter, example chips: "Dataset + summary", "Blog post + translation"), **Compile** button; after compile, a compact chat-like history.
- Right: **live contract**: title, total, milestone cards (amount, due in N days, deliverable type), criteria listed with **type badges** (Deterministic / AI-checked / Needs your approval).
- **Lint panel** pinned right: issues grouped by severity; each issue has the offending criterion highlighted and a **"Fix with one click"** button when `suggested_fix` exists. The Propose button is disabled with a tooltip listing blocking errors.
- States: compiling (skeleton + "Turning your job into measurable criteria…"), compile failed (manual template button), budget exhausted ("AI is paused to protect costs. Try the demo scenarios.").

### S2 — Review & accept (seller view, `/contracts/[id]`)
Banner "Review contract (not yet binding)". Shows the same contract read-only, the **hash preview** ("Will be locked as sha256 b7e1…"), and **Accept & lock**. After accept: banner turns to "Locked ✓ b7e1…c04d".

### S3 — Fund (`/contracts/[id]/fund`)
A centered card: total, "**Held, not charged.** You pay only for work that passes its checks." Three-line explainer, **Continue to PayPal** button (opens PayPal approval in the same tab), cancel link. After return: success toast "Funds authorized".
States: PayPal error (shows PayPal message + debug id in a collapsible), abandoned (banner "Funding not completed").

### S4 — Contract Timeline (`/contracts/[id]`) — the main screen
- Header: title, status chip, Funds Bar, countdown chips, Verified-with-PayPal badge (seller sees prominent "✓ $100.00 authorized. Safe to start work").
- Timeline of milestone cards (vertical). Each card: status chip, amount, due date, revisions used (`1 of 3 attempts`), primary action by role/state:
  - Seller + `PENDING/REJECTED`: **Submit work**.
  - Buyer + `ESCALATED`: **Review evidence**.
  - Buyer + `RELEASE_FAILED`: **Retry release**.
- Right rail: recent ledger events (live via SSE) and a "Why did this happen?" explainer for the latest change.
- Tabs: Overview · Ledger · Proof Pack.

### S5 — Submit & Verification Report (`/contracts/[id]/milestones/[mid]`)
- **Submit panel:** paste/upload JSON or text; client-side size and JSON validation; **Submit** shows a progress stepper: *Received → Checks → AI review → Policy decision → Release*.
- **Report:**
  - Header: big decision pill (PASS / REJECTED / NEEDS YOUR REVIEW) + one-line summary.
  - **Criteria list**: row per criterion with icon, type badge, plain-language result, expected vs observed. For AI-checked rows: **evidence quote highlighted inside the artifact viewer** (click to scroll), confidence meter, and a "verified quote ✓" marker.
  - **Manipulation callout** if flagged: "We found text addressed to the checker. It was ignored." with the quoted span.
  - **Fix list** (on reject): bullet list of exact fixes ("Row 22: email 'bob@@x' invalid").
  - Footer: model, prompt version, cache hit, latency (small, mono font) for transparency.
- **Escalation view (buyer):** same report plus **Approve / Reject** with optional note and a visible timer: "Auto-releases in 47h 12m if you take no action."

### S6 — Ledger (`/contracts/[id]/ledger`)
**AG Grid** (Community) columns: `#`, Time, Type (chip), Actor, Summary, PayPal ref (copy button), Hash (first 8 + copy). Features: sorting, column filters, quick-search box, sticky header, row click → **side drawer** with full payload JSON (master/detail is Enterprise-only), `Export Proof Pack` (JSON / PDF). Header shows the Chain badge.

### S7 — Agent Console (`/agent-console/[runId]`)
Split view: left, **transcript** (Buyer Agent ↔ ProofPay ↔ Worker Agent, speaker avatars, timestamps); right, **live contract timeline** (same components as S4). A pinned "Waiting for human to approve in PayPal" card with the **Open PayPal sandbox** button when `run.waiting_for_buyer`.

### S8 — API keys (`/settings/api-keys`)
Create key (secret shown once with copy), list with prefix/last used, revoke. Snippets for curl and MCP config.

## 5. Core flows (step by step)

1. **Happy path:** Studio → compile → one-click fixes → propose → (seller) accept → fund via PayPal → seller submits m1 → pass → m1 released (Funds Bar updates) → submit m2 → pass → complete → Proof Pack.
2. **Reject → fix → pass:** m1 submit with 22 rows → report REJECTED with exact fixes → resubmit → pass → capture.
3. **Injection blocked:** m2 includes the grader-addressed text → manipulation callout → REJECTED (policy), ledger `INJECTION_FLAGGED`.
4. **Capture declined:** m1 passes → capture declined (chaos) → `RELEASE_FAILED` → buyer retries → released.
5. **Silent buyer:** escalated m2 → timer (accelerated with `DEMO_TIME_SCALE`) → auto-release.
6. **Agent-to-agent:** Judge clicks scenario → Agent Console opens → agents run → pauses at PayPal approval → judge approves → run completes.

## 6. Accessibility

- Keyboard: all actions reachable, visible focus rings, `Esc` closes drawers, grid navigable via AG Grid keyboard support.
- Screen readers: status chips have `aria-label` ("Milestone 1, released"); live regions (`aria-live="polite"`) announce status changes; Funds Bar has a text equivalent.
- Contrast ≥ 4.5:1; icons+text for status; `prefers-reduced-motion` honored; touch targets ≥ 44 px; minimum viewport 360 px.
- Copy: reading level ~grade 8; no unexplained jargon (tooltips for "authorization hold", "honor period").

## 7. What makes it feel polished in a 3-minute demo

1. **One consistent timeline** component reused everywhere (Studio preview, Timeline, Agent Console).
2. **Funds Bar animation** at the moment of capture: the segment moves from Held → Released; pair with a subtle toast "Released $60.00 via PayPal ✓".
3. **Evidence highlight**: the exact failing row or sentence glows in the artifact viewer.
4. **Zero dead time**: the verification stepper keeps motion during the ~10 s AI step; scenario runner pre-warms the LLM and uses cached generations.
5. **Empty/error/loading states** designed (not default spinners).
6. **Dark mode** for video contrast; **1440×900** recording viewport; browser zoom 110%; hide bookmarks and dev tools; mock cursor highlight.
7. **Consistent micro-copy:** "Held, not charged", "Proven", "Needs your review".

## 8. Assumptions

| # | Assumption |
|---|---|
| UX-1 | Desktop-first recording; mobile is responsive but not polished for the video. |
| UX-2 | shadcn/ui primitives are customized with the tokens above so the app does not look like the PayPal+AG Grid starter. |
| UX-3 | No custom illustration or logo work beyond a simple wordmark and a shield-check icon (lucide). |
