'use client'

import React, { useState } from 'react'

interface StepUpDialogProps {
  isOpen: boolean
  action: string
  onSuccess: () => void
  onCancel: () => void
  userId?: string
  sessionId?: string
}

export function StepUpDialog({
  isOpen,
  action,
  onSuccess,
  onCancel,
  userId = 'demo_user_1',
  sessionId = 'demo_session_1',
}: StepUpDialogProps) {
  const [method, setMethod] = useState<'password' | 'totp'>('password')
  const [credential, setCredential] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/v1/auth/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          credential,
          userId,
          sessionId,
          action,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Step-up authentication failed')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-up-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl text-text">
        <div className="flex items-center justify-between mb-4">
          <h2 id="step-up-title" className="text-lg font-semibold tracking-tight text-text flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-warn animate-pulse" />
            Security Verification Required
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted hover:text-text text-sm focus:outline-none p-1"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-muted mb-6">
          The requested action (<code className="text-warn bg-surface-2 border border-border px-1.5 py-0.5 rounded font-mono text-xs">{action}</code>) requires fresh proof of identity within the last 10 minutes.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-bad/10 border border-bad/30 p-3 text-xs text-bad">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 p-1 bg-surface-2 border border-border rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setMethod('password')}
              className={`flex-1 py-1.5 rounded-md font-medium transition ${
                method === 'password' ? 'bg-surface text-text shadow-xs border border-border/60' : 'text-muted hover:text-text'
              }`}
            >
              Account Password
            </button>
            <button
              type="button"
              onClick={() => setMethod('totp')}
              className={`flex-1 py-1.5 rounded-md font-medium transition ${
                method === 'totp' ? 'bg-surface text-text shadow-xs border border-border/60' : 'text-muted hover:text-text'
              }`}
            >
              Authenticator Code (TOTP)
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              {method === 'password' ? 'Confirm Password' : '6-Digit TOTP Code'}
            </label>
            <input
              type={method === 'password' ? 'password' : 'text'}
              autoComplete="current-password"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              placeholder={method === 'password' ? 'Enter password' : 'e.g. 123456'}
              required
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-muted hover:text-text hover:bg-surface-2 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !credential}
              className="rounded-lg bg-brand hover:bg-brand-hover px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition"
            >
              {loading ? 'Verifying...' : 'Verify & Proceed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
