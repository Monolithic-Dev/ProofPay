# Phase 9 — Deployment, Observability & Judging-Window Readiness

> **Goal (done means):** ProofPay runs on Render (web + worker + Postgres, plus optional MCP), with the production PayPal webhook delivering, health and alerting in place, a rehearsed rollback, hard cost caps, and a calendar of checks that keeps the demo **live and free for judges through Dec 15, 2026**.
> **Window:** skeleton exists since Phase 1 (Nov 2); full hosted flow Nov 4–7 (so the hosted URL is exercised daily); final pass Nov 9–10 · **Budget:** 1.5 person-days (spread) · **Owner:** D (lead); A configures webhooks; B sets LLM caps.

## Preconditions
- Phase 1 Render skeleton (web + Postgres) and `/api/v1/health` exist.
- Phase 3 (health shape), Phase 4 (worker + heartbeat), Phase 5 (webhooks, PayPal credentials) tagged. Phase 7 scenarios optional for the final smoke.
- Decisions from `docs/decision-log.md`: Render plan names/prices and credit balance; DB tier is **non-expiring** (confirm).

## Implements
`deployment.md` §1–§9 · `security-privacy.md` §3, §7 · `paypal-integration.md` §1 (production webhook) · `prd.md` G5, §7 availability · `edge-cases.md` E-31, E-55…E-58, E-60 · correction **C-7** (`POST /admin/reconcile`), **C-8** (env).

## Task breakdown

### 9.1 Blueprint and services (Owner D)
- [ ] Finalize `render.yaml` per `deployment.md` §2: `proofpay-db` (non-expiring paid plan), `proofpay-web` (build `npm ci && npm run build && npm run db:migrate`, start `npm run start`, health check `/api/v1/health`), `proofpay-worker` (build `npm ci`, start `npm run worker:start`), optional `proofpay-mcp`. Confirm plan identifiers in the Render UI and replace placeholders; commit.
- [ ] Env group `proofpay-shared` with every variable from `deployment.md` §3 including `RUN_ROLE` per service, `DEMO_MODE=true`, `CHAOS_MODE=true`, `DEMO_TIME_SCALE=1`, `DEMO_USE_FIXTURES=true`, `PURGE_ENABLED=false`, `MAX_CONTRACT_DAYS=28`, `LLM_DAILY_BUDGET_USD=5`, `SANDBOX_BUYER_EMAIL/PASSWORD`, `NEXT_PUBLIC_DEMO_VIDEO_URL` (placeholder until Phase 10).
- [ ] Verify migrations run **only** from the web build; worker waits for DB readiness (`SELECT 1` loop ≤ 60 s) before polling.
- [ ] `scripts/smoke-hosted.ts` (`npm run smoke:hosted -- --url https://...`): checks `GET /health` (200, `db.ok`, `worker_lag_seconds < 60`), demo-login buyer, `POST /contracts/compile` with the fixture prompt (expects 201 or 429 budget), starts `reject_then_pass` and confirms the run reaches `WAITING_FOR_BUYER` and emits at least 5 events over SSE within 60 s (does **not** require PayPal approval).
- [ ] Add manual GitHub Action `smoke-hosted.yml` (`workflow_dispatch`) running the script against the hosted URL.

### 9.2 PayPal production-demo webhook and credentials (Owner A) — `paypal-integration.md` §1
- [ ] In the PayPal Developer Dashboard create a **second webhook** pointing to `https://<web>/api/v1/webhooks/paypal` with the events listed in `paypal-integration.md` §1; set `PAYPAL_WEBHOOK_ID` in the Render env group; remove/disable the tunnel webhook.
- [ ] Trigger a sandbox capture and confirm **Recent deliveries = 200** and a `paypal_events` row with `signature_valid=true` in the hosted DB.
- [ ] Add `POST /api/v1/admin/reconcile` (C-7; admin only) if not built in Phase 5, plus a small admin-only button on `/contracts/[id]` (visible only to admin persona).

### 9.3 Health, monitoring, alerts (Owner D) — `deployment.md` §6
- [ ] Extend `/api/v1/health` to include `worker_lag_seconds`, `stuck.releasing` (milestones in `RELEASING` > 2 min), `stuck.jobs_pending_old` (> 2 min), `llm.budget_remaining_usd`, `paypal.ok` (cached token check ≤ 60 s), `features:{chaos,demo}`; status `degraded` when any of: worker lag > 90 s, stuck counts > 0, LLM exhausted, PayPal not ok.
- [ ] UptimeRobot (or equivalent) monitor on `/api/v1/health` every 5 min, alert contacts: all 4 teammates (email/Telegram); keyword check for `"status":"ok"`.
- [ ] Structured logs verified in Render: search by `contract_id`, `job_id`, `request_id`; log retention noted in `docs/runbook.md`.
- [ ] Provider guardrails: Anthropic **hard monthly spend limit** set; usage alert at 50%/80%; PayPal app credentials stored only in Render; GitHub secret scanning active.
- [ ] Tests: `tests/integration/health.test.ts`: `degraded when worker heartbeat older than 90s`, `degraded when RELEASING stuck`, `features reflect env flags`, `health never leaks secrets`.

