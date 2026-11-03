# 09 — Judging Criteria Alignment & Demo Script v2

> Criteria (equal weight; ties break starting with Technological Implementation): **Technological Implementation · Design · Potential Impact · Innovation/Idea · Presentation.** Judges may read only the text, images and video. The video must show the product **working end to end**.

## 1. What each criterion needs and how R1 delivers

| Criterion | What judges ask | R1 evidence (what they will see) | Gap to watch |
|---|---|---|---|
| **Technological Implementation** | Thorough, skilled use of PayPal and AI; non-trivial, working | Real PayPal lifecycle (authorize → partial captures → final capture → void → reauthorize → refund, webhooks, idempotency, reconciliation); AI compiler/linter/verifier with evidence checks; chaos suite results; eval numbers with held-out split; org-scoped RBAC, audit, outbox, service accounts, MCP | Show **numbers and the PayPal API table**, not just claims; keep money path regression-free |
| **Design** | Complete, coherent product experience | Real sign-up, onboarding, app shell, dashboard/inbox, contract detail with Funds Bar, evidence-highlighted report, team/roles, developers page; consistent tokens; all states designed | The pasted landing page currently fails this; Phases 13 and 16 fix it. No empty dashboards in the video |
| **Potential Impact** | Credible, specific problem and audience; solution addresses it as demonstrated | Named segment (agencies/freelancers + buyers + agent builders); documented non-payment problem (verify the stat); end-to-end flow where a buyer pays only for verified work; Proof Pack for disputes; honest "sandbox/not escrow" | Don't overclaim; show the *problem moment* (late/non-payment, vague "done") in the first 15 s |
| **Innovation/Idea** | Creative, novel, different from existing concepts | Criteria linter + injection-resistant verifier + measured accuracy + hash-chained evidence + agent-native API/MCP with scoped keys, on PayPal holds | Differentiate from "agent pays when job marked complete" (PayPal's own hint): ours pays when **proven** |
| **Presentation** | Clear end-to-end video; problem, audience, why it matters; easy to follow | Script v2 below; README/Devpost aligned; judge instructions; recorded fallback | ≤ 3:00 exported; no dead time; numbers on screen match README |

## 2. Features that exist mainly to win criteria (don't cut these)

1. Real accounts + orgs + roles + approval policy (Design, Impact, Tech depth).
2. Counterparty invite/accept between two real accounts (Impact; shows two-sided product).
3. Dashboard + inbox + Funds Bar (Design).
4. Verification report with evidence highlight and manipulation callout (Innovation, Tech).
5. Scoped service-account keys + MCP (Innovation: agentic commerce; Tech).
6. Ledger + Proof Pack + eval/chaos result slides (Tech, Presentation credibility).
7. Honest copy and limitations (credibility across all five).

## 3. Demo script v2 (target 2:50, hard limit 3:00; replaces the earlier script)

Prep: two browser profiles (buyer org "Acme", seller org "Northwind Data"), dark mode, 1440×900, seeded Demo Workspace data, PayPal sandbox buyer already logged in, worker agent ready, `DEMO_USE_FIXTURES=true`.

| Time | On screen | Voiceover gist |
|---|---|---|
| 0:00–0:15 | Problem card (verified stat or qualitative), cut to landing hero | "You can't inspect most digital work before paying. Sellers get stiffed; buyers pay for work that misses the spec; and soon AI agents will hire each other with no human watching. ProofPay: get paid for work that's proven." |
| 0:15–0:30 | Sign-up (sped up) → verify → onboarding → dashboard with inbox | "A real workspace in minutes: accounts, roles, and a to-do inbox." |
| 0:30–0:55 | New contract from template → lint flags a vague criterion → one-click fix → **Send to seller** (email) | "Describe the job; ProofPay makes the criteria measurable and flags vague wording before anyone commits." |
| 0:55–1:10 | Seller profile: invite email → accept → buyer: funding requires **Finance approval** (threshold) → Finance approves → PayPal approval → Funds Bar "Held $100" | "Two companies, two roles. Spending policy applies. The buyer approves a PayPal hold. It's a hold, not a charge." |
| 1:10–1:45 | Seller agent submits via API (service account) → **rejected with exact rows** → fix → passed → **$60 released** (Funds Bar moves; receipt toast) | "An agent with a scoped key delivers. Rules and an AI reviewer that must quote its evidence find the problem. Fixed, verified, and PayPal releases the milestone." |
| 1:45–2:05 | Milestone 2 with a hidden instruction → manipulation callout → rejected | "Try to trick the checker and it's ignored. AI advises; rules decide; PayPal moves the money." |
| 2:05–2:20 | Team page (roles) + Developers page (scoped keys, MCP) in 8 s each | "Roles and audit for teams; scoped keys and MCP for agents. Agents can never approve or refund." |
| 2:20–2:42 | Ledger + chain badge + Proof Pack; slide with **eval and chaos numbers** and the caveat | "Every decision is hash-chained into a Proof Pack for disputes. We measured the verifier and tested twelve PayPal failure modes." |
| 2:42–2:55 | Architecture slide + URL | "Sandbox today; PayPal partner onboarding next. Everyone else's agent pays when the job is marked complete. Ours pays when it's proven." |

Cut order if over time: team/developers segment (shorten), then declined-payment demo (not in this script), then sign-up detail.

## 4. README and Devpost structure (judges may only read these)

First screen: one-sentence pitch · honesty line · demo + video links · "Try it in 3 steps" (sign up, or `/demo`) · screenshots (dashboard, report, Funds Bar, team) · **How PayPal is used** table · **How AI is used** table · **Roles and security** (RBAC matrix summary, audit, service accounts) · **Evaluation and chaos results** (real numbers + caveats) · Architecture diagram · Limitations (sandbox, not escrow, single platform merchant until partner onboarding, small eval set) · Roadmap (R2/R3).

## 5. Pre-recording checklist (product realism)

- [ ] Landing has no forbidden phrases; hero CTA leads to sign-up.
- [ ] Demo data is populated: dashboard shows active contracts, inbox has 2–3 items.
- [ ] Two orgs, real names, avatars as initials, no "Test"/"foo" strings.
- [ ] Roles visible (Finance approver exists); threshold policy enabled ($50) so approval step shows.
- [ ] Service accounts exist with realistic names; keys not visible on screen.
- [ ] No console errors; no secret values on screen; PayPal dashboard blurred.
- [ ] Numbers on slides match `docs/eval-results.md` and `docs/chaos-results.md` exactly.
