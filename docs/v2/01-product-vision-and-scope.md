# 01 — Product Vision & Scope (Product Owner view)

## 1. Vision and positioning

**Vision:** become the default way to pay for work you can't inspect in advance: the seller knows the money is secured before starting, the buyer pays only for work that meets an agreed, measurable standard, and both get a neutral evidence trail.

**One-line positioning:** *ProofPay is pay-on-acceptance for digital deliverables. Funds are secured on PayPal up front and released milestone by milestone when delivered work is proven against criteria both sides agreed.*

**What it is not (say this publicly):** not escrow, not a marketplace, not a bank, not a legal contract service. ProofPay uses a **PayPal authorization hold**; PayPal moves the money; ProofPay verifies and records.

## 2. Target customers (initial wedge)

The wedge is **digital deliverables with objective acceptance criteria**, bought and sold outside marketplaces:

| Segment | Example work | Why they care |
|---|---|---|
| Small agencies & freelancers selling data/content | lead lists, cleaned datasets, translations, research briefs, product-description batches, test reports | Late/non-payment, scope arguments |
| Startups & ops teams buying such work | dataset builds, content batches, QA passes | Paying for work that doesn't meet the spec |
| AI-agent builders/operators | agents that buy or sell tasks and data via API | A trust layer when no human inspects output |

Later segments (not R1): marketplaces embedding ProofPay, enterprise procurement, creative work (needs human criteria heavily).

## 3. Users (summary; full catalog in `02-users-auth-rbac.md`)

Buyer-side: **Founder/Owner**, **Finance approver**, **Requester**. Seller-side: **Agency/Freelancer Owner**, **Contributor**. Cross-cutting: **Admin**, **Viewer/Accountant**, **Agent/service account**. Internal: **Support**, **Platform admin**.

## 4. Jobs to be done

| User | When… | I want to… | So that… |
|---|---|---|---|
| Buyer Owner | I hire someone for a data/content job | turn my request into measurable criteria and secure the payment without paying upfront | I only pay for work that passes |
| Buyer Finance | a teammate wants to commit money | review and approve holds above a limit | spend stays controlled and auditable |
| Seller Owner | a client wants me to start | see the funds are secured and the criteria are objective | I work without payment risk or scope games |
| Seller Contributor | I deliver a milestone | get immediate, precise feedback and automatic release | I fix fast and get paid without chasing |
| Agent operator | my agents transact for work | create, fund-link, submit and track via API/MCP with scoped keys | agents act safely within limits |
| Support | a user is stuck or disputes an outcome | inspect the contract, evidence and money state read-only | I can help without risk |

## 5. Product principles

1. **Trust through evidence, not claims.** Every decision is explainable and logged. Show the evidence.
2. **AI proposes, code decides, PayPal moves the money.** Never blur these in UI or copy.
3. **Money state is always visible** (held, released, voided, at risk).
4. **Boring where it matters:** security, permissions, audit, idempotency are table stakes, not features.
5. **Honest scope:** sandbox until partner approval; label simulated things as simulated.
6. **Role-aware simplicity:** each user sees only what they can do next; the "needs attention" inbox is the home screen.
7. **Works for humans and agents:** every UI capability has an API/MCP equivalent, with narrower agent permissions.

## 6. Scope tiers

### R1 — "Real core" (build now; ship by Nov 10; sandbox)
Real accounts & sessions · organizations, members, invitations, roles · RBAC enforced server-side · app shell, dashboard, inbox · templates (≥ 3) · counterparty invitation by email and acceptance flow · contract discussion (comments) · in-app + email notifications · org-scoped API keys with scopes (service accounts) · audit log (org) · minimal admin console · profile/org/security settings · PayPal connection screen (platform-account mode; partner onboarding shown as "coming soon") · honest marketing site + legal placeholders · `/demo` playground (existing scenarios) · all existing money/verification features.

### R2 — "Money for real sellers" (next ~6 weeks)
PayPal **partner onboarding** so funds route to each seller's own PayPal account · platform fees · internal dispute center and PayPal dispute evidence · file attachments (object storage) · outbound webhooks · MFA enforcement policies · contract amendments · CSV/PDF verification inputs · receipts and statements · saved views.

### R3 — "Scale & trust"
SSO/SAML · custom roles · analytics & reputation (verified-delivery rate) · multi-currency · billing/plans · public API versioning + SDKs · mobile polish · SOC2-style controls.

## 7. Real vs simulated (be explicit in the product)

