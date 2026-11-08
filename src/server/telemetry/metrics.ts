/**
 * ProofPay Prometheus Metrics Registry & Formatter
 * 
 * Implements enterprise OpenMetrics/Prometheus format exporter for:
 * - ProofPay transaction volumes, capture success/failure rates
 * - Milestone verification latency distributions (histograms)
 * - LLM token usage, cost expenditure ($ USD), and adversarial rejections
 * - Worker queue depth and lag
 * - System runtime uptime and heartbeat
 */

export interface MetricLabels {
  [key: string]: string | number | undefined
}

export interface MetricSample {
  name: string
  help: string
  type: 'counter' | 'gauge' | 'histogram'
  labels?: MetricLabels
  value: number
}

class PrometheusRegistry {
  private counters = new Map<string, { help: string; values: Map<string, number> }>()
  private gauges = new Map<string, { help: string; values: Map<string, number> }>()
  private histograms = new Map<
    string,
    {
      help: string
      buckets: number[]
      counts: Map<string, number[]>
      sums: Map<string, number>
      totals: Map<string, number>
    }
  >()

  private formatLabels(labels?: MetricLabels): string {
    if (!labels || Object.keys(labels).length === 0) return ''
    const entries = Object.entries(labels)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
    return entries.length > 0 ? `{${entries.join(',')}}` : ''
  }

  registerCounter(name: string, help: string): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, { help, values: new Map() })
    }
  }

  incCounter(name: string, value = 1, labels?: MetricLabels): void {
    const counter = this.counters.get(name)
    if (!counter) return
    const key = this.formatLabels(labels)
    const current = counter.values.get(key) ?? 0
    counter.values.set(key, current + value)
  }

  registerGauge(name: string, help: string): void {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, { help, values: new Map() })
    }
  }

  setGauge(name: string, value: number, labels?: MetricLabels): void {
    const gauge = this.gauges.get(name)
    if (!gauge) return
    const key = this.formatLabels(labels)
    gauge.values.set(key, value)
  }

  registerHistogram(name: string, help: string, buckets: number[] = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, {
        help,
        buckets: [...buckets].sort((a, b) => a - b),
        counts: new Map(),
        sums: new Map(),
        totals: new Map(),
      })
    }
  }

  observeHistogram(name: string, value: number, labels?: MetricLabels): void {
    const hist = this.histograms.get(name)
    if (!hist) return
    const key = this.formatLabels(labels)

    if (!hist.counts.has(key)) {
      hist.counts.set(key, new Array(hist.buckets.length).fill(0))
      hist.sums.set(key, 0)
      hist.totals.set(key, 0)
    }

    const counts = hist.counts.get(key)
    if (!counts) return

    for (let i = 0; i < hist.buckets.length; i++) {
      const bucketVal = hist.buckets[i]
      if (bucketVal !== undefined && value <= bucketVal) {
        counts[i] = (counts[i] ?? 0) + 1
      }
    }
    hist.sums.set(key, (hist.sums.get(key) ?? 0) + value)
    hist.totals.set(key, (hist.totals.get(key) ?? 0) + 1)
  }

  /**
   * Serializes all metrics to standard Prometheus text exposition format (version 0.0.4)
   */
  export(): string {
    const lines: string[] = []

    // Gauges
    for (const [name, gauge] of this.gauges.entries()) {
      lines.push(`# HELP ${name} ${gauge.help}`)
      lines.push(`# TYPE ${name} gauge`)
      if (gauge.values.size === 0) {
        lines.push(`${name} 0`)
      } else {
        for (const [labelStr, val] of gauge.values.entries()) {
          lines.push(`${name}${labelStr} ${val}`)
        }
      }
    }

    // Counters
    for (const [name, counter] of this.counters.entries()) {
      lines.push(`# HELP ${name} ${counter.help}`)
      lines.push(`# TYPE ${name} counter`)
      if (counter.values.size === 0) {
        lines.push(`${name} 0`)
      } else {
        for (const [labelStr, val] of counter.values.entries()) {
          lines.push(`${name}${labelStr} ${val}`)
        }
      }
    }

    // Histograms
    for (const [name, hist] of this.histograms.entries()) {
      lines.push(`# HELP ${name} ${hist.help}`)
      lines.push(`# TYPE ${name} histogram`)
      for (const [labelStr, counts] of hist.counts.entries()) {
        const cleanLabels = labelStr ? labelStr.slice(1, -1) : ''
        for (let i = 0; i < hist.buckets.length; i++) {
          const le = hist.buckets[i]
          const bucketLabels = cleanLabels ? `{${cleanLabels},le="${le}"}` : `{le="${le}"}`
          lines.push(`${name}_bucket${bucketLabels} ${counts[i]}`)
        }
        const infLabels = cleanLabels ? `{${cleanLabels},le="+Inf"}` : `{le="+Inf"}`
        lines.push(`${name}_bucket${infLabels} ${hist.totals.get(labelStr) ?? 0}`)
        const sumLabels = cleanLabels ? `{${cleanLabels}}` : ''
        lines.push(`${name}_sum${sumLabels} ${hist.sums.get(labelStr) ?? 0}`)
        lines.push(`${name}_count${sumLabels} ${hist.totals.get(labelStr) ?? 0}`)
      }
    }

    return lines.join('\n') + '\n'
  }

  reset(): void {
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
  }
}

// Global singleton instance for ProofPay application metrics
export const metrics = new PrometheusRegistry()

// Initialize default standard ProofPay metrics
metrics.registerCounter('proofpay_verifications_total', 'Total number of verification attempts processed')
metrics.registerCounter('proofpay_captures_total', 'Total number of PayPal payment captures initiated')
metrics.registerCounter('proofpay_adversarial_rejections_total', 'Total adversarial submissions detected and rejected')
metrics.registerGauge('proofpay_active_contracts', 'Current number of active funded escrow contracts')
metrics.registerGauge('proofpay_worker_lag_seconds', 'Lag in seconds of background verification worker')
metrics.registerGauge('proofpay_llm_budget_spent_usd', 'Cumulative LLM spend in USD')
metrics.registerHistogram(
  'proofpay_verification_duration_seconds',
  'Verification processing latency in seconds',
  [0.1, 0.5, 1, 2, 5, 10, 30]
)
