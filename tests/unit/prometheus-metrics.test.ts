import { describe, it, expect, beforeEach } from 'vitest'
import { metrics } from '@/server/telemetry/metrics'

describe('Prometheus Metrics Registry (src/server/telemetry/metrics.ts)', () => {
  beforeEach(() => {
    metrics.reset()
  })

  it('registers and increments counters with and without labels', () => {
    metrics.registerCounter('test_counter_total', 'A test counter')
    metrics.incCounter('test_counter_total', 1)
    metrics.incCounter('test_counter_total', 5, { status: 'success', method: 'capture' })

    const output = metrics.export()
    expect(output).toContain('# HELP test_counter_total A test counter')
    expect(output).toContain('# TYPE test_counter_total counter')
    expect(output).toContain('test_counter_total 1')
    expect(output).toContain('test_counter_total{status="success",method="capture"} 5')
  })

  it('registers and updates gauges', () => {
    metrics.registerGauge('test_gauge_active', 'Active items')
    metrics.setGauge('test_gauge_active', 42)
    metrics.setGauge('test_gauge_active', 12, { environment: 'production' })

    const output = metrics.export()
    expect(output).toContain('# HELP test_gauge_active Active items')
    expect(output).toContain('# TYPE test_gauge_active gauge')
    expect(output).toContain('test_gauge_active 42')
    expect(output).toContain('test_gauge_active{environment="production"} 12')
  })

  it('observes histogram distributions and generates bucket counts', () => {
    metrics.registerHistogram('test_latency_seconds', 'Latency histogram', [0.1, 0.5, 1.0])
    metrics.observeHistogram('test_latency_seconds', 0.05)
    metrics.observeHistogram('test_latency_seconds', 0.3)
    metrics.observeHistogram('test_latency_seconds', 1.2)

    const output = metrics.export()
    expect(output).toContain('# HELP test_latency_seconds Latency histogram')
    expect(output).toContain('# TYPE test_latency_seconds histogram')
    expect(output).toContain('test_latency_seconds_bucket{le="0.1"} 1')
    expect(output).toContain('test_latency_seconds_bucket{le="0.5"} 2')
    expect(output).toContain('test_latency_seconds_bucket{le="1"} 2')
    expect(output).toContain('test_latency_seconds_bucket{le="+Inf"} 3')
    expect(output).toContain('test_latency_seconds_count 3')
  })

  it('formats metric lines cleanly following Prometheus exposition specification', () => {
    metrics.registerCounter('proofpay_verifications_total', 'Verification count')
    metrics.incCounter('proofpay_verifications_total', 10, { verdict: 'verified' })
    const output = metrics.export()
    expect(output.endsWith('\n')).toBe(true)
    expect(output).toMatch(/^# HELP proofpay_verifications_total/m)
    expect(output).toMatch(/^proofpay_verifications_total\{verdict="verified"\} 10$/m)
  })
})
