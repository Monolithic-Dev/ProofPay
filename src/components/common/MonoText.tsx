'use client'

/**
 * MonoText Component — renders cryptographic hashes & IDs with a one-click copy button.
 * Implements phase-6-frontend.md §6.1.
 */
import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { shortHash } from '@/lib/format'

export interface MonoTextProps {
  value: string | undefined | null
  short?: boolean
  length?: number
  label?: string
  className?: string
}

export function MonoText({
  value,
  short = false,
  length = 8,
  label,
  className = '',
}: MonoTextProps) {
  const [copied, setCopied] = useState(false)

  if (!value) {
    return <span className="text-muted text-xs font-mono">None</span>
  }

  const displayText = short ? shortHash(value, length) : value

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-2 border border-border text-xs font-mono text-text hover:border-brand/40 transition-colors ${className}`}
      title={value}
    >
      {label && <span className="text-muted select-none">{label}:</span>}
      <span className="truncate max-w-[200px] sm:max-w-[320px]">{displayText}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label || 'value'} ${value}`}
        className="text-muted hover:text-brand focus:outline-none focus:ring-1 focus:ring-brand rounded p-0.5"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-ok animate-in fade-in" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </span>
  )
}
