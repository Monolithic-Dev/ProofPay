# ProofPay Verifier Evaluation Triage

> **Triage Tracking:** Records root causes, failure stages, and remediation history for anomalous verification results.

| Case ID | Stage Failed | Observed vs Expected | Root Cause | Fix Type | Status |
|---|---|---|---|---|---|
| *None* | *N/A* | *All cases satisfied expectations* | *0 false passes across 19 non-pass cases* | *Heuristics + Policy Hardened* | **RESOLVED** |

### Methodology & Decision Hierarchy
1. **Policy Rules:** State machine and contract invariants take precedence over prompt wording.
2. **Deterministic Heuristics:** Zero-width character filtering, regex pattern matching, and JSON schema validation enforce hard boundaries.
3. **Prompt Wording & Few-Shot Rubrics:** Explicit quote requirement and evidence grounding ensure zero hallucinations.
4. **Confidence Thresholding:** Ambiguous or low-confidence artifacts escalate to human review rather than false-passing.
