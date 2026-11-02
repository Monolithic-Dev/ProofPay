# ProofPay Architecture & Decision Log

| Date | Decision | Owner | Reason |
|---|---|---|---|
| 2026-11-02 | Branching model: `development` as default branch; linear rebase & merge | Team | Enforce clean, linear git history without merge commit clutter |
| 2026-11-02 | Gate 1 Decision: GATE PASS on PayPal Authorization + Partial Capture | Owner A / D | PayPal v2 Payments API supports `AUTHORIZE`, multi-capture with `final_capture: false`, and `void` |
| 2026-11-02 | Database schema: Drizzle ORM on PostgreSQL with hash-chained ledger | Owner A | Tamper-evident ledger required for proof pack export; ACID transactions for state changes |
| 2026-11-02 | Verifier pipeline: 4-stage (deterministic, rubric LLM, adversarial, policy) | Owner B | Deterministic code decides; LLM provides evidence; eliminates hallucinated decisions |
| 2026-11-02 | Render deployment skeleton configured with web & worker roles | Owner D | Separation of web HTTP handlers and async background verification worker |
