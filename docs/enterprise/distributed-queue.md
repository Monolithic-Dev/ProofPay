# Distributed Job Queue & Dead-Letter Queue (DLQ)

> **Enterprise Pillar 2 — Operational Resilience & Fault Tolerance**

## Overview

ProofPay uses an asynchronous **Distributed Job Queue** architecture with at-least-once delivery semantics for heavy background workflows:
1. **AI Milestone Verification** (`VERIFY_SUBMISSION`)
2. **PayPal Funds Capture & Milestone Release** (`RELEASE_MILESTONE`)
3. **Escalation Re-authentication & Expirations** (`AUTO_RELEASE`)
4. **PayPal Settlement Reconciliation** (`RECONCILE_PAYPAL`)
5. **Dispute Evidence Dossier Generation** (`DISPUTE_DOSSIER_GENERATE`)

## Architecture & Lifecycle

```
[ Producer / Route Handler ]
             |
             v
   [ Enqueue: add() ] (Idempotent Deduplication by jobId)
             |
             v
      ( waiting ) <--------- ( exponential retry )
             |                      |
             v                      |
      ( active ) ---> [ error ] ----+
             |                      |
    [ success ]                     v (exceeded max attempts)
             |             [ Dead-Letter Queue (DLQ) ]
             v                      |
    ( completed )           [ Alert / SRE Review ]
```

## Features

- **At-Least-Once Delivery**: No dropped tasks during transient network timeouts.
- **Exponential Backoff**: Automatic retry scheduling with customizable attempt counts.
- **Dead-Letter Queue (DLQ)**: Failed tasks after exhaustion of retries are preserved for human review and post-mortem analysis.
- **Idempotency**: Duplicate job submissions with identical `jobId` are deduplicated.
- **Pluggable Backend**: In-memory queue provider for tests and standalone mode; compatible with Redis/BullMQ.

