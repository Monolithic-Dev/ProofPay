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
    <div className={`mt-8 pt-6 border-t border-zinc-800 text-xs text-zinc-400 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-zinc-300">How This Was Decided</h4>
        <span className="font-mono text-[11px] text-zinc-500">Prompt: {promptVersion}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800">
        <div>
          <span className="block text-[11px] text-zinc-500">Evaluator Models</span>
          <span className="font-mono text-zinc-200">{models.join(', ') || 'Deterministic Engine'}</span>
        </div>
        <div>
          <span className="block text-[11px] text-zinc-500">Verification Latency</span>
          <span className="font-mono text-zinc-200">{(latencyMs / 1000).toFixed(2)}s {cacheHit ? '(cached)' : ''}</span>
        </div>
        <div>
          <span className="block text-[11px] text-zinc-500">Tokens / Cost</span>
          <span className="font-mono text-zinc-200">{tokensUsed} tok / ${costUSD.toFixed(4)}</span>
        </div>
        <div>
          <span className="block text-[11px] text-zinc-500">PII Shield Redactions</span>
          <span className="font-mono text-zinc-200">{redactionCount} secrets masked</span>
        </div>
      </div>

      <p className="text-[11px] text-zinc-500 italic">
        A rule engine makes the final decision; the AI supplies evidence only.
      </p>
    </div>
  )
}

