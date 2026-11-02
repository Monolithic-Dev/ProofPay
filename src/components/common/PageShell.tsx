'use client'

/**
 * PageShell Component — standard responsive container with title, back links, and action slots.
 * Implements phase-6-frontend.md §6.1.
 */
import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export interface PageShellProps {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  actions?: React.ReactNode
  children: React.ReactNode
  maxWidth?: '5xl' | '6xl' | '7xl' | 'full'
  className?: string
}

export function PageShell({
  title,
  subtitle,
  backHref,
  backLabel = 'Back',
  actions,
  children,
  maxWidth = '7xl',
  className = '',
}: PageShellProps) {
  const maxWidthClass =
    maxWidth === '5xl'
      ? 'max-w-5xl'
      : maxWidth === '6xl'
      ? 'max-w-6xl'
      : maxWidth === 'full'
      ? 'max-w-full'
      : 'max-w-7xl'

  return (
    <div className={`${maxWidthClass} mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6 ${className}`}>
      {backHref && (
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-brand focus:outline-none focus:ring-1 focus:ring-brand rounded transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {backLabel}
          </Link>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>

      <div>{children}</div>
    </div>
  )
}
