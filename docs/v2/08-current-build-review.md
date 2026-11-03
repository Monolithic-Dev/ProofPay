# 08 — Review of the Current Build (from the pasted `localhost:3000` page)

> Scope: only what is visible in the pasted landing page content. Authenticated screens were not provided; **send screenshots of Dashboard/Contract/Report/Ledger pages for a second review**. Each finding has a fix and the phase that owns it.

## A. Product-level problems

| # | Finding | Why it matters | Fix | Phase |
|---|---|---|---|---|
| A1 | The front door is **Judge Mode** with four hard-coded personas ("Sarah Buyer", "Alex Seller", "ProcureBot", "SynthetixBot"). No sign-up, sign-in, or workspace. | Reads as a simulator. Fails the Design criterion ("complete, coherent product") and weakens Impact. | Real landing with Create workspace / Sign in; move personas/scenarios to `/demo` | 16 |
| A2 | No auth, users, organizations, or roles (RBAC) exist. | Nothing a real customer could use; security story is weak. | Phases 11–12 | 11–12 |
| A3 | Navigation is "Studio · API Keys · Judge Mode": no dashboard, contracts list, payments, team, settings, sign-in/out, user menu. | No place to live in the product. | App shell + IA from `04` | 13 |
| A4 | The page says "PayPal AI Hackathon 2026" as the top tag. | Product should stand on its own; hackathon credit belongs in the footer. | Remove from hero; small footer credit | 16 |
| A5 | No pricing, how-it-works, docs, legal, help, status, footer. | Incomplete product surface; trust signals missing. | Pages in Phase 16 | 16 |
| A6 | Sandbox buyer credentials (`buyer-sandbox@proofpay.test` / password) are shown **on the public landing page**. | Even for sandbox, it looks careless and invites misuse; belongs in a playground. | Show only in `/demo` (collapsed), label sandbox-only; rotate the sandbox password if it was ever reused anywhere | 16 |

## B. Copy that violates the honesty policy (`01` §8) or overclaims

| # | Current text (quoted from the page) | Problem | Replacement |
|---|---|---|---|
| B1 | "Autonomous agents negotiate agreements." | Negotiation is **not built**. Overclaim. | "Humans or AI agents create contracts in the app or through the API." |
| B2 | "The seller receives cryptographically verified proof of funds." | Overclaim; the seller sees a PayPal-confirmed authorization, not cryptographic proof. | "The seller can see the funds are secured on PayPal before starting." |
| B3 | "ProofPay quarantines the payload and **preserves escrow**." | Uses "escrow" (forbidden); also "quarantines" implies a feature that isn't there. | "The injection attempt is ignored and flagged; the milestone is rejected and the hold stays untouched." |
| B4 | "protocol auto-releases **escrow** to protect worker compensation." | Forbidden word; also implies a protocol. | "If the buyer doesn't respond, the milestone is released automatically after the agreed wait." |
| B5 | "PayPal locks authorization holds." | Slightly off: PayPal places an authorization on the payer's funding source. | "PayPal places an authorization hold on the buyer's funding source." |
| B6 | "Translate plain English agreements into machine-checkable criteria with automated checks for ambiguity, budget mismatches, and deadline integrity." | Fine in substance; "agreements" implies legal agreements. | "Turn a plain-English job into checkable criteria; ProofPay flags vague wording, amount mismatches and deadlines that exceed the hold window." |
| B7 | "Pay when it is proven." (headline) | Good. Keep. Add the honesty line directly under the CTA (already present: "PayPal authorization hold, not escrow. Sandbox only."). | Keep |
| B8 | "Judge Mode & Interactive Testing / Simulate both sides of milestone settlements" | "Simulate" undermines the product feel on the main page. | Rename section to "Sandbox playground" on `/demo` only |
| B9 | "Real multi-agent transactions on PayPal sandbox with human-in-the-loop approval." | OK once on `/demo`; accurate (sandbox, human approval). | Keep on `/demo` |
| B10 | "29-day hold" | Accurate as PayPal's authorization window; keep, but add "up to". | "Up to 29 days" |

Add `scripts/check-copy.sh` (Phase 16) so these can't regress.

## C. UX/UI problems visible from the markup

| # | Finding | Fix |
|---|---|---|
| C1 | Hero has two CTAs but both lead to builder/playground, not to account creation. | Primary: Create a free sandbox workspace; secondary: See how it works |
| C2 | Four persona cards with long descriptions dominate the page. | Remove from landing |
| C3 | Scenario cards have a mix of "Run Scenario" buttons with no auth context and no explanation of what the user will see. | In `/demo` add "What you'll see" + duration + prerequisites (PayPal approval step) |
| C4 | No visible product imagery (Funds Bar, report, ledger). | Add screenshots/illustrations from the seeded Demo Workspace |
| C5 | "Skip to main content" link exists (good). Keep. Ensure focus order, contrast, landmarks. | Keep; run axe |
| C6 | "README" link in the header points straight to GitHub. | Move to footer ("Source on GitHub") |

## D. Missing capabilities mapped to the plan

| Missing | Spec | Phase |
|---|---|---|
| Sign-up/sign-in/verify/reset/MFA/sessions | `02` §3 | 11, 15 |
| Organizations, invitations, roles, RBAC, approvals | `02` §3, §5 | 12 |
| App shell, dashboard, inbox, contracts list | `04` §3–§4 | 13 |
| Templates, counterparty invites, comments, notifications | `03` E6–E8, E14 | 14 |
| Service accounts and scoped keys, settings, admin, audit | `02` §5.4, `03` E15–E18 | 15 |
| Landing/pricing/docs/legal/help, `/demo` | `04` §4.1, §4.20 | 16 |

## E. What to keep (it is good)

"Pay when it is proven." headline · the sandbox badge · the honesty line under the CTA · the 3-step explainer structure (rewrite the text, keep the structure) · skip link · the five scenarios (they are your strongest demo assets; move them).
