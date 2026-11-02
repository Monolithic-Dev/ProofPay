# Phase 6 — Frontend Core & Integration

> **Goal (done means):** every screen in `ux-flows.md` (S0–S8) works against the real API with live updates: Studio with lint fixes, Fund, Timeline with the Funds Bar, Submit + Verification Report with evidence highlighting, Ledger (AG Grid) with Proof Pack download, API keys, light/dark, accessible, responsive down to 360 px.
> **Window:** Tue Nov 3 → Sun Nov 8 (starts against mocks on Nov 3; integrates as Phases 3–5 land) · **Budget:** 7 person-days · **Owner:** C (lead); A adds the SSE route; B supplies report fixtures.

## Preconditions
- Phase 1 complete (tokens, shell, shared types, API client stubs). **This phase starts against MSW mocks** and switches screens to the real API as each backend phase tags (3 → Studio/accept, 4 → submit/report, 5 → fund/ledger).
- For integration steps: Phases 3, 4, 5 tags exist and the dev stack runs (`npm run dev` + `npm run worker`).

## Implements
`ux-flows.md` §1–§8 · `api-spec.md` §4–§8 · `prd.md` FR-12, FR-34…FR-36, FR-40 (UI side) · `edge-cases.md` E-22, E-24, E-27, E-34, E-57 (UI behavior) · correction **C-3** (SSE by DB polling).

## Task breakdown

### 6.1 Component kit and accessibility foundations (Owner C)
- [ ] `npx shadcn@latest add button card badge dialog sheet tabs tooltip skeleton input textarea toast separator progress`; wrap in `src/components/ui/*` with tokens from `globals.css` (focus ring `outline: 2px solid var(--brand)`).
- [ ] `src/components/common/`: `PageShell.tsx`, `EmptyState.tsx`, `ErrorState.tsx` (shows `request_id` and a "Copy details" button), `LoadingBlock.tsx`, `MonoText.tsx` (hashes/ids with copy), `Money.tsx` (`<Money minor={6000} />` → `$60.00` using `Intl.NumberFormat('en-US',{style:'currency',currency:'USD'})`).
- [ ] `src/lib/format.ts`: `formatDuration(ms)` (`2d 4h`), `shortHash(h)`, `relativeTime(iso)`.
- [ ] Global error boundary `src/app/error.tsx` and `not-found.tsx`.
- [ ] Tests (Vitest + Testing Library): `Money formats cents`, `formatDuration rounds down`, `ErrorState shows request id`, `shortHash keeps first 8 chars`.

