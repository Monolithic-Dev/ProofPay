# ProofPay — Roadmap, Milestones & Demo Script

> **Date correction:** today is **Monday, Nov 2, 2026**. Earlier planning files assumed Nov 1 and 11 days. The real window is **Nov 2 → Nov 11 = 10 build days**. This file supersedes the dates in files 03 and 05.
> **Official deadline:** Nov 12, 12:00 PT = **Nov 13, 01:30 IST**. **Internal submit target: Nov 11, 18:00 IST.** Then freeze.

## 1. Team roles (4 people; roles are hats)

| Role | Owner | Primary scope |
|---|---|---|
| **A — Backend / PayPal** | Backend lead | `paypal/`, `release/`, ledger, jobs, webhooks, state machines, API routes |
| **B — AI / Verification** | AI lead | `ai/`, `contracts/compile+lint`, `verify/*`, eval set, prompts |
| **C — Frontend / UX** | UI lead | Design tokens, Studio, Timeline, Report, Ledger grid, Judge Mode, accessibility |
| **D — Infra / Demo / Agents** | Infra lead | Render, CI, health/monitoring, demo agents and scenario runner, MCP server, video |

**If 3 people:** D's infra goes to A; demo agents/video to C. **If 2 people:** A+B (backend, AI) and C+D (UI, infra, video); drop MCP, Proof Pack PDF, and the Agent Console polish (scripted scenarios still run).

## 2. Phase map (the hackathon's real phases)

| Phase | Dates | Focus |
|---|---|---|
| **Build** | Nov 2 – Nov 8 | Vertical slice first, then breadth |
| **Test** (continuous) | Nov 4 – Nov 10 | Unit/integration from day 3; eval + chaos runs Nov 6, 8, 10 |
| **Deploy** (continuous) | from Nov 4 | Hosted URL early; every feature lands on it |
| **Pitch** | Nov 9 – Nov 11 | Freeze, QA, record, submit |

## 3. Day-by-day plan

| Day | Date (IST) | A — Backend/PayPal | B — AI | C — Frontend | D — Infra/Demo | **Done when** |
|---|---|---|---|---|---|---|
| **D1** | Mon Nov 2 | **Run PayPal spike** (`scripts/paypal-spike.ts`), log to `docs/spike-log.md`; DB + Drizzle schema + migrations | Zod `Contract` schema, `policy.ts` + table tests | Next.js app shell, tokens, shadcn setup | Repo, MIT license, CI, `docker-compose`, `.env.example`, Render project + DB created | Spike steps 1–7 + 9 attempted; repo builds in CI |
| **D2** | Tue Nov 3 | Spike fixes; **GATE decision by 12:00 IST**; ledger append/verify | Compiler + deterministic lint rules | Studio screen (prompt + contract view) | Seed users, demo-login, auth guards, health endpoint | **Gate passed** (or pivot call made); compile returns a valid contract |
| **D3** | Wed Nov 4 | Fund flow (create order, return handler, authorize), webhook endpoint + signature verify | Deterministic checks (6) with boundary tests; AI lint suggestions | Lint panel + one-click fix; Fund screen | **Deploy skeleton to Render** (web+worker), register prod webhook; check credits | Fund → authorize works on hosted URL |
| **D4** | Thu Nov 5 | Jobs outbox + worker; **release service** (capture from `PASSED` only) | Rubric stage + evidence check; adversarial stage; `pipeline.ts` | Timeline screen, Funds Bar, countdowns | Judge Mode panel, scenario runner skeleton | Submit → verify → capture works locally |
| **D5** | Fri Nov 6 | Reauth/expire/reconcile/auto-release handlers | Eval fixtures (30) + first `npm run eval` | Verification Report screen, evidence highlight | Demo agents (buyer/worker) + `happy_path` scenario | **M1:** happy path end to end locally. Schema frozen to additive-only |
| **D6** | Sat Nov 7 | Chaos mode + `npm run chaos` (first run) | Fix prompts from eval; cache; budget cap | Ledger grid (AG Grid) + drawer; chain badge | All 5 scenarios; SSE + Agent Console | **M2:** all scenarios run **on the hosted URL** |
| **D7** | Sun Nov 8 | Proof Pack JSON (+PDF `[S]`); refund `[S]` | Second eval run; threshold tuning; degraded mode tests | Dark mode, empty/error states, a11y pass | MCP server `[S]`; UptimeRobot; rate limits | **M3:** MVP feature-complete; eval/chaos numbers recorded |
| **D8** | Mon Nov 9 | Stretch (dispute loop `[C]`) **only if M1–M3 are green**; else hardening | Write `docs/eval-results.md` | Polish; copy; Judge Mode credentials banner | README, architecture diagram, Devpost draft | **FEATURE FREEZE 23:59 IST** |
| **D9** | Tue Nov 10 | Bug fixes only; run chaos #2 | Bug fixes only; final eval | QA checklist (testing.md §6); screen-record rehearsal | **Record video** (≥ 3 takes); edit; captions | **M4:** video draft uploaded (unlisted) |
| **D10** | Wed Nov 11 | Fixes (P0 only) | Fixes (P0 only) | Final polish (P0 only) | Re-record if needed; video **public**; **submit by 18:00 IST**; verify links logged out | **M5: SUBMITTED** |
| — | Thu Nov 12 → Dec 15 | Hosting watch (see `deployment.md` §8) | | | | Live and free through Dec 15 |