| Capability | R1 reality |
|---|---|
| Accounts, orgs, roles, sessions, invitations, emails | **Real** (emails use a real provider in hosted demo; Mailpit locally) |
| Contract lifecycle, verification, ledger, Proof Pack | **Real** |
| PayPal authorization/capture/void | **Real, but sandbox money** |
| Payouts to sellers' own PayPal accounts | **Not real in R1:** captured funds land in the platform's sandbox merchant. UI says so ("Sandbox: no real payouts") |
| KYC/identity of users | PayPal handles payer identity at approval; ProofPay does **no KYC** in R1 |
| Tax, invoicing | Not provided (receipts only) |
| Legal enforceability | Not provided; acceptance is a recorded agreement hash, **not an e-signature service** |

## 8. Claims policy (copy rules; applies to site, app, README, Devpost, video)

**Say:** "authorization hold, not escrow" · "PayPal moves the money" · "funds are held on your PayPal funding source until work is verified" · "AI helps check; rules decide" · "sandbox" wherever money appears · "evidence trail / Proof Pack".

**Never say:** "escrow" (except in "not escrow") · "cryptographically verified proof of funds" · "guaranteed payment" · "autonomous agents negotiate" (not built) · "100% accurate" · "legally binding" · "bank-grade" · "insured".

**Numbers** come from committed result files only (`docs/eval-results.md`, `docs/chaos-results.md`).

## 9. Monetization hypotheses (to validate; no billing in R1)

- Platform fee on each captured milestone (percentage with a minimum), paid by seller or split; PayPal's own fees are separate and disclosed. Example hypothesis only: low single-digit percent. Requires partner platform-fee support (R2).
- Plans by org seats and monthly contract volume; free tier for small volume; API/agent usage tiers.
- R1 shows a **Plans** page stating "Sandbox: free" and the fee model as "planned".

## 10. Success metrics

| Metric | Definition | Target (post-launch hypothesis) |
|---|---|---|
| Activation | org created → first contract **sent** within 24 h | ≥ 40% |
| Time to first funded contract | signup → hold authorized | median < 2 days |
| Completion rate | contracts reaching `COMPLETED` / contracts funded | ≥ 70% |
| Auto-verification rate | milestones decided without human escalation | ≥ 75% |
| Verifier safety | false passes on audited sample | 0 tolerated; any = P0 |
| Dispute rate | disputes / released milestones | < 3% |
| Seller NPS / Buyer NPS | survey after completion | ≥ 40 |
| Hackathon (R1) | judge can sign up, complete a funded contract in sandbox in < 5 minutes | yes |

## 11. Competitive context (positioning hypotheses to validate, not facts)

Marketplaces with built-in payment protection tie protection to their platform and rely on human review. Generic escrow services need manual release. Agent payment protocols focus on paying, not on verifying delivery. ProofPay's wedge: **marketplace-independent, criteria-driven acceptance with automated verification, on PayPal rails**.

## 12. Risks and dependencies

| Risk | Impact | Mitigation |
|---|---|---|
| PayPal partner approval needed for multi-seller routing (partner referrals, auth assertion, platform fees) | Blocks R2 | Start the application early; R1 uses platform-account mode; abstract payout provider in data model (`paypal_connections.mode`) |
| Regulatory (money transmission, consumer protection) if ProofPay ever touches funds | High | Never custody funds; legal review before launch; sandbox only until then |
| Verifier trust (false pass) | Core promise | Deterministic-first, evidence verification, eval + held-out set, escalation; treat any false pass as P0 |
| LLM cost/abuse | Budget | Daily cap, rate limits, fixtures in demos |
| Scope creep in R1 | Missed Nov 10 | Cut list in `07`; money path frozen |
| Email deliverability | Verification/invite failures | Real provider with verified domain (or provider sandbox sender); outbox with retries; resend UI |

## 13. Open questions (decide by Nov 5 unless noted)

1. Email provider for the hosted demo (Resend vs SMTP vs provider sandbox sender)? **Default: Resend (API key), Mailpit locally.**
2. Google sign-in in R1? **Default: yes if OAuth credentials are ready by Nov 5; else R2.**
3. Is MFA required for Owners/Finance in R1? **Default: available and prompted, not enforced** (enforcement R2).
4. Domain name for the hosted app (affects email sender and cookies)? **Default: Render URL for hackathon.**
5. PayPal partner application: who owns it and when to apply? **Default: apply right after submission; research cost/time Nov 4.**
