# Prometheus OpenMetrics Telemetry Engine

## Overview
ProofPay exposes enterprise-grade Prometheus/OpenMetrics telemetry directly via the `/api/v1/metrics` endpoint. This allows observability stacks like Prometheus, Datadog, Grafana Mimir, or Google Cloud Managed Service for Prometheus to pull real-time health, performance, security, and financial metrics without requiring invasive daemon processes.

## Exposed Metric Categories

1. **Transaction & Escrow Metrics**:
   - `proofpay_verifications_total{verdict="..."}`: Counter tracking verified vs rejected milestones.
   - `proofpay_captures_total{status="..."}`: Counter tracking PayPal captures and releases.
   - `proofpay_active_contracts`: Gauge monitoring total actively funded escrows.

2. **Latency & Distribution**:
   - `proofpay_verification_duration_seconds_bucket{le="..."}`: Multi-bucket histogram tracking AI consensus, rubric checks, and cryptographic witness signing latency.
   - `proofpay_worker_lag_seconds`: Gauge reporting asynchronous queue lag.

3. **Security & Financial Guardrails**:
   - `proofpay_adversarial_rejections_total`: Counter tracking prompt injection, payload tampered, and adversarial jailbreak attempts blocked by ProofPay.
   - `proofpay_llm_budget_spent_usd`: Cumulative LLM spend tracking to prevent cost overruns.

## Scrape Configuration Example (Prometheus `prometheus.yml`)

```yaml
scrape_configs:
  - job_name: 'proofpay'
    scrape_interval: 15s
    metrics_path: '/api/v1/metrics'
    static_configs:
      - targets: ['api.proofpay.io:443']
    scheme: https
```
