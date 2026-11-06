# Held-Out Evaluation Set

> **Freezing Date:** Pre-tuning baseline
> **Constraint (C-9):** Held-out cases must NEVER be used to tune prompt wording, weights, or thresholds.
> Prompts and policies are tuned strictly on the Dev Set cases.
> The Held-Out cases are evaluated separately and reported with honest statistics and Wilson 95% confidence intervals.

## Hash-Based Frozen Split Rule (AIP-14)
All cases are partitioned deterministically by SHA-256 hash:
```typescript
isHeldOut = (sha256(id) mod 10) < 3 // ~30% held-out
```

## Suite Overview (120 Cases)
- **Total Cases:** 120
- **Group P (Compliant):** 30 cases (P01 – P30) -> Expected `PASS`
- **Group F (Deterministic / Schema / Junk Failures):** 30 cases (F01 – F30) -> Expected `REJECT` (F10 optional criterion warning)
- **Group A (Adversarial Injections across 12 families):** 60 cases (A01 – A60) -> Expected `REJECT` or `ESCALATE`

## Held-Out Partition (~30%)
Cases meeting `(sha256(id) mod 10) < 3` are strictly segregated from prompt tuning and benchmarked independently to ensure unbiased generalization metrics.
