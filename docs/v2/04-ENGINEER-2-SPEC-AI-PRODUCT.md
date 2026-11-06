# 04 — Engineer 2 Spec: AI Assurance & Product (`AIP-*`)

> **Owner:** Engineer 2 (`@eng2`) · **Reviewer:** Engineer 1 · **Window:** Tue Nov 3 → Mon Nov 9 (freeze 23:59 IST) · **Capacity:** ~49 h incl. review overhead · **Planned:** Must 46 h, Could (backlog).
> **Read first:** `PROOFPAY-FULL-AUDIT-AND-IMPROVEMENTS.md` (finding IDs in brackets) and `02-ISSUE-BOARD-AND-ASSIGNMENT.md`.
> **Hard rules:** the AI never gains authority; do not change `src/server/release/**`, `src/server/paypal/**`, or the decision rules in `policy.ts` except where a ticket says so (AIP-12 touches auto-release **eligibility**, reviewed by E1 + PO). New queries must use `withTx` (RLS-ready).
> **Coding-agent kickoff prompt (per ticket):** "Implement ticket `<ID>` from `docs/sprint/04-ENGINEER-2-SPEC-AI-PRODUCT.md`. Write the named tests first, follow `.claude/skills/{senior-prompt-engineer,ai-security,senior-frontend,senior-backend}`, keep PRs ≤ 400 lines, run `npm run eval -- --set dev` if you touched prompts or verification, and run `scripts/self-audit.sh` before the PR."

## Order of work
Nov 3 AIP-1 → Nov 4 AIP-2, AIP-3 → Nov 5 AIP-3, AIP-10 → Nov 6 AIP-11 (+pairing) → Nov 7 AIP-12, AIP-14 (part 1) → Nov 8 AIP-14 (part 2), AIP-13, AIP-6 (start) → Nov 9 AIP-6, AIP-14 (final run), AIP-5-lite, regression, freeze.

---

### AIP-1 — Eval evidence gate & prompt registry
**Type:** feature · **Priority:** Must · **Estimate:** 6 h · **Labels:** type:feature, area:ai, area:ci, priority:must, risk:low · **Audit:** A-8, A-10 (prompt registry)

**Context.** Prompt, model or verification-logic changes can silently change safety. Today nothing forces fresh evidence.
**Goal.** CI fails when verification-relevant code changes without matching, passing eval evidence.

**Design.**
- `scripts/prompt-registry.ts --write` computes SHA-256 of each prompt file (`compile`, `lint`, `rubric`, `adversarial`) plus `policy.ts` and the heuristics file, writing `docs/ai/prompt-registry.json` (`[{ id, version, file, sha256 }]`). A unit test asserts the committed registry equals the computed one.
- `npm run eval -- --write-evidence` writes **front matter** at the top of `docs/eval-results.md`: `generated_at, git_sha, models[], sets[], prompt_hashes{}, metrics{ false_passes_non_pass, non_pass_cases, false_rejects, escalation_rate, p95_latency_ms, mean_cost_usd }`.
- `scripts/check-eval-evidence.ts`: loads the front matter; recomputes current hashes; **fails** if (a) any hash differs, (b) `generated_at` older than 14 days, (c) `metrics.false_passes_non_pass > 0` without a matching entry in `docs/ai/exceptions.md` (id, reason, owner, due date).
- CI job **`eval-evidence`** runs when files under `src/server/ai/prompts/**`, `src/server/verify/**` or `src/server/ai/llm.ts` change, and nightly. A fast **`eval:fast`** (FakeLLM, deterministic cases only) runs on every PR.
**Acceptance criteria.** Changing one character in `rubric.v*.ts` without re-running eval fails `eval-evidence`; re-running eval and committing fresh evidence passes; an unexplained false pass fails.
**Tests.** `registry matches computed hashes`, `checker fails on hash mismatch`, `checker fails on stale evidence`, `checker fails on unexplained false pass`, `checker accepts documented exception`, `front matter parser handles missing fields`.
**Security/Privacy.** Evidence contains no deliverable text.
**Rollout.** Add job as informational Nov 3, required from Nov 5. **Rollback.** Remove from required checks.
**Dependencies.** PLAT-2 (CI naming). **DoD.** `02` §2.2.

---

### AIP-2 — Fix hints (counterfactual guidance)
**Type:** feature · **Priority:** Must · **Estimate:** 4 h · **Labels:** type:feature, area:ai, area:product, priority:must, risk:low · **Audit:** U-7

