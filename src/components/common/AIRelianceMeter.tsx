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
    Low: { bar: 'bg-ok', text: 'text-ok', bg: 'bg-ok/10 border-ok/30' },
    Medium: { bar: 'bg-warn', text: 'text-warn', bg: 'bg-warn/10 border-warn/30' },
    High: { bar: 'bg-bad', text: 'text-bad', bg: 'bg-bad/10 border-bad/30' },
  }

  const style = colorMap[level]

  return (
    <div className={`rounded-xl border p-3 ${style.bg} ${className}`}>
      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
        <span className="text-text">AI Reliance Score</span>
        <span className={`font-mono ${style.text}`}>
          {level} ({percentage}%)
        </span>
      </div>

      <div className="w-full bg-surface-2 border border-border/60 rounded-full h-2 overflow-hidden mb-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${style.bar}`}
          style={{ width: `${Math.max(percentage, 5)}%` }}
        />
      </div>

      <p className="text-[11px] text-muted leading-relaxed">{description}</p>
    </div>
  )
}

