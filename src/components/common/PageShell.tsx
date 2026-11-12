'use client'

/**
 * PageShell Component — standard responsive container with title, back links, and action slots.
 * Enterprise polish: includes subtle dot pattern background, glowing header accent, and clean spacing.
 */
import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ScrollReveal } from '@/components/common/ScrollReveal'

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
    <div className="relative min-h-[calc(100vh-4rem)] overflow-x-clip">
      {/* Ambient background grid pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-15 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[300px] bg-gradient-to-b from-sky-500/5 via-transparent to-transparent pointer-events-none blur-3xl" />

      <div className={`relative z-10 ${maxWidthClass} mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6 ${className}`}>
        {backHref && (
          <ScrollReveal animation="fade-in" durationMs={300}>
            <div>
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-brand focus:outline-none focus:ring-1 focus:ring-brand rounded-lg px-2.5 py-1 bg-surface-2/60 border border-border/60 hover:bg-surface-2 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{backLabel}</span>
              </Link>
            </div>
          </ScrollReveal>
        )}

        <ScrollReveal animation="fade-up" durationMs={400}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
            <div className="space-y-1.5 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-rubik font-extrabold tracking-tight text-text">{title}</h1>
              {subtitle && <p className="text-sm font-manrope text-muted leading-relaxed max-w-3xl">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-3 shrink-0">{actions}</div>}
          </div>
        </ScrollReveal>

        <div className="relative z-10">
          {children}
        </div>
      </div>
    </div>
  )
}
