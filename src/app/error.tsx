'use client'

/**
 * Global App Error Boundary.
 * Implements phase-6-frontend.md §6.1.
 */
import React, { useEffect } from 'react'
import { ErrorState } from '@/components/common/ErrorState'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled app error:', error)
  }, [error])

  return (
    <div className="max-w-xl mx-auto px-4 py-20">
      <ErrorState
        title="Application Error"
        message={error.message || 'An unexpected error occurred.'}
        requestId={error.digest}
        onRetry={reset}
        action={
          <Link
            href="/"
            className="inline-flex items-center px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text hover:bg-surface-2 transition-colors"
          >
            Go home
          </Link>
        }
      />
    </div>
  )
}
