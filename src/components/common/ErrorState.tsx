'use client'

/**
 * ErrorState Component — displays error messages, request ID, and Copy Details.
 * Implements phase-6-frontend.md §6.1.
 */
import React, { useState } from 'react'
import { AlertCircle, Copy, Check, RefreshCw } from 'lucide-react'

export interface ErrorStateProps {
  title?: string
  message: string
  requestId?: string
  code?: string
  onRetry?: () => void
  action?: React.ReactNode
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  requestId,
  code,
  onRetry,
  action,
  className = '',
}: ErrorStateProps) {
  const [copied, setCopied] = useState(false)

  const copyDetails = async () => {
    const text = `Error: ${title}\nCode: ${code ?? 'UNKNOWN'}\nMessage: ${message}\nRequest ID: ${requestId ?? 'N/A'}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div
      role="alert"
      className={`p-6 rounded-xl bg-bad/5 border border-bad/20 text-text space-y-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-bad flex-shrink-0 mt-0.5" />
        <div className="space-y-1 flex-1">
          <h3 className="font-semibold text-bad text-base">{title}</h3>
          <p className="text-sm text-muted">{message}</p>
        </div>
      </div>

      {requestId && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-bad/10 text-xs text-muted">
          <span>Request ID:</span>
          <code className="font-mono bg-surface-2 px-1.5 py-0.5 rounded border border-border text-text">
            {requestId}
          </code>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={copyDetails}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text hover:bg-surface-2 transition-colors focus:ring-2 focus:ring-brand focus:outline-none"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-ok" />
              Copied details
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy details
            </>
          )}
        </button>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:opacity-95 transition-all focus:ring-2 focus:ring-brand focus:outline-none"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
        )}

        {action}
      </div>
    </div>
  )
}