**Goal.** Every rejection tells the seller the *minimal* change that would satisfy each failed criterion.
**Design.**
- Type in `src/shared/verification.ts`: `FixHint = { criterion_key: string; kind: 'add_rows'|'fix_field'|'dedupe'|'shorten'|'lengthen'|'add_keyword'|'format'|'remove_placeholder'|'other'; message: string; params?: Record<string, number|string>; locations?: { row?: number; field?: string; path?: string }[] }`.
- Each deterministic check returns `hints`: `row_count` → "Add 3 rows (22 → 25)"; `unique_field` → "Change `sku` in rows 17 and 3 (duplicate 'ELE-1042')"; `regex_field` → "Fix `contact_email` in row 22 (expected email format)"; `word_count` → "Shorten by 24 words (224 → ≤ 200)" / "Add 27 words (123 → ≥ 150)"; `required_keywords` → "Include: Fitness"; `json_schema` → "`price_usd` in row 5 must be a positive number"; `junk_free` (AIP-11) → "Replace placeholders in rows 4, 9".
- Rubric failures: hint = the criterion statement + the verified evidence of the gap (never LLM-invented advice).
- `VerificationView.fix_hints[]` sorted by severity then location; UI `FixList` with row jump links and "Copy all" (plain text); API docs/OpenAPI updated.
**Acceptance criteria.** Given a 22-row dataset with one bad email and a 224-word summary, the report lists exactly the three corresponding hints with correct numbers; hints disappear once fixed.
**Tests.** One test per check (boundary values), `hints stable ordering`, `rubric hint includes verified quote`, `UI renders and copies`, snapshot of the API shape.
**Security.** Hints never echo more than 200 chars of seller content; HTML-escaped in UI.
**Dependencies.** None. Used by AIP-3 UI.

---

### AIP-3 — AI transparency UI
**Type:** feature · **Priority:** Must · **Estimate:** 4 h · **Labels:** type:feature, area:product, area:ai, priority:must, risk:low

**Goal.** Make clear what is a rule and what is AI-assisted, and how much the AI matters.
**Design.**
- `CriterionBadge` ("Rule" / "AI-assisted") on every criterion row (contract editor, invite preview, report).
- `AIRelianceMeter`: `reliance = required rubric criteria / required criteria`; bands Low (< 20%), Medium (20–50%), High (> 50%) with copy "Higher reliance means more cases may need human review"; shown in the editor header, invitation preview and contract summary.
- Report footer **"How this was decided"**: checks run (names), model(s) and provider, prompt version, tokens, cost (USD, from `llm_calls`), latency, cache hit, redaction counts (if PII shield exists), and the line "A rule engine makes the final decision; the AI supplies evidence only."
- Component tests + axe.
**Acceptance criteria.** A contract with 4 deterministic + 1 rubric required criteria shows reliance 20% (Medium boundary rule documented); the footer data matches the verification row.
**Tests.** `reliance calc table`, `badge maps check types`, `footer shows cost and prompt version`, `a11y: badges have text`, `no AI wording implies authority` (copy test).
**Dependencies.** AIP-2 (FixList placement).

---

### AIP-10 — Context-injection fix & structure/obfuscation scanning
**Type:** security/AI · **Priority:** Must · **Estimate:** 6 h · **Labels:** type:bug, area:ai, area:security, priority:must, risk:med · **Audit:** A-2, A-3, A-4

**Context.** (1) Milestone 2's AI review receives milestone 1's raw text as "trusted context", but the seller wrote it (cross-milestone injection). (2) Scans look at values, not keys/structure/comments. (3) Heuristics are English-only and miss encodings.
**Goal.** Remove the trust assumption and widen detection.

