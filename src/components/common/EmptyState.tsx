'use client'

/**
 * EmptyState & LoadingBlock Components.
 * Implements phase-6-frontend.md §6.1.
 */
import React from 'react'
import { Inbox, Loader2 } from 'lucide-react'

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`p-10 rounded-xl bg-surface border border-dashed border-border text-center flex flex-col items-center justify-center space-y-4 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-muted">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <div className="space-y-1 max-w-sm">
        <h3 className="font-semibold text-text text-base">{title}</h3>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}

export interface LoadingBlockProps {
  message?: string
  rows?: number
  className?: string
}

export function LoadingBlock({
  message = 'Loading data…',
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
