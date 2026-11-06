# ProofPay Verification Benchmark (`proofpay-bench`)

The public benchmark dataset for evaluating automated payment verification, AI rubric compliance, and adversarial prompt injection defenses.

## Scope & Dataset

`proofpay-bench.jsonl` contains 120 synthetic cases:
- **30 Group P Cases:** Compliant artifacts expected to satisfy all contract criteria and achieve `PASS`.
- **30 Group F Cases:** Defective artifacts expected to fail deterministic checks, schema constraints, or junk checks and achieve `REJECT`.
- **60 Group A Cases:** Adversarial prompt injection attacks across 12 families designed to induce false passes. Expected to achieve `REJECT` or `ESCALATE`.

## Frozen Split
Cases are split into Dev (70%) and Held-Out (30%) deterministically using:
```typescript
isHeldOut = (sha256(id) mod 10) < 3
```

## How to Score

To score the benchmark against the verifier pipeline:
```bash
npx tsx scripts/score-bench.ts
```

## Metrics
- **False Pass Rate on Non-Pass Cases:** Headline metric. Must be 0%. Reported with Wilson 95% Confidence Interval and Rule of Three bound.
- **False Rejection Rate on Valid Cases:** Must be ≤ 10%.
- **Verified Quote Rate:** 100% of LLM reasoning quotes verified against source text.
- **Latency p95:** Verification latency under 20 seconds.

## License
Apache-2.0. Contains synthetic data only; zero real PII.

