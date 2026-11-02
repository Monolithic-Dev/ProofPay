'use client'

/**
 * LoadingBlock Component.
 * Implements phase-6-frontend.md §6.1.
 */
import React from 'react'
import { Loader2 } from 'lucide-react'

export interface LoadingBlockProps {
  message?: string
  rows?: number
  className?: string
}

export function LoadingBlock({
  message = 'Loading…',
  rows = 3,
  className = '',
}: LoadingBlockProps) {
  return (
    <div className={`p-8 rounded-xl bg-surface border border-border space-y-4 ${className}`}>
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-brand animate-spin" />
        <span className="text-sm font-medium text-text">{message}</span>
      </div>
      <div className="space-y-2.5 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-surface-2 rounded animate-pulse"
            style={{ width: `${85 - i * 15}%` }}
          />
        ))}
      </div>
    </div>
  )
}
