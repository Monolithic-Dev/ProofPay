# ProofPay — Deployment

> Target: **Render** (sponsor; web service + background worker + managed Postgres). Constraint from the rules summary (confirm in the official rules): the project must remain **live and free for judges through Dec 15, 2026**. Everything below is designed around that date, not just the Nov 12 deadline.

## 1. Hosting choice and why

| Option | Verdict |
|---|---|
| **Render** (web + worker + Postgres) | **Chosen.** One dashboard, native background worker, managed Postgres, sponsor goodwill/credits, simple `render.yaml` |
| Vercel + external DB + separate worker host | Rejected: splits the system across three vendors; worker hosting is awkward |
| Fly.io / Railway | Fine technically, no sponsor benefit |

**Cost realism.** Free tiers are risky for this app: free web services sleep (cold starts during judging), free workers don't exist, and **free Postgres instances may expire after a limited period (⚠ verify current Render policy; if it expires ~30 days after creation, a DB created Nov 2 would die around Dec 2, before Dec 15)**. Use paid starter tiers for DB, web, and worker, funded by Render credits if available (rules summary mentions $50 credits; verify). Rough estimate (⚠ verify current pricing): web ≈ $7/mo, worker ≈ $7/mo, Postgres starter ≈ $6–7/mo → about $20/mo, ≈ $30 through Dec 15.

## 2. Services (Render blueprint `render.yaml`)

```yaml
databases:
  - name: proofpay-db
    plan: basic-256mb        # ⚠ confirm plan name; must be a non-expiring paid tier
    databaseName: proofpay
    postgresMajorVersion: "16"

services:
  - type: web
    name: proofpay-web
    runtime: node
    plan: starter
    buildCommand: npm ci && npm run build && npm run db:migrate
    startCommand: npm run start
    healthCheckPath: /api/v1/health
    autoDeploy: true
    envVars:
      - fromGroup: proofpay-shared
      - key: DATABASE_URL
        fromDatabase: { name: proofpay-db, property: connectionString }
      - key: RUN_ROLE
        value: web

  - type: worker
    name: proofpay-worker
    runtime: node
    plan: starter
    buildCommand: npm ci
    startCommand: npm run worker:start
    autoDeploy: true
    envVars:
      - fromGroup: proofpay-shared
      - key: DATABASE_URL
        fromDatabase: { name: proofpay-db, property: connectionString }
      - key: RUN_ROLE
        value: worker

  - type: web            # optional MCP server over HTTP (stdio is used locally)
    name: proofpay-mcp
    runtime: node
    plan: starter
    buildCommand: npm ci
    startCommand: npm run mcp:start
    autoDeploy: true
    envVars:
      - fromGroup: proofpay-shared
      - key: PROOFPAY_API_URL
        value: https://proofpay-web.onrender.com
```
Notes: migrations run during the **web** build only (never from the worker, to avoid races). The MCP service is **optional `[S]`**: if short on credits, run MCP locally for the demo.

## 3. Environment variables (canonical)

| Variable | Used by | Example / default | Secret? |
|---|---|---|---|
| `NODE_ENV` | all | `production` | no |
| `APP_BASE_URL` | web | `https://proofpay-web.onrender.com` | no |
| `DATABASE_URL` | web, worker | from Render | yes |
| `PAYPAL_ENV` | web, worker | `sandbox` (app refuses anything else) | no |
| `PAYPAL_CLIENT_ID` | web, worker | – | yes |
| `PAYPAL_CLIENT_SECRET` | web, worker | – | yes |
| `PAYPAL_WEBHOOK_ID` | web | – | no (but keep private) |
| `ANTHROPIC_API_KEY` | web, worker | – | yes |
| `ANTHROPIC_MODEL` | web, worker | `claude-sonnet-5-5` | no |
| `ANTHROPIC_MODEL_FAST` | worker | `claude-haiku-5-5` | no |
| `LLM_DAILY_BUDGET_USD` | web, worker | `5` | no |
| `SESSION_SECRET` | web | `openssl rand -hex 32` | yes |
| `DEMO_MODE` | web | `true` | no |
| `DEMO_TIME_SCALE` | web, worker | `1` (use `2880` only when recording auto-release: 48 h → 1 min) | no |
| `CHAOS_MODE` | web, worker | `true` on demo only | no |
| `MAX_CONTRACT_DAYS` | web | `28` | no |
| `PURGE_ENABLED` | worker | `false` until Dec 16 | no |
| `LOG_LEVEL` | all | `info` | no |
| `PROOFPAY_API_URL`, `PROOFPAY_API_KEY` | mcp, demo agents | – | key: yes |

