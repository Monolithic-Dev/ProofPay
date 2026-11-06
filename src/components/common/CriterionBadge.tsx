import React from 'react'

export interface CriterionBadgeProps {
  type: 'deterministic' | 'rubric' | 'human'
  className?: string
}

export function CriterionBadge({ type, className = '' }: CriterionBadgeProps) {
  if (type === 'deterministic') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-950/70 text-blue-300 border border-blue-800/60 ${className}`}
        title="Evaluated deterministically via code tests and schema validation (zero LLM reliance)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        Rule
      </span>
    )
  }

  if (type === 'rubric') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-950/70 text-purple-300 border border-purple-800/60 ${className}`}
        title="AI-assisted evidence extraction with deterministic quote verification"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
        AI-assisted
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 ${className}`}
      title="Requires human buyer review"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
      Manual
    </span>
  )
}

