import React from 'react'

export interface VerificationFooterProps {
  checksRun: string[]
  models: string[]
  provider: string
  promptVersion: string
  tokensUsed: number
  costUSD: number
  latencyMs: number
  cacheHit?: boolean
  redactionCount?: number
  className?: string
}

export function VerificationFooter({
  checksRun,
  models,
  provider,
  promptVersion,
  tokensUsed,
  costUSD,
  latencyMs,
  cacheHit = false,
  redactionCount = 0,
  className = '',
}: VerificationFooterProps) {
  return (
    <div className={`mt-8 pt-6 border-t border-border text-xs text-muted space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-semibold text-text">How This Was Decided</h4>
        <span className="font-mono text-[11px] text-muted">Prompt: {promptVersion}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-surface-2 p-3 rounded-lg border border-border">
        <div>
          <span className="block text-[11px] text-muted">Evaluator Models</span>
          <span className="font-mono text-text break-words">{models.join(', ') || 'Deterministic Engine'}</span>
        </div>
        <div>
          <span className="block text-[11px] text-muted">Verification Latency</span>
          <span className="font-mono text-text">{(latencyMs / 1000).toFixed(2)}s {cacheHit ? '(cached)' : ''}</span>
        </div>
        <div>
          <span className="block text-[11px] text-muted">Tokens / Cost</span>
          <span className="font-mono text-text">{tokensUsed} tok / ${costUSD.toFixed(4)}</span>
        </div>
        <div>
          <span className="block text-[11px] text-muted">PII Shield Redactions</span>
          <span className="font-mono text-text">{redactionCount} secrets masked</span>
        </div>
      </div>

      <p className="text-[11px] text-muted italic">
        A rule engine makes the final decision; the AI supplies evidence only.
      </p>
    </div>
  )
}

