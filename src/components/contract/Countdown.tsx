'use client'

/**
 * Countdown Chip Component — tracks hold expiration and capture windows.
 * Switches to warning state with icon + text when under threshold.
 * Implements phase-6-frontend.md §6.3 & ux-flows.md §3.
 */
import React, { useEffect, useState } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import { formatDuration } from '@/lib/format'

export interface CountdownProps {
  target: string | Date | undefined | null
  label: string
  warnBelowMs?: number // e.g. 24h = 86400000 ms
  className?: string
}

export function Countdown({
  target,
  label,
  warnBelowMs = 24 * 3600 * 1000,
  className = '',
}: CountdownProps) {
  const [msRemaining, setMsRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!target) {
      setMsRemaining(null)
      return
    }

    const targetDate = typeof target === 'string' ? new Date(target) : target

    const update = () => {
      const diff = targetDate.getTime() - Date.now()
      setMsRemaining(diff)
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [target])

  if (!target || msRemaining === null) return null

  const isExpired = msRemaining <= 0
  const isWarn = !isExpired && msRemaining < warnBelowMs

  let statusClass = 'bg-surface-2 text-muted border-border'
  let Icon = Clock

  if (isExpired) {
    statusClass = 'bg-bad/10 text-bad border-bad/30'
    Icon = AlertTriangle
  } else if (isWarn) {
    statusClass = 'bg-warn/10 text-warn border-warn/30'
    Icon = AlertTriangle
  }

  const durationText = isExpired ? 'Expired' : `${formatDuration(msRemaining)} left`

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusClass} ${className}`}
      title={`${label}: ${isExpired ? 'Expired' : durationText}`}
      aria-label={`${label}: ${isExpired ? 'Expired' : durationText}`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{label}:</span>
      <strong className="font-semibold">{durationText}</strong>
      {isWarn && <span className="sr-only">(Warning: deadline approaching)</span>}
    </span>
  )
}
