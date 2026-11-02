# ProofPay — PayPal Integration Specification

> This is the technical heart of the project and the first tie-breaker criterion (Technological Implementation). All calls go to the **PayPal sandbox** (`https://api-m.sandbox.paypal.com`). Endpoint paths and field names below come from PayPal's v2 REST docs as I know them; **items marked ⚠ verify must be confirmed on Day 1** (see §13). Where PayPal's response disagrees with this file, PayPal wins; update this file.

## 1. Accounts and setup (Day 1, ~1 hour)

1. PayPal Developer Dashboard → **Sandbox accounts**: create one **Business** account (the *merchant/seller*) and one **Personal** account (the *buyer*, with a funded balance and a funding card).
2. **Apps & Credentials** → create a **Sandbox REST app** under the Business account → copy `Client ID` and `Secret` into `.env` (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`).
3. **Webhooks**: add `{APP_BASE_URL}/api/v1/webhooks/paypal` for these events (⚠ verify names in the dashboard list): `CHECKOUT.ORDER.APPROVED`, `PAYMENT.AUTHORIZATION.CREATED`, `PAYMENT.AUTHORIZATION.VOIDED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, and `[C]` `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.UPDATED`, `CUSTOMER.DISPUTE.RESOLVED`. Copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID`. Locally use a tunnel URL; production uses the Render URL (create a second webhook).
4. Confirm the Business account can do **authorization and multiple partial captures** (⚠ verify: some account types require enabling partial/multiple captures; the Day-1 spike proves it).
5. Put the **buyer sandbox login** in the Judge Mode banner (sandbox credentials only; never real accounts).

## 2. Settlement model (decision)

**The seller is the PayPal merchant.** One sandbox Business account receives all captured funds. `purchase_units[].payee` is **not** set. In the product, the "seller" user is a person/agent operating on behalf of that merchant account (e.g., an agency selling "pay-on-proof checkout" to its clients).

| Option | Decision |
|---|---|
| Seller = merchant (this spec) | **Chosen.** Realistic for agencies and freelancers invoicing clients; zero multi-party complexity |
| Marketplace with third-party payees (partner/platform flows) | Out of scope; documented as post-hackathon work |
| Platform collects, then PayPal Payouts to sellers | Out of scope (Payouts adds a second money movement and a compliance surface) |

## 3. API calls (adapter in `src/server/paypal/`)

Common: base URL from `PAYPAL_ENV` (`sandbox` only; `live` is rejected at startup), `Authorization: Bearer <token>`, `Content-Type: application/json`, `Prefer: return=representation` (so responses include bodies), `PayPal-Request-Id: <idempotency key>` on every POST. Token: `POST /v1/oauth2/token` with HTTP Basic `client_id:secret`, `grant_type=client_credentials`; cache until `expires_in − 60 s`; refresh once on `401`.

### 3.1 Create order (`orders.ts → createOrder`)
`POST /v2/checkout/orders`
```json
{
  "intent": "AUTHORIZE",
  "purchase_units": [{
    "reference_id": "<contractId>",
    "custom_id": "<contractId>",
    "invoice_id": "PP-<contractIdFirst8>",
    "description": "ProofPay contract: <title ≤ 80 chars>",
    "amount": { "currency_code": "USD", "value": "100.00" }
  }],
  "payment_source": { "paypal": { "experience_context": {
    "brand_name": "ProofPay",
    "locale": "en-US",
    "landing_page": "LOGIN",
    "user_action": "CONTINUE",
    "payment_method_preference": "IMMEDIATE_PAYMENT_REQUIRED",
    "return_url": "<APP_BASE_URL>/api/v1/paypal/return?contract_id=<id>",
    "cancel_url": "<APP_BASE_URL>/api/v1/paypal/cancel?contract_id=<id>"
  } } }
}
```
Response: `id` (order id), `status: "PAYER_ACTION_REQUIRED"`, `links[]`. Approval URL = the link with `rel: "payer-action"`, else `rel: "approve"` (⚠ verify which the sandbox returns; the adapter accepts either). Store `paypal_order_id`; contract → `FUNDING`; ledger `FUNDING_STARTED`.
`user_action: CONTINUE` is used because nothing is captured at approval; we authorize afterwards.

### 3.2 Authorize order (`orders.ts → authorizeOrder`)
Invoked by `GET /api/v1/paypal/return?token=<orderId>&contract_id=<id>`.
`POST /v2/checkout/orders/{orderId}/authorize` (empty body).
Response path: `purchase_units[0].payments.authorizations[0]` → `{ id, status: "CREATED", amount, create_time, expiration_time? }`.
Store: `authorization_id`, `auth_created_at = create_time`, `honor_until = create_time + 3 days`, `auth_expires_at = expiration_time ?? create_time + 29 days` (⚠ verify the field), `funded_at = now()`, each milestone `due_at = funded_at + due_in_days`. Contract → `FUNDED`; ledger `AUTHORIZATION_CREATED`. If the response status isn't `CREATED`, or the order status isn't `APPROVED` → mark funding failed, return to `ACCEPTED` with error banner.

### 3.3 Capture (partial / final) (`capture.ts` — imported **only** by `release/service.ts`)
`POST /v2/payments/authorizations/{authorizationId}/capture`
```json
{ "amount": { "currency_code": "USD", "value": "60.00" },
  "final_capture": false,
  "invoice_id": "PP-<contractIdFirst8>-m1",
  "note_to_payer": "ProofPay: milestone 'Dataset' verified." }
```
- `value` = `toPayPalValue(milestone.amount_minor)` (integer cents → `"60.00"`, never floats).
- `final_capture = (milestone.idx == max idx)` (milestones are sequential, §5).
- `invoice_id` is unique per milestone (PayPal rejects duplicate invoice ids → `DUPLICATE_INVOICE_ID`).
- Response: `{ id, status: "COMPLETED" | "PENDING" | "DECLINED" | …, amount, final_capture }`.

### 3.4 Void (`void.ts`)
`POST /v2/payments/authorizations/{authorizationId}/void` → `204` (or `200` with body). Used on: final failure (FR-28), buyer cancel (FR-29), and after the **last** capture is **not** used (a `final_capture: true` capture closes the authorization automatically).

### 3.5 Reauthorize (`authorizations.ts → reauthorize`)
`POST /v2/payments/authorizations/{authorizationId}/reauthorize` with `{}` or `{ "amount": {…} }` (⚠ verify body requirements). Allowed only **after the 3-day honor period** and within the 29-day window; the response contains a **new** authorization `id`. PayPal documents limits on amount increases (up to 115% of the original or +$75, whichever is less): we never increase.

### 3.6 Refund (`refund.ts`, `[S]`)
`POST /v2/payments/captures/{captureId}/refund` with `{ "amount": {…}, "note_to_payer": "…" }` (omit `amount` for a full refund). Ledger `REFUND_ISSUED`.

### 3.7 Reads
- `GET /v2/payments/authorizations/{id}` → live status (`CREATED`, `PARTIALLY_CAPTURED`, `CAPTURED`, `VOIDED`, `EXPIRED`, …). Powers the **"✓ Verified with PayPal"** badge shown to sellers (timestamped; cached 30 s).
- `GET /v2/checkout/orders/{orderId}` → includes `purchase_units[0].payments.captures[]` (used by reconciliation to find captures by `invoice_id`).

## 4. Idempotency and retries

| Rule | Detail |
|---|---|
| Key format | `pp:{contractId}:{milestoneKey}:{action}:{n}` (e.g., `pp:9c1f…:m1:capture:1`); contract-level actions use `pp:{contractId}:{action}:{n}` (e.g., `…:void:1`, `…:reauth:{honorUntilEpoch}`) |
| `n` semantics | Constant across **automatic** retries of the same attempt. Incremented only for a **deliberate new attempt** after a known failure (user clicks "Retry release"); equals `milestones.release_attempts`. Reusing a key after a decline would replay PayPal's cached response |
| Automatic retries | On network error, timeout (10 s), `5xx`, or `429`: retry the **same key** up to 3 times with delays 1 s, 3 s, 9 s (+ jitter). Never retry `4xx` business errors (they are final) |
| Ambiguous outcome | If retries end without a definitive response, leave the milestone in `RELEASING`, fail the job with `last_error='AMBIGUOUS'`, and let **reconciliation** (§8) decide |
| Money | Integer minor units internally; conversion only in `money.ts` (`toPayPalValue`, `fromPayPalValue` with string math, no floats) |
| Logging | Log `debug_id` (PayPal response header `PayPal-Debug-Id`) on every non-2xx; never log secrets or tokens |

## 5. The release service (the only gateway to money)

`src/server/release/service.ts → releaseMilestone(milestoneId)` (called by the `RELEASE_MILESTONE` job handler; also by `retry-release`).

```
TX-A (advisory lock on contract):
  require milestone.status ∈ {PASSED, RELEASE_FAILED}
  require contract.status ∈ {FUNDED, IN_PROGRESS}           // not CANCELLED/FAILED/EXPIRED
  require now < contract.auth_expires_at
  require (all earlier milestones RELEASED)                  // sequential rule
  require Σ captured_minor + milestone.amount_minor ≤ contract.total_minor
  set milestone.status = RELEASING; if from RELEASE_FAILED: release_attempts += 1
  append ledger CAPTURE_REQUESTED {amount, idempotency_key, final_capture}
COMMIT
→ capture(...)   // outside any DB transaction, key per §4
TX-B (advisory lock):
  COMPLETED → status RELEASED, capture_id, captured_at, ledger CAPTURE_COMPLETED;
              if idx == max idx → contract COMPLETED + ledger CONTRACT_COMPLETED
  PENDING   → keep RELEASING, enqueue RECONCILE_PAYPAL (run_at +60 s)
  DECLINED / 4xx business error → status RELEASE_FAILED, ledger CAPTURE_FAILED{paypal_error}
COMMIT
```
**Guards:** (1) the DB `CHECK capture_only_when_releasing`; (2) the only exported function that can reach `capture.ts` is `releaseMilestone`; (3) an ESLint `no-restricted-imports` rule bans importing `paypal/capture|void|refund` anywhere else; (4) unit test asserts `releaseMilestone` throws for every status except `PASSED`/`RELEASE_FAILED`.

**Other release-service functions:** `voidRemaining(contractId, reason)` (void + ledger `AUTHORIZATION_VOIDED`, milestones in `FAILED_FINAL` → `VOIDED`), `refundCapture(...)`.

**Milestones are strictly sequential (PI-1):** milestone *n* accepts submissions only when milestone *n−1* is `RELEASED`. This makes `final_capture` unambiguous and gives the `context_milestones` rubric feature its meaning.

## 6. Webhooks

`POST /api/v1/webhooks/paypal` (`src/app/api/v1/webhooks/paypal/route.ts`):
1. Read the **raw body** (do not re-serialize before verification).
2. Verify via `POST /v1/notifications/verify-webhook-signature` with `{ auth_algo, cert_url, transmission_id, transmission_sig, transmission_time, webhook_id: PAYPAL_WEBHOOK_ID, webhook_event: <parsed body> }` using headers `PAYPAL-AUTH-ALGO`, `PAYPAL-CERT-URL`, `PAYPAL-TRANSMISSION-ID`, `PAYPAL-TRANSMISSION-SIG`, `PAYPAL-TRANSMISSION-TIME`. Expect `verification_status: "SUCCESS"`.
3. Insert into `paypal_events` (`ON CONFLICT (event_id) DO NOTHING`); store `signature_valid`. **Invalid signature → store, respond `400`, do nothing else.**
4. Respond `200` immediately; process in-line (fast, idempotent) and enqueue `RECONCILE_PAYPAL` if anything is inconsistent.

| Event | Handler behavior (all idempotent) |
|---|---|
| `PAYMENT.CAPTURE.COMPLETED` | Match milestone by `invoice_id` (`PP-<id8>-<mkey>`) or `capture_id`; if `RELEASING` and capture id matches → mark `RELEASED` (same as TX-B); if already `RELEASED` → no-op; ledger `WEBHOOK_RECEIVED` |
| `PAYMENT.CAPTURE.PENDING` | Keep `RELEASING`; enqueue reconcile |
| `PAYMENT.CAPTURE.DENIED` | `RELEASING → RELEASE_FAILED` + ledger |
| `PAYMENT.CAPTURE.REFUNDED` | Ledger confirmation; update `REFUND_ISSUED` if not yet recorded |
| `PAYMENT.AUTHORIZATION.CREATED` | Confirmation only (state already set by return handler) |
| `PAYMENT.AUTHORIZATION.VOIDED` | If we initiated the void (ledger has `AUTHORIZATION_VOIDED`) → no-op; **else** set `funding_at_risk=true` + ledger + UI banner |
| `CHECKOUT.ORDER.APPROVED` | Confirmation only; if the browser never returned, enqueue reconcile to authorize (recovers abandoned tabs) |
| `CUSTOMER.DISPUTE.*` `[C]` | See §11 |

Out-of-order and duplicate delivery are expected; handlers never move a status **backwards**.

## 7. Reauthorization worker (`REAUTH_CHECK`)

Scheduler in `src/worker/index.ts` enqueues `REAUTH_CHECK` every 10 minutes (`dedupe_key = reauth-sweep:{yyyymmddHHMM/10}`). Handler:
```
for contract in (status ∈ FUNDED/IN_PROGRESS AND remaining_minor > 0):
  if now >= honor_until AND now < auth_expires_at − 1h:
      reauthorize(contract.authorization_id, key = pp:{id}:reauth:{honor_until epoch})
      ok  → authorization_id = new id; honor_until = now + 3d; ledger REAUTHORIZED
      err → funding_at_risk = true; ledger WEBHOOK_RECEIVED-style note; UI banner "Funds may be unavailable; re-fund to continue"
  if auth_expires_at − now < 72h → UI shows expiry warning
  if now >= auth_expires_at → EXPIRE_CONTRACT job: contract EXPIRED (+ ledger CONTRACT_EXPIRED), remaining milestones VOIDED
```
**Sandbox reality check (⚠ verify):** the honor period is 3 days, so the demo cannot naturally reach reauthorization within the 10-day build except during the Dec 1–15 judging window. Plan: (a) unit/integration tests with MSW; (b) on Day 1, try a reauth call immediately and record PayPal's response (likely a "too soon" error) in `docs/spike-log.md`; (c) the README states plainly that reauth is implemented and tested against mocks and that the live behavior was observed only for the error case. **Do not simulate success.**

## 8. Reconciliation (`RECONCILE_PAYPAL`)

Triggered by: ambiguous capture, `PENDING` capture, missed webhooks, abandoned approval, and a global sweep every 5 minutes for rows stuck in `RELEASING`/`FUNDING` > 2 minutes.

| Stuck state | Reconcile action |
|---|---|
| `RELEASING` | `GET /v2/checkout/orders/{order}` → find capture with `invoice_id = PP-<id8>-<mkey>`: `COMPLETED` → finalize `RELEASED`; `PENDING` → recheck later (max 24 h); `DECLINED` or **none found after ≥ 5 min and ≥ 3 automatic retries already made** → `RELEASE_FAILED` (safe, because the same key can be retried or a new `n` used) |
| `FUNDING` | `GET order`: `APPROVED` → authorize now; `CREATED/PAYER_ACTION_REQUIRED` older than 3 h → back to `ACCEPTED`; `COMPLETED/AUTHORIZED` → record authorization |
| `FUNDED` but `funding_at_risk` | `GET authorization` → if `VOIDED/EXPIRED` → contract `EXPIRED`/`FAILED` with ledger; else clear the flag |

## 9. Negative testing and the chaos suite

- **Header:** `PayPal-Mock-Response: {"mock_application_codes":"<CODE>"}` (sandbox only). Applied by `client.ts` when `CHAOS_MODE=true` **and** the contract has a one-shot `chaos_mock_code` (set via `POST /contracts/{id}/chaos`; cleared after use). Documented codes: `INSTRUMENT_DECLINED`, `TRANSACTION_REFUSED`, `INTERNAL_SERVER_ERROR`, `DUPLICATE_INVOICE_ID` (⚠ verify which codes apply to authorization capture; the chaos suite records the real behavior in `docs/chaos-results.md`).
- **Demo beat (`capture_declined` scenario):** milestone passes → capture is forced to `INSTRUMENT_DECLINED` → milestone `RELEASE_FAILED` → buyer sees "Payment declined. Retry release" → clearing the chaos code and clicking retry (new `n`) → `RELEASED`.
- The full 12-case suite is listed in `testing.md` §5 and run by `npm run chaos`.

## 10. Money and compliance notes

| Topic | Position |
|---|---|
| Fees | Not modeled; PayPal fees may apply to each capture in real use (⚠ verify for your region); stated in README |
| Currency | USD only; `currency_code: "USD"` hard-coded |
| Card data | Never touched: approval happens on PayPal's pages (PCI scope minimal) |
| Terms | "Authorization hold, not escrow"; rely on PayPal's own rules for holds and windows |

## 11. Dispute loop `[C]` (build only after the MVP demo is solid; ~1 day)

Goal: show the Proof Pack used as seller evidence on a PayPal dispute.
1. **Create dispute (sandbox):** try the buyer sandbox account's **Resolution Center** UI first (fastest). Fallback: Disputes API with buyer-side credentials / required scope (⚠ verify: PayPal's test guide mentions buyer-side credentials and a create-dispute scope).
2. Webhook `CUSTOMER.DISPUTE.CREATED` → link to the contract by capture/transaction id → ledger `DISPUTE_OPENED`; row in `disputes`.
3. Generate the **Proof Pack PDF** (`ledger/proofpack.ts`).
4. **Provide evidence:** `POST /v1/customer/disputes/{id}/provide-evidence` (multipart: the PDF + notes). In the sandbox use evidence type `OTHER` (⚠ verify). Ledger `EVIDENCE_SUBMITTED`.
5. Use the **sandbox-only** update-status / settle endpoints to complete the story (⚠ verify names in PayPal's disputes test guide). Show "evidence submitted" in the UI; do **not** claim a win unless the sandbox actually resolves in the seller's favor.

## 12. Day-1 spike script (`scripts/paypal-spike.ts`) — the project gate

Run: `npx tsx scripts/paypal-spike.ts`. It logs every request/response (secrets redacted) to `docs/spike-log.md`.

| # | Step | Assertion |
|---|---|---|
| 1 | Create `AUTHORIZE` order for $100.00 | `status` and an approval link exist |
| 2 | **Pause:** print the approval URL; operator approves as the sandbox buyer; press Enter | – |
| 3 | Authorize the order | `authorizations[0].status == "CREATED"`; record `expiration_time` if present |
| 4 | Capture $60.00, `final_capture:false` | `status == "COMPLETED"` |
| 5 | `GET authorization` | status shows partially captured; remaining usable |
| 6 | Capture $40.00, `final_capture:true` | `COMPLETED` |
| 7 | New order+authorize ($50), capture $20 non-final, then **void** | void succeeds; further capture fails with a clear error |
| 8 | New order+authorize, call **reauthorize** immediately | record PayPal's exact response (expected: rejection because the honor period hasn't ended) |
| 9 | New order+authorize, capture with `PayPal-Mock-Response: INSTRUMENT_DECLINED` | declined response reproducible |
| 10 | Webhook delivery check (tunnel on): events received and signature verified | `verification_status == SUCCESS` for capture and authorization events |

**Gate:** steps 1–7 and 9 must pass by **Nov 3, 12:00 IST** (run the spike on Nov 2). If steps 4 or 6 fail with no workaround → switch to the backup idea (see `roadmap.md` §6).

## 13. Things to verify on Day 1 (⚠ list)

1. Partial and multiple captures on one authorization work on your sandbox Business account (and whether any setting must be enabled).
2. Approval link relation name (`payer-action` vs `approve`) and whether `user_action: CONTINUE` is accepted with `AUTHORIZE`.
3. Authorization object exposes `expiration_time` (or compute +29 days).
4. Exact webhook event names and payload shape for capture/authorization (what field holds `invoice_id` / `custom_id`).
5. Reauthorize request/response shape and error when called too early.
6. Which `mock_application_codes` are honored on capture.
7. Whether `invoice_id` uniqueness is enforced per merchant (affects retries and test re-runs; use a random suffix in tests).
8. Behavior of `final_capture: true` when the captured amount is less than the remaining authorization (should release the rest).

## 14. Assumptions

| # | Assumption |
|---|---|
| PI-A1 | The sandbox Business account behaves like a standard US merchant (USD). |
| PI-A2 | PayPal sandbox latency ≤ 3 s per call typically; timeouts set at 10 s. |
| PI-A3 | Judges use the provided buyer sandbox credentials, or their own sandbox buyer if they have one. |
| PI-A4 | No PayPal Partner/Commerce Platform permissions are required for the chosen flow. |