### 6.2 Data layer: API client, React Query, SSE (Owner C, Owner A for the route)
- [ ] Complete `src/shared/api-client.ts` methods (typed with Phase 1 Zod): `compileContract`, `listContracts`, `getContract`, `patchContract`, `lintContract`, `applyLintFix`, `proposeContract`, `acceptContract`, `cancelContract`, `startFunding`, `getFundingStatus`, `getMilestone`, `submitDeliverable`, `getVerification`, `decideEscalation`, `retryRelease`, `setChaos`, `getLedger`, `verifyLedger`, `downloadProofPack` (returns blob URL), `runScenario`, `getRun`, `createApiKey`, `listApiKeys`, `revokeApiKey`, `me`, `demoLogin`, `logout`.
- [ ] `src/lib/query.tsx`: `QueryClientProvider`; hooks `useContract(id)` (`refetchInterval: 5000` as fallback), `useMilestone(id,key)`, `useVerification(id)`, `useLedger(id)`, `useContracts()`.
- [ ] **SSE route (Owner A) — C-3:** `src/app/api/v1/contracts/[id]/events/route.ts`: `requireParty`; `ReadableStream` that every 1.5 s runs `SELECT seq,type,payload FROM ledger_events WHERE contract_id=$1 AND seq > $last ORDER BY seq` and emits `event: contract.updated` with `{contract_id, type, milestone_key?, seq}`; start from `?after_seq=` (default = current head); heartbeat comment `: ping` every 15 s; stop on `req.signal.abort`; headers `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`; max stream life 25 minutes (client reconnects with `after_seq`).
- [ ] **Ledger and Proof Pack routes (Owner A) — previously unassigned in the spec, assigned here:** `src/app/api/v1/contracts/[id]/ledger/route.ts` (GET `?limit ≤ 500&after_seq` → `{events, head_hash}`), `contracts/[id]/ledger/verify/route.ts` (GET → `verifyChain`), `contracts/[id]/proof-pack/route.ts` (GET `?format=json|pdf`); `src/server/ledger/proofpack.ts`: `buildProofPack(contractId)` per the JSON shape in `api-spec.md` §8 (contract canonical + hash, PayPal ids from ledger/milestones, submissions' sha256 + received_at, verifications as `VerificationView`, full ledger, chain result, disclaimer text "Authorization hold, not escrow. Sandbox only."), and `[S]` `renderProofPackPdf(pack)` with `pdfkit` (title page, contract summary, milestone table, verification summaries, ledger table with hashes, footer with head hash). Tests `tests/integration/proofpack.test.ts`: `proof pack JSON matches schema`, `includes head_hash equal to verifyChain`, `stranger gets 404`, `PDF renders with %PDF header and under 2 MB`, `ledger route paginates by after_seq`.
- [ ] `src/lib/sse.ts`: `useContractEvents(contractId)` using `EventSource` with reconnect (backoff 1 s→10 s) and `after_seq` resume; on each event `queryClient.invalidateQueries(['contract', id])`, `['ledger', id]`, and the milestone key; dedupe by `seq`.
- [ ] Tests: `tests/integration/sse.test.ts` (A): `streams new ledger events within 3s`, `resumes after_seq without duplicates`, `stranger gets 404`, `sends heartbeat`; `tests/unit/sse-hook.test.tsx` (C): `invalidates queries on event`, `dedupes repeated seq`, `reconnects with last seq`.

### 6.3 Signature components (Owner C) — `ux-flows.md` §3
- [ ] `components/contract/FundsBar.tsx`: props `{ totalMinor, releasedMinor, heldMinor, voidedMinor }`; stacked segments (`--ok`, `--brand`, striped `--void`), labels, tooltips, 150 ms width transition, `prefers-reduced-motion` respected, `role="img"` with `aria-label="Released $60.00, held $40.00, voided $0.00 of $100.00"`.
- [ ] `components/contract/Countdown.tsx` (`target`, `label`, `warnBelowMs`): uses a 1-second ticker only when visible; text + icon at warn state.
- [ ] `components/contract/StatusChip.tsx`: mapping for every `ContractStatus` and `MilestoneStatus` (icon + label + color) with `aria-label`.
- [ ] `components/contract/VerifiedWithPayPalBadge.tsx`: calls `getFundingStatus` (poll 30 s); states: loading / verified at `hh:mm:ss` / unavailable.
- [ ] `components/ledger/ChainBadge.tsx`: calls `verifyLedger` on mount and after events; green `Ledger intact ✓ (N events)` or red with `broken_at_seq`.
- [ ] Tests: `FundsBar segments sum to total`, `FundsBar aria-label correct`, `StatusChip covers every status (exhaustive map)`, `Countdown switches to warn state under threshold`, `ChainBadge shows broken seq`.

### 6.4 Screens (Owner C) — each includes loading, empty, error states
- [ ] **S0 `src/app/page.tsx` + `components/judge/JudgePanel.tsx`:** hero copy and honesty line; if `DEMO_MODE` show persona buttons (`demoLogin`), `ScenarioButtons.tsx` (5 scenarios; disabled with tooltip until Phase 7 API exists), `SandboxCredsBanner.tsx` (server component reading `SANDBOX_BUYER_EMAIL/PASSWORD`; copy buttons; "sandbox only" label), link to recorded demo (`NEXT_PUBLIC_DEMO_VIDEO_URL`).
- [ ] **S1 Studio:** `src/app/studio/page.tsx` (`PromptBox.tsx` with 2,000-char counter, example chips, compile button, rate-limit/budget errors → `ErrorState` with "Use a template" button that loads `src/lib/templates/dataset-summary.json`); `src/app/studio/[contractId]/page.tsx` (`ContractEditor.tsx` read-only structured view + collapsible "Edit JSON" with live Zod validation and `patchContract`; `LintPanel.tsx` grouped by severity with `Fix` buttons calling `applyLintFix`; `ProposeBar.tsx` with seller email input, disabled with a tooltip listing blocking error codes).
- [ ] **S2/S4 `src/app/contracts/[id]/page.tsx`:** role-aware: seller on `PROPOSED` sees Accept panel with hash preview (`contractHash` computed client-side from canonical JSON using shared `canonicalize` to display the *expected* hash, label "will lock as"); header (status chip, FundsBar, Countdown chips for `honor_until` and `auth_expires_at`, VerifiedWithPayPalBadge, funding-at-risk banner); `MilestoneCard.tsx` list with primary actions per role/state (Submit work, Review evidence, Retry release); right rail `RecentEvents.tsx` from ledger + "Why did this happen?" explainer mapping event type → plain-language sentence (table in `src/lib/explain.ts`); tabs Overview / Ledger / Proof Pack.
- [ ] **S3 `contracts/[id]/fund/page.tsx`:** summary card, "Held, not charged" explainer, `Continue to PayPal` (calls `startFunding` then `window.location.assign(approval_url)`), handles `?error=` and `?cancelled=1` banners.
- [ ] **S5 `contracts/[id]/milestones/[mid]/page.tsx`:** `SubmitPanel.tsx` (textarea + file input reading ≤ 1 MiB as text; client checks: valid JSON array for `json_records`, size; shows the **Idempotency-Key** generated per attempt via `crypto.randomUUID()`); `SubmissionStepper.tsx` (Received → Checks → AI review → Policy decision → Release, driven by milestone status + latest verification); `VerificationReport.tsx` (decision pill, `CriterionRow.tsx` rows with type badge, plain-language result, expected vs observed, evidence quotes with `verified ✓`); `ArtifactViewer.tsx` + `EvidenceHighlight.tsx` (splits text on verified quote offsets and wraps matches in `<mark>`; **never `dangerouslySetInnerHTML`**; truncates >50k chars with "show more"; JSON arrays rendered as a virtualized table above 100 rows); `ManipulationCallout.tsx`; `FixList.tsx`; `EscalationActions.tsx` (Approve/Reject with note, timer showing `auto_release_at`).
- [ ] **S6 `contracts/[id]/ledger/page.tsx`:** `components/ledger/LedgerGrid.tsx` using `ag-grid-react` Community: `ModuleRegistry.registerModules([AllCommunityModule])`; `columnDefs`: `#` (seq), `Time`, `Type` (chip renderer), `Actor`, `Summary` (from `explain.ts`), `PayPal ref` (extracts ids from payload, copy button), `Hash` (short, copy); `defaultColDef {sortable:true, filter:true, resizable:true}`, `quickFilterText` input, `rowHeight 44`, `domLayout:'autoHeight'` for <200 rows, theme variables mapped to tokens (light/dark via `ag-theme-quartz` + CSS vars), `onRowClicked` → `LedgerDrawer.tsx` (sheet showing full payload JSON, prev/this hash, copy). `ProofPackButtons.tsx` (JSON/PDF download; PDF button hidden unless the `[S]` PDF renderer exists).
- [ ] **S8 `settings/api-keys/page.tsx`:** create (secret shown once in a dialog with copy), list, revoke; curl + MCP config snippets.
- [ ] Route guards: client redirect to `/` when `me` is 401 (Judge Mode available); server-side check in layout for protected pages.

### 6.5 Theming, responsiveness, accessibility pass (Owner C)
- [ ] `ThemeToggle` persists choice; `color-scheme` meta; AG Grid theme tokens in dark mode verified.
- [ ] Breakpoints: single-column below 768 px; Funds Bar and milestone cards stack; ledger grid horizontal scroll with sticky first column.
- [ ] ARIA: `aria-live="polite"` region announcing milestone status changes; focus management after submit (move focus to stepper heading); dialogs trap focus; all icons have text equivalents.
- [ ] Playwright + axe: `tests/e2e/a11y.spec.ts`: `landing`, `studio`, `contract timeline`, `verification report`, `ledger` — **no serious/critical violations**.

### 6.6 Mock-to-real integration passes (Owners C + A/B)
- [ ] `src/mocks/handlers.ts` (MSW browser worker) with fixtures for each endpoint, enabled by `NEXT_PUBLIC_API_MOCKING=true` for early development; **remove from production build**.
- [ ] Integration checklist (check off as backends land): Studio compile/lint/fix/propose (Phase 3) → Accept panel → Fund redirect + return (Phase 5) → Submit + Report (Phase 4) → Escalation decision (Phase 4) → Ledger + chain badge (Phase 2/5) → SSE live updates → retry release + chaos toggle (Phase 5).
- [ ] E2E specs `tests/e2e/` (PayPal stubbed under `NODE_ENV=test` via MSW in the server process using `PAYPAL_BASE_URL_OVERRIDE` allowed **only** when `NODE_ENV=test`): `studio-lint-fix.spec.ts` (`compile shows vague-term error; one click fix clears it; propose enabled`), `happy-path.spec.ts` (`buyer funds, seller submits m1 and m2, both released, funds bar shows $100 released`), `reject-then-pass.spec.ts` (`22 rows rejected with highlighted row; resubmission passes`), `injection.spec.ts` (`manipulation callout shown and milestone rejected`), `escalation.spec.ts` (`buyer approves escalated milestone`), `ledger.spec.ts` (`grid sorts and filters; drawer shows payload; chain badge intact`).

## Real-world engineering concerns
- **XSS:** artifacts and quotes are user/LLM-controlled text → render as text nodes only; evidence highlight built from string offsets, not HTML.
- **Large data:** 1 MiB artifacts → virtualized/limited rendering; avoid re-rendering on every SSE tick (query invalidation scoped).
- **Race conditions in UI:** disable submit while a verification is `RUNNING`; use per-attempt Idempotency-Key; optimistic updates **not** used for money states.
- **Network failures:** every mutation shows inline errors with `request_id`; retries only on idempotent GETs; SSE reconnect logic.
- **CSP:** AG Grid needs inline styles (`style-src 'unsafe-inline'` configured in Phase 3); verify no CSP console errors.
- **Performance:** route-level code splitting; AG Grid only on the ledger route; images none; Lighthouse performance ≥ 80 on desktop for landing and timeline.
- **Observability:** `console.error` forwarded to `POST /api/v1/client-log` is **out of scope**; rely on Render logs + `request_id` display.

## Definition of done
- [ ] On `npm run dev` with the worker running, a human can complete the full journey in the browser (compile → fix → propose → accept → fund via real sandbox → submit m1/m2 → released) without touching curl.
- [ ] 360 px and 1440 px screenshots of S0, S1, S4, S5, S6 reviewed; no horizontal page scroll except inside the ledger grid.
- [ ] axe: zero serious/critical violations on the five pages; keyboard-only run of Studio → Fund passes (documented in `docs/a11y-check.md`).
- [ ] FundsBar updates within 3 s of a capture (SSE) and within 6 s if SSE is blocked (polling fallback verified by disabling `EventSource` in a test).
- [ ] Evidence highlighting scrolls to and marks the verified quote for a seeded failing report; escalation view shows the countdown to `auto_release_at`.
- [ ] Light and dark modes both readable (contrast checked with axe); AG Grid themed in both.
- [ ] All named unit/E2E tests pass in CI (`npm run test:unit`, `npm run test:e2e` against the test server with stubbed PayPal).
- [ ] Production build contains no MSW mock code (grep for `mocks/handlers` in `.next` output).

## Risks & blockers
| Risk | Mitigation |
|---|---|
| UI scope exceeds time | Build order: S4 → S5 → S1 → S3 → S6 → S0 → S8; ship "Edit JSON" last |
| Backend endpoints late | MSW mocks keep UI work unblocked; weekly API contract check against `api-spec.md` |
| AG Grid theming/CSP surprises | Spike AG Grid on Nov 5; fall back to a plain table for the first demo if needed (ledger drawer still works) |
| SSE flakiness through Render proxy | Polling fallback is always on; heartbeat every 15 s |
| Looks like the PayPal+AG Grid starter | Use custom tokens, Funds Bar, evidence highlight; review with a non-team member on Nov 8 |

## Time budget
**7 person-days** (C 5.5, A 1.0 SSE + ledger + Proof Pack routes, B 0.5 fixtures/report review). **Cut first if long:** API keys page UI, "Edit JSON" editor, dark-mode polish of AG Grid, Proof Pack PDF button, `explain.ts` rich sentences (use raw types). **Do not cut:** FundsBar, Timeline, Verification Report with highlight, Studio lint-fix, Ledger grid.

## Handoff
Next phases can assume: all core screens exist and run on the real API; `useContractEvents` live updates work; Judge Mode panel exists with scenario buttons wired to a not-yet-implemented `runScenario` (Phase 7); Agent Console route placeholder; Ledger, ledger-verify and Proof Pack (JSON, `[S]` PDF) routes exist (built in task 6.2).
**Tag:** `git tag phase-6-frontend && git push --tags`
