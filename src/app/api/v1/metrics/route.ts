/**
 * Prometheus Metrics Scrape Endpoint — GET /api/v1/metrics
 * Exposes real-time system, verification, and payment telemetry in standard Prometheus text format.
 */
import { NextResponse } from 'next/server'
import { metrics } from '@/server/telemetry/metrics'
import { getBudgetStatus } from '@/server/ai/llm'
import { kvGet } from '@/server/db/repos/kv.repo'

export async function GET() {
  try {
    // Collect dynamic gauges prior to scraping
    try {
      const budget = await getBudgetStatus()
      metrics.setGauge('proofpay_llm_budget_spent_usd', budget.spent_usd)
    } catch {
      // budget unavailable in local dev / without db
    }

    try {
      const hb = await kvGet<{ timestamp: string }>('worker:heartbeat')
      if (hb?.timestamp) {
        const lag = Math.max(0, Math.floor((Date.now() - new Date(hb.timestamp).getTime()) / 1000))
        metrics.setGauge('proofpay_worker_lag_seconds', lag)
      }
    } catch {
      // worker heartbeat unavailable
    }

    const payload = metrics.export()

    return new NextResponse(payload, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    return new NextResponse(
      `# Error scraping Prometheus metrics: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
      {
        status: 500,
        headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
      }
    )
  }
}