## 4. CI/CD

**GitHub Actions (`.github/workflows/ci.yml`)** on every push/PR:
1. `npm ci`
2. `npm run lint` and `npm run typecheck`
3. `npm run test:unit` (no network)
4. `gitleaks` secret scan
5. `npm run build`
Integration tests (`test:integration`) run on PRs to `main` with a Postgres service container and MSW mocks (no real PayPal/LLM calls). **Real-PayPal tests** (`npm run chaos`, `spike:paypal`) are manual only.

**CD:** Render auto-deploys `main`. Rule: **after feature freeze (Nov 9, 23:59 IST) only fixes merge to `main`; after Nov 10, 18:00 IST nothing merges except a P0 fix with a second person's review.**

## 5. Environment strategy (simplified)

| Env | Purpose | Data |
|---|---|---|
| Local | Development | Docker Postgres; tunnel for webhooks; separate PayPal webhook |
| `main` (Render) | The single demo/production-for-hackathon deployment | Seeded demo users; sandbox PayPal |
No staging (time box). Risk managed by feature flags (`DEMO_MODE`, `CHAOS_MODE`) and the rollback plan below.

## 6. Monitoring and "how will we know it's broken during the demo?"

| Signal | How |
|---|---|
| Liveness/readiness | `GET /api/v1/health` returns DB, PayPal (cached token check), LLM (budget remaining) |
| Uptime alerts | UptimeRobot (free) hitting `/api/v1/health` every 5 min → email/Telegram to the team |
| Logs | Render logs with structured `pino` JSON: `request_id`, `contract_id`, `job_id`, PayPal `debug_id`; search by contract id |
| Worker heartbeat | Worker writes `worker:heartbeat` row/timestamp every 30 s (in `jobs` as a `DONE` sentinel or a small `kv` row); `/health` shows `worker_lag_seconds` |
| Stuck-work alarm | `/health` includes counts of `RELEASING` > 2 min and `PENDING` jobs older than 2 min |
| LLM budget | `/health.llm.budget_remaining_usd` plus provider-side hard limit |
| Dashboards | None beyond Render's metrics (time box) |

## 7. Rollback and "demo insurance"

1. **Bad deploy:** Render → Deploys → **Rollback** to the previous successful deploy (documented in README). Migrations are additive-only after Nov 6, so rollback is safe.
2. **PayPal sandbox outage:** the app shows a banner via `/health`; the team switches to the **recorded demo video** (linked on the landing page and README). Never fake PayPal responses live.
3. **LLM outage/budget exhausted:** degraded mode (see `ai-pipeline.md` §8); the scenario runner falls back to cached generations in `demo/fixtures/`.
4. **Webhook misconfiguration:** reconciliation job repairs state within 5 min; manual "Reconcile now" admin button.
5. **Before recording the video:** snapshot DB (`pg_dump`), freeze deploys, run the scenario 3× on the hosted URL.

## 8. Judging-window plan (Nov 12 → Dec 15)

| Date | Action |
|---|---|
| Nov 12 | After submission: **freeze** (no deploys except P0). Confirm webhook delivery and health |
| Nov 20 | Check Render credit balance; check Anthropic spend; verify judge-mode works from a logged-out incognito window |
| Dec 1, Dec 8, Dec 15 | Manual smoke test of the three headline scenarios; confirm DB is still alive (not expired) |
| Dec 10 | Calendar reminder: extend credits/plan if needed |
| Dec 16 | Set `PURGE_ENABLED=true`; optionally scale down or delete services; rotate secrets |

## 9. Assumptions

| # | Assumption |
|---|---|
| DP-1 | Render's participant credits (if any) can cover about $30 of paid tiers. If not, use the smallest paid tiers and fund from the team. |
| DP-2 | `render.yaml` plan names above are placeholders; confirm current plan identifiers when creating the blueprint. |
| DP-3 | `npm run start` serves Next.js on `PORT` provided by Render. |
| DP-4 | SSE connections are allowed through Render's proxy; heartbeat every 15 s prevents idle timeouts. |
