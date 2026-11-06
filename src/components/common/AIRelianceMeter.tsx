import React from 'react'

export interface AIRelianceMeterProps {
  requiredRubricCount: number
  requiredTotalCount: number
  className?: string
}

export type RelianceLevel = 'Low' | 'Medium' | 'High'

export function computeReliance(rubricCount: number, totalCount: number): {
  percentage: number
  level: RelianceLevel
  description: string
} {
  if (totalCount === 0) {
    return { percentage: 0, level: 'Low', description: 'Zero AI reliance; 100% deterministic code rules.' }
  }

  const ratio = rubricCount / totalCount
  const percentage = Math.round(ratio * 100)

  if (ratio < 0.2) {
    return {
      percentage,
      level: 'Low',
      description: 'Low AI reliance: primarily deterministic code checks.',
    }
  }

  if (ratio <= 0.5) {
    return {
      percentage,
      level: 'Medium',
      description: 'Moderate AI reliance: balanced code and rubric checks.',
    }
  }

  return {
    percentage,
    level: 'High',
    description: 'Higher reliance means more cases may need human review.',
  }
}

export function AIRelianceMeter({
  requiredRubricCount,
  requiredTotalCount,
  className = '',
}: AIRelianceMeterProps) {
  const { percentage, level, description } = computeReliance(requiredRubricCount, requiredTotalCount)

  const colorMap: Record<RelianceLevel, { bar: string; text: string; bg: string }> = {
    Low: { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/40' },
    Medium: { bar: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/40' },
    High: { bar: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-950/40 border-red-800/40' },
  }

  const style = colorMap[level]

  return (
    <div className={`rounded-xl border p-3 ${style.bg} ${className}`}>
      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
        <span className="text-zinc-200">AI Reliance Score</span>
        <span className={`font-mono ${style.text}`}>
          {level} ({percentage}%)
        </span>
      </div>

      <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden mb-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${style.bar}`}
          style={{ width: `${Math.max(percentage, 5)}%` }}
        />
      </div>

      <p className="text-[11px] text-zinc-400 leading-relaxed">{description}</p>
    </div>
  )
}