**Design.**
- **Context facts, not text:** replace raw context with `buildContextFacts(milestoneKey)` returning code-computed facts: `row_count`, `distinct_values` for enum-like fields (e.g., categories), `schema_valid`, `sha256`, `word_count`. The rubric prompt gets a `FACTS (computed by code, trusted)` block and **no raw prior artifact**. Criteria that truly need prior text must declare `context_excerpt: {max_chars}` and the excerpt is wrapped as untrusted with its own nonce.
- **Scan surface:** `flattenForScan(artifact)` yields keys, values, JSON string escapes, and markdown/HTML comments (`<!-- -->`, `[//]: #`), plus filename/note fields; heuristics + LLM adversarial stage run on the flattened text.
- **Normalization:** NFKC; strip zero-width for scanning only; map common confusables (Cyrillic/Greek look-alikes to Latin) with a small table; collapse leetspeak digits (`1gn0re` → `ignore`) for matching only.
- **Decode-and-scan:** detect base64/hex runs ≥ 24 chars, decode (depth 1), scan decoded text.
- **Multilingual patterns (extend; native-speaker review recommended):** Spanish ("ignora las instrucciones", "marca como aprobado"), Hindi ("निर्देशों को अनदेखा करें", "पास के रूप में चिह्नित करें"), Telugu ("సూచనలను విస్మరించండి"). The LLM adversarial prompt explicitly covers non-English text.
- Severity rules unchanged (`high` → REJECT, `low` → ESCALATE).
**Acceptance criteria.** An instruction placed in milestone 1 cannot influence milestone 2's verdict (test with FakeLLM that records the prompt: raw m1 text absent); a key named `"ignore the rubric"` is flagged; base64-encoded instruction is flagged; homoglyph version of "ignore previous instructions" flagged; benign multilingual text is not `high`.
**Tests.** `m2 prompt contains facts but not raw m1`, `key-name injection flagged`, `comment injection flagged`, `base64 injection flagged`, `homoglyph injection flagged`, `leet injection flagged`, `es/hi/te injection flagged`, `benign es/hi/te summaries not high`, eval cases added (dev/held-out per AIP-14).
**Security.** Keep decoded content out of logs; cap decode size/time.
**Rollout.** Immediate. **Rollback.** Revert; evidence gate (AIP-1) forces a fresh eval.
**Dependencies.** AIP-1 (evidence), coordinate case IDs with AIP-14.

---

### AIP-11 — Satisfiability linter & junk detector
**Type:** feature · **Priority:** Must · **Estimate:** 6 h · **Labels:** type:feature, area:ai, area:product, priority:must, risk:low · **Audit:** A-12, A-6