### 9.4 SSE, proxy and cold-start verification (Owner D)
- [ ] From a phone on mobile data and from an incognito desktop window: open Judge Mode, start `reject_then_pass`, confirm SSE updates arrive within 3 s and heartbeats keep the stream open for ≥ 10 minutes (idle test).
- [ ] If SSE is buffered by the proxy, confirm headers (`X-Accel-Buffering: no`, `Cache-Control: no-transform`) and rely on the polling fallback; record observed behavior in `docs/runbook.md`.
- [ ] Verify paid web tier does not sleep; measure cold start after a deploy (< 30 s to healthy).

### 9.5 Rollback and recovery drill (Owner D) — `deployment.md` §7
- [ ] Deliberately deploy a commit that returns 500 on `/health`; confirm Render marks it unhealthy and keeps the previous version (or roll back via **Deploys → Rollback**); record time-to-recover.
- [ ] `pg_dump` snapshot procedure (`scripts/backup.sh` using `DATABASE_URL`) + restore test into local Postgres; enable Render automated backups if available on the plan.
- [ ] Write `docs/runbook.md`: restart worker, rollback, reconcile a contract (admin endpoint), rotate secrets (PayPal, Anthropic, `SESSION_SECRET` — note: rotating `SESSION_SECRET` logs everyone out and invalidates demo agent API-key ciphertexts, so re-run `npm run seed:agents`), toggle `CHAOS_MODE`/`DEMO_TIME_SCALE`, switch to recorded demo.
- [ ] Add `scripts/seed-agents.ts` (`seed:agents` script) to recreate encrypted agent API keys after rotation.

### 9.6 Judging-window plan (Owner D) — `deployment.md` §8
- [ ] Create calendar events (shared): **Nov 12** freeze + verification; **Nov 20** credits/spend check + logged-out Judge Mode test; **Dec 1, Dec 8, Dec 15** smoke (`npm run smoke:hosted` + one manual scenario); **Dec 10** extend credits/plan if needed; **Dec 16** set `PURGE_ENABLED=true`, scale down/delete services, rotate secrets, export final DB dump.
- [ ] Document in `docs/runbook.md` who is on call each week (owner + backup) and the escalation steps.
- [ ] Confirm DB plan will not expire before Dec 16 (read the plan's retention terms; screenshot saved to `docs/decision-log.md`).

## Real-world engineering concerns
- **Migrations:** additive-only after Nov 6; run from web build only; web deploy fails fast if migration fails (Render keeps previous version).
- **Idempotent boot:** worker boot must be safe to repeat (reclaims stale jobs; schedulers use dedupe keys).
- **Config drift:** `env.ts` validation fails the deploy on missing/invalid vars (no silent defaults for secrets).
- **Cost:** budget cap + rate limits + fixtures-first scenarios; estimated infra ≈ $20/month (verify) through Dec 15.
- **Secrets rotation:** documented and rehearsed (see 9.5).
- **Availability honesty:** README states the sandbox/LLM dependencies and links the recorded demo as a fallback.

## Definition of done
- [ ] Hosted URL serves the app; `GET /api/v1/health` returns `{"status":"ok"}` with worker lag < 60 s and `paypal.ok:true`.
- [ ] `npm run smoke:hosted` passes against the hosted URL; the manual workflow is green.
- [ ] A full real-sandbox scenario (`reject_then_pass`) completes on the hosted URL from an incognito window with the human approval step, ending with two captures and a valid ledger chain (`/ledger/verify`).
- [ ] Production webhook shows 200 deliveries and valid-signature rows.
- [ ] Rollback drill performed with measured recovery time; backup restore tested.
- [ ] UptimeRobot alert test: stop the worker, confirm an alert within 10 minutes (or `/health` degrades) and recovery after restart.
- [ ] Anthropic hard limit set; Render credits/plan confirmed through Dec 15 (screenshot in `docs/decision-log.md`).
- [ ] `docs/runbook.md` complete; calendar events created; on-call owner named for each week through Dec 15.

## Risks & blockers
| Risk | Mitigation |
|---|---|
| Free/expiring DB tier | Use paid non-expiring tier; verify retention terms; calendar check |
| Render credits insufficient | Smallest paid tiers; drop the optional MCP service; run MCP locally |
| Worker crash loop | Health check + alerts; reclaim-stale-jobs logic; rollback drill |
| Webhooks misconfigured (wrong ID/URL) | Dashboard delivery check; reconcile covers missed events |
| SSE blocked by proxy | Polling fallback is always active |
| Secrets leaked in logs/video | Redaction paths; gitleaks; blur dashboards in the video |

## Time budget
**1.5 person-days** (D 1.0, A 0.25, B 0.25), mostly small blocks interleaved with other phases. **Cut first if long:** optional MCP service, UptimeRobot (use manual checks + Render alerts), backup restore drill, admin UI button. **Do not cut:** production webhook, `/health` extensions, rollback drill, cost caps, judging-window calendar.

## Handoff
Next phase can assume: stable hosted environment on `main` auto-deploy; monitored health; runbook; webhook delivering; cost caps; smoke script. **After Nov 9 23:59 IST feature freeze, only P0 fixes deploy** (two-person review after Nov 10 18:00 IST).
**Tag:** `git tag phase-9-deploy && git push --tags`