## 4. Milestones and exit criteria

| ID | Date | Exit criteria (precise) |
|---|---|---|
| **M0 Gate** | Nov 3, 12:00 IST | Spike proves: AUTHORIZE order approved by sandbox buyer; **$60 non-final + $40 final capture** succeed on one authorization; void works; decline reproducible. Else pivot (§6) |
| **M1 Vertical slice** | Nov 6 | Locally: compile → propose → accept → fund (real sandbox) → submit m1 → verified → captured → m2 → completed; ledger chain valid |
| **M2 Hosted** | Nov 7 | Same flow on Render with webhooks delivering; all 5 scenarios run on the hosted URL |
| **M3 MVP complete** | Nov 8 | All `[M]` FRs from `prd.md` pass; eval run shows 0 false passes on the 19 non-pass cases (or documented exceptions); chaos ≥ 10/12 |
| **M4 Video draft** | Nov 10 | < 3:00, shows everything in §8, uploaded unlisted |
| **M5 Submitted** | Nov 11, 18:00 IST | All items in §9 checked |

## 5. "Done enough to demo" (MVP definition)

On the hosted URL, a first-time visitor in Judge Mode can: compile a contract and fix a lint error in one click; fund it through the **real PayPal sandbox**; watch a worker agent be **rejected with exact feedback**, fix and **pass**, and see **$60 captured** (Funds Bar moves Held → Released); see an **injection attempt blocked**; see a **declined capture recovered**; open the **ledger** (AG Grid) and **download the Proof Pack**; and read the **eval and chaos results** in the README.

## 6. Backup plan and pivot rule

If by **Nov 3, 12:00 IST** the spike cannot do partial captures on one authorization (steps 4 and 6) or cannot authorize at all, **pivot to Trust-gated Payouts (AP Firewall)**: AI checks invoices vs. POs and flags fraud before PayPal Payouts release. It needs Payouts and Invoicing only. Reuse: contract-like "payment policy" JSON, policy engine, ledger, job outbox, evidence-verified AI pipeline, AG Grid ledger, Judge Mode, deployment. Do not re-plan from scratch: re-label the domain objects and swap the PayPal adapter. Decision owner: A + B, announced in the team channel.

## 7. Stretch goals ranked (effort vs payoff)

| Rank | Stretch | Effort | Payoff | Do after |
|---|---|---|---|---|
| 1 | Capture-declined demo beat (chaos mode) | S | High (shows resilience; PayPal engineers care) | M2 |
| 2 | Proof Pack PDF | S | Medium-high (tangible artifact) | M2 |
| 3 | MCP server (6 tools) | M | High for Agentic Commerce prize | M2 |
| 4 | Refund endpoint + UI | S | Medium | M3 |
| 5 | Dispute loop (provide-evidence) | L (≈ 1 day) | High if it works, risky | M3 and only if all green |
| 6 | Oracle criterion `external_status` | M | Medium | After dispute loop or instead of it |
| 7 | Buyer/seller counter-offer step | M | Medium | Optional |
| 8 | Reputation badge | S | Low-medium | Optional |
| 9 | Amendments / multi-version contracts | L | Low for demo | Post-hackathon |

