# ProofPay Policy-as-Code

> **Purpose:** Explicit, deterministic mapping of ProofPay's settlement policy rules.  
> **Source of Truth:** [`src/server/verify/policy.ts`](file:///c:/Users/ramku/PROJECTS/HACKS/Paypal-ai-hack/ProofPay/src/server/verify/policy.ts)

---

## 1. The Decision Hierarchy

In ProofPay, settlement decisions are evaluated through a strict cascade of prioritized rules. An earlier rule match immediately halts evaluation.

```
                    ┌─────────────────────────┐
                    │   Deliverable Ingest    │
                    └────────────┬────────────┘
                                 │
                     [Rule 1: Pre-Flight Failure?]
                                 ├── Yes ──> REJECT (Zero Penalty)
                                 │
                     [Rule 2: Adversarial Injection?]
                                 ├── Yes ──> REJECT (Adversarial Alert)
                                 │
                     [Rule 3: Deterministic Test Failure?]
                                 ├── Yes ──> REJECT (Counterfactual Fix Hint)
                                 │
                     [Rule 4: Rubric Ambiguity?]
                                 ├── Yes ──> ESCALATE (Human Review Window)
                                 │
                                 └── All Passed ──> PASS (Instant Capture)
```

---

## 2. Rule Specification Matrix

| Rule Priority | Rule Name | Condition | Action / Result | Financial Impact |
| :---: | :--- | :--- | :--- | :--- |
| **P1** | `PREFLIGHT_FAIL` | File corrupted, MIME mismatch, or zero bytes | `REJECT` | 0 revision penalty deducted; seller prompted to re-upload. |
| **P2** | `ADVERSARIAL_INJECTION` | Heuristic pattern matched or high severity prompt injection | `REJECT` + `FLAG_ANOMALY` | Auto-release timers frozen; requires manual admin review. |
| **P3** | `JUNK_DATA_DETECTED` | Placeholder ratio > 25%, duplicate ratio > 75%, or low entropy | `REJECT` | Revision consumed; fix hints list offending rows. |
| **P4** | `CRITERIA_TEST_FAILED` | Any deterministic unit test, regex, or schema check fails | `REJECT` | Revision consumed; counterfactual delta generated. |
| **P5** | `MAX_REVISIONS_EXCEEDED`| Rejection count > `max_revisions` | `FAILED_FINAL` | Milestone canceled; PayPal hold voided/returned to buyer. |
| **P6** | `AMBIGUOUS_EVIDENCE` | Rubric score between borderline bounds (0.40 - 0.70) | `ESCALATE` | 72-hour buyer review timer initiated; reminders at 50% & 90%. |
| **P7** | `ALL_CRITERIA_PASSED` | 100% deterministic checks pass and no manipulation flags | `PASS` | Instant PayPal partial capture executed. |

---

## 3. Invariants That Never Yield

1. **AI Never Overrides Failed Code:** If a single deterministic check fails, an LLM score of 100% cannot trigger a pass.
2. **Zero Custody:** ProofPay never moves funds into intermediate platform accounts.
3. **Double-Spend Protection:** Idempotency keys bound to contract and funding attempt (`pp:{contract}:fund:{attempt}`) prevent replay captures.

