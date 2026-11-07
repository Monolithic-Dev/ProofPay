# OpenTelemetry Distributed Tracing

> **Enterprise Pillar 2 & 4 — Operational Resilience & Observability**

## Overview

ProofPay includes native **OpenTelemetry-compatible distributed tracing** with full **W3C Trace Context** propagation (`traceparent`).

This enables enterprise DevOps and site reliability engineers to trace end-to-end request latency and errors across:
1. **Next.js API Routes** (client HTTP request ingress)
2. **PayPal SDK Calls** (payment authorizations, captures, disputes, webhooks)
3. **AI Verifier Pipelines** (rubric evaluation, adversarial detection, deterministic checks)
4. **Ledger & Settlement Events** (attestation signatures, Merkle checkpoints)

## W3C Traceparent Header Format

```
version - trace_id (32 hex) - parent_span_id (16 hex) - trace_flags (2 hex)
00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

## Usage

```typescript
import { defaultTracer, Tracer } from '@/server/telemetry/tracer'

// 1. Extract context from incoming request headers
const parentContext = Tracer.parseTraceparent(req.headers.get('traceparent'))

// 2. Wrap operations with distributed spans
const captureResult = await defaultTracer.withSpan(
  'paypal.capture_payment',
  parentContext,
  async (span) => {
    span.attributes['paypal.order_id'] = orderId
    return await executeCapture(orderId)
  },
  { 'contract.id': contractId }
)
```