## 8. Demo script (video, target 2:50, hard limit 3:00)

Recording: 1440×900 viewport, dark mode, browser zoom 110%, hidden bookmarks, 1080p, voiceover recorded separately, captions burned in, **no copyrighted music**, avoid third-party logos beyond PayPal's own checkout page as it appears.

| Time | On screen | Voiceover (draft) |
|---|---|---|
| 0:00–0:18 | Big stat card, then the Studio | "About 71% of freelancers report non-payment, buyers pay for work they can't check, and soon AI agents will hire other agents with no human watching. ProofPay: pay when it's proven." |
| 0:18–0:45 | Studio: type the job → contract appears → linter flags "high quality" → click fix | "Describe the job. ProofPay turns it into measurable criteria and fixes vague ones before a cent is held." |
| 0:45–1:05 | Seller accepts (cut) → Fund → "Held, not charged" → PayPal sandbox approval → Funds Bar shows Held $100 | "The buyer approves once on PayPal. It's a hold, not a charge. The seller can see the money is real." |
| 1:05–1:40 | Agent Console: worker submits → REJECTED with exact rows highlighted → resubmits → PASSED → Funds Bar moves $60 to Released, "Verified with PayPal" | "A worker agent delivers. Checks find 22 of 25 rows and a bad email, with exact feedback. It fixes the work, passes, and PayPal releases that milestone automatically." |
| 1:40–2:05 | Milestone 2 with a grader-addressed injection → callout → REJECTED → ledger entry | "Try to trick the checker and it's ignored. The AI reads and explains. Code decides. PayPal moves the money." |
| 2:05–2:25 | Capture declined (chaos) → banner → retry → Released | "We tested twelve PayPal failure modes. Here a decline is caught, nothing double-charges, and recovery is one click." |
| 2:25–2:45 | AG Grid ledger → Chain intact ✓ → Proof Pack → eval slide "0 false passes on 19 non-pass cases (small-sample caveat on screen)" | "Every decision is hash-chained into a Proof Pack that can be attached to a PayPal dispute, and we measured the verifier instead of just claiming it works." |
| 2:45–2:58 | Architecture slide, URL | "Everyone else's agent pays when the job is marked complete. Ours pays when it's proven." |

Pre-record: DB snapshot, run each scenario 3×, `DEMO_TIME_SCALE=1` (use accelerated timer only for a clearly labeled take of the silent-buyer scenario, if used).

## 9. Submission checklist (Nov 11)

- [ ] Repo public; MIT license in About; README quick-start verified on a clean clone
- [ ] Hosted demo URL live; Judge Mode works logged out; sandbox credentials correct
- [ ] Devpost text complete: problem, who it's for, **how PayPal is used**, **how AI is used**, architecture, how to run, evaluation results, limitations (hold ≠ escrow)
- [ ] AI tools and PayPal APIs listed with how each is used
- [ ] Video < 3:00, public on YouTube, link tested logged out
- [ ] `docs/eval-results.md` and `docs/chaos-results.md` committed and linked
- [ ] No secrets in repo; Anthropic hard spend limit set; Render credits/plan confirmed through Dec 15
- [ ] Submitted ≥ 6 h before the official cutoff (target Nov 11, 18:00 IST)

## 10. Post-hackathon roadmap (next 3 months)

1. **Month 1:** real auth (Auth.js + PayPal Log in), amendments, URL/CI-status/tracking **oracle criteria**, code-deliverable verification in a **WASM sandbox**, seller reputation from the ledger.
2. **Month 2:** PayPal **Commerce Platform/partner** integration for multiple sellers (marketplace mode), staged funding for contracts > 28 days, dispute automation (evidence auto-submission).
3. **Month 3:** SDKs from OpenAPI (e.g., APIMatic), webhook callbacks for agent platforms, continuous evaluation on human-labeled samples, pilots with 3–5 small agencies/freelancer collectives, legal review of terms and "hold vs escrow" language.

## 11. Assumptions

| # | Assumption |
|---|---|
| RM-1 | Team works roughly 6–8 focused hours per day; time zone IST. |
| RM-2 | Spike can run on D1 because sandbox accounts and credentials take < 1 hour to create. |
| RM-3 | The Devpost submission form can be filled and saved as a draft early (do it on D8). |