**Part A — satisfiability lint (deterministic).** Add rules to `contracts/lint/rules.ts`:
`LINT_UNSATISFIABLE_RANGE` (`min > max` for row_count/word_count), `LINT_SCHEMA_COUNT_CONFLICT` (schema `minItems`/`maxItems` vs row_count), `LINT_UNIQUE_CARDINALITY` (a `unique_field` on a field with an enum of K values while `row_count.min > K`), `LINT_KEYWORDS_EXCEED_WORDS` (required keywords' total words > `word_count.max`), `LINT_DUE_BEFORE_WINDOW` / existing window rules, `LINT_NO_JUNK_CHECK` (warn when a dataset/text milestone has no `junk_free`). Severity `error` where no valid artifact can exist.
**Part B — `junk_free` deterministic check.**
- Registry entry `junk_free` with spec `{ max_placeholder_ratio?: 0.02, max_duplicate_ratio?: 0.1, min_entropy_bits?: 2.0 }`.
- Placeholder tokens (case-insensitive, whole-word): `lorem`, `ipsum`, `tbd`, `todo`, `n/a`, `na`, `null`, `undefined`, `foo`, `bar`, `baz`, `test`, `asdf`, `xxx`, `sample`, `placeholder`.
- `duplicate_ratio` = duplicate rows (or sentences for text) / total; `entropy` = Shannon entropy per field/text (bits per char) with a sane floor; repetition ratio of the top n-gram.
- Wired into `deterministic/registry.ts`, Zod contract schema, lint, templates (`dataset-summary` and `content-batch` include it as required), and AIP-2 hints.
**Acceptance criteria.** A contract with `row_count.min=25` and `unique_field: category` (5-value enum) is rejected at lint; 25 schema-valid rows of "TBD" fail `junk_free`; a legitimate dataset passes; hints name the offending rows.
**Tests.** `lint rule table (8 unsatisfiable cases + 8 satisfiable controls)`, `junk_free: placeholders, duplicates, low entropy, clean`, `thresholds boundary`, `template includes junk_free`, `eval cases JUNK-01..06`.
**Dependencies.** AIP-2 (hints).

---

### AIP-12 — Auto-release eligibility (anti-farming)
**Type:** security/logic · **Priority:** Must · **Estimate:** 3 h · **Labels:** type:bug, area:security, area:ai, priority:must, risk:med · **Reviewers:** E1 **and PO** · **Audit:** M-10

**Context.** Today a seller can submit content that makes the verifier abstain ("cannot verify") and rely on a silent buyer to auto-release funds.
**Goal.** Auto-release only where silence legitimately means consent.

**Rule (implemented in the `AUTO_RELEASE` handler; no change to `release/service.ts`).** A milestone in `ESCALATED` is **auto-release eligible** iff **all** hold: (1) every required deterministic criterion passed; (2) manipulation severity = `none`; (3) escalation reasons ⊆ `{HUMAN_SIGNOFF_REQUIRED}` (the buyer chose a human-sign-off criterion); (4) at least two reminders were *delivered* (email `SENT` + in-app) at ≥ 50% and ≥ 90% of the window; (5) the window elapsed (`scaledMs` rules intact). Otherwise at expiry: **do not release**; set `milestones.support_review_at`, notify buyer-side approvers and staff, extend the window once by 50%, and append ledger `AUTO_RELEASE_BLOCKED {reasons}`.
**Design.** Additive migration `milestones.support_review_at timestamptz`, `milestones.reminder_50_sent_at`, `reminder_90_sent_at`; reminders created by the worker (`NOTIFY_DEADLINES` precursor) and recorded; UI shows the rule in plain language on the contract before acceptance ("Auto-release applies only if you set a human sign-off criterion and nothing else needs review") and a timeline of reminders.
**Acceptance criteria.** Farming test: rubric criterion + ambiguous artifact + silent buyer → **no release** and a support-review flag; human-sign-off-only milestone with delivered reminders → releases after the window; missing reminder delivery → no release.
**Tests.** `farming scenario never releases`, `human signoff only releases after reminders`, `reminders required (outbox SENT)`, `blocked path writes ledger and notifies`, `window extended once`, `DEMO_TIME_SCALE respected but guarded`, scenario `silent_buyer_autorelease` updated and green.
**Security.** Decision uses stored verification reasons, not live LLM output.
**Rollout.** Immediate; update copy in contract summary and Terms draft. **Rollback.** Revert handler change (keep columns).
**Dependencies.** Existing notification/email outbox.

---

### AIP-13 — Express judge lane (pre-authorized demo pool)
**Type:** feature · **Priority:** Must · **Estimate:** 4 h · **Labels:** type:feature, area:product, priority:must, risk:low · **Audit:** H-1, U-2 · **With:** PO operations

**Goal.** A judge reaches a verified release in ≤ 90 seconds without logging into PayPal, while the full engine runs for real.
**Design.**
- Table `demo_pool(id, contract_id, status AVAILABLE|IN_USE|CONSUMED, authorization_expires_at, created_at, claimed_by)` (Demo Workspace only).
- Staff script `npm run demo:pool:create -- --count 8`: creates demo contracts via the API and prints PayPal approval URLs; the **team approves them** with the sandbox buyer; when a contract becomes `FUNDED` the script marks it `AVAILABLE`. Weekly refill dates in the PO calendar (Nov 12, 20, Dec 1, 8, 14).
- `/demo/express`: shows pool size and **"pre-authorized by the team for demo; real PayPal sandbox capture"**; **Start** claims one with `FOR UPDATE SKIP LOCKED` and launches scenario `express_happy_path` (reject → fix → pass → capture) on the claimed contract. Entries with `authorization_expires_at < now + 3 days` are hidden; if none available, show the normal path and the recorded video.
- RLS/permissions: pool contracts belong to the Demo Workspace; capture amounts small ($10 total).
**Acceptance criteria.** Two concurrent starts never claim the same contract; an expired authorization is never offered; the lane completes with a real sandbox capture and a valid ledger chain; honest labeling is visible.
**Tests.** `claim is atomic (50 concurrent)`, `expired excluded`, `empty pool fallback`, `scenario completes (MSW)`, `label visible`, `script marks AVAILABLE only when FUNDED`.
**Operations.** Runbook entry; PO owns weekly refills.

---

### AIP-14 — Expand evaluation to 120+ cases, external red team, public benchmark
**Type:** feature/QA · **Priority:** Must · **Estimate:** 6 h (+ PO recruits red-teamers) · **Labels:** type:feature, area:ai, priority:must, risk:low · **Audit:** A-1

**Goal.** Replace "30 cases the team wrote" with a larger, mutation-generated, externally attacked set and honest statistics.
**Design.**
- `tests/eval/generate.ts` (seeded) produces **120 cases**: P (30 should pass), F (30 should reject: boundary and schema failures, junk, duplicates), A (60 adversarial = 12 families × 5): direct override, fake system note, zero-width, homoglyph/leet, base64/hex, multilingual (es/hi/te), fake JSON role, keyword dump, quote forgery, **context injection (m1→m2)**, key-name injection, markdown/HTML comment, long-context burial.
- **Split frozen by hash:** `heldout = sha256(id) mod 10 < 3` (≈ 30%); record in `tests/eval/HELDOUT.md` before tuning; held-out is run once per milestone.
- **External attacks:** `bench/submissions/*.json` (schema: `{author, family, milestone, artifact, goal: "get PASS"}`); `scripts/run-external-attacks.ts` runs them and appends results to `docs/eval-results.md` (counts by author, no names without consent). PO recruits ≥ 3 outsiders (instructions in `bench/CONTRIBUTING.md`).
- **Statistics:** `wilson(k, n)` 95% interval (and rule of three for k=0) printed per set and provider.
- **Public benchmark:** `bench/proofpay-bench.jsonl` (labeled cases without secrets), `bench/README.md` (scope, license, how to score), `scripts/score-bench.ts`.
- Per-provider tables when two providers are configured (A-9).
**Acceptance criteria.** `npm run eval -- --set all` runs 120 cases; results show dev, held-out and external separately with intervals; any false pass on a non-pass case blocks the evidence gate unless documented.
**Tests.** `generator is deterministic`, `heldout split stable`, `wilson interval matches reference values`, `external runner rejects malformed submissions`, `score-bench reproduces published metrics`.
**Security.** Bench contains synthetic data only; no real PII.
**Dependencies.** AIP-1 (evidence), AIP-10/11 (cases for new defenses).

---

### AIP-5 (lite) — Nightly canary
**Type:** feature · **Priority:** Must-lite · **Estimate:** 2 h · **Labels:** type:feature, area:ai, priority:must, risk:low · **Audit:** A-8

**Design.** `tests/canary/cases.json` (12 fixed cases with expected decisions), `npm run canary` and job `CANARY_VERIFY` (nightly 02:00 UTC via the scheduler) run them against the live provider(s) with temperature 0; store in `canary_runs(id, started_at, finished_at, provider, model, cases, passed, details)`; `/health.llm.last_canary = { at, passed, total }`; notify staff on any mismatch; show last result on `/trust` and `/status`.
**Acceptance.** Manual run prints pass/fail per case and records a row; a deliberately wrong expectation triggers a staff notification.
**Tests.** `canary stores run`, `mismatch notifies`, `health exposes last canary`, `budget cap respected`.

---

### AIP-6 — Security Center UI
**Type:** feature · **Priority:** Must · **Estimate:** 5 h · **Labels:** type:feature, area:product, area:security, priority:must, risk:low

**Design.** Page `/app/settings/security-center` (Owner/Admin/Finance/Viewer read): `PostureScoreCard` (score, trend placeholder), `RecommendationList` (severity chips, action links), `MfaAdoptionCard`, `ApiKeyHygieneCard`, `RiskEventsTable` (empty-state until PLAT-8), loading/empty/error/forbidden states; built against a **mock** of `SecurityPosture` from `src/shared/security.ts` until `PLAT-6` merges (switch by env/flag); axe clean; screenshot for Trust Center.
**Acceptance criteria.** Seeded org with an unenrolled Owner and an old key shows two high recommendations linking to the right pages; Member sees 403 page.
**Tests.** `renders mock posture`, `recommendations link targets exist`, `403 for member`, `empty and error states`, `axe`.
**Dependencies.** PLAT-6 contract (Nov 6 pairing).

---

## Could (backlog)

- **AIP-4 — Calibrated confidence & abstention (6 h):** `scripts/calibration.ts` bins verifier confidence vs correctness from eval outputs; publish `docs/ai/calibration.md`; tune `verifier_confidence_min` from data; Trust Center table.
- **AIP-5b — Provider circuit breaker (4 h):** states closed/open/half-open on error rate > 30% over 5 min or canary failure → degraded mode (ESCALATE); `/health.llm.breaker`.
- **AIP-7 — Receipts PDF (3 h), AIP-8 — Calendar `.ics` (2 h), AIP-9 — SLA reminders + daily digest (4 h):** as specified in `01-NEW-FEATURES-SECURITY-AI-PRODUCT.md` (P1–P3).
- **PII Shield (4 h):** mask emails/phones/cards/IBAN/SSN-like/IPs before LLM calls; evidence quotes verified against masked text; counts in the report.
- **Consensus mode (4 h):** second provider must agree on required rubric criteria for milestones ≥ $50.

## Evidence you must leave behind
`docs/eval-results.md` (front matter + per-set tables with intervals) · `docs/ai/prompt-registry.json` · `bench/` dataset · canary rows and `/trust` section · screenshots: AI badges, fix list, Security Center · scenario recording of the express lane.
