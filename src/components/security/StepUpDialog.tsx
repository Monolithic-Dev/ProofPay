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
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl text-zinc-100">
        <div className="flex items-center justify-between mb-4">
          <h2 id="step-up-title" className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            Security Verification Required
          </h2>
          <button
            onClick={onCancel}
            className="text-zinc-400 hover:text-zinc-200 text-sm focus:outline-none"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-zinc-400 mb-6">
          The requested action (<code className="text-amber-400 bg-zinc-800 px-1 py-0.5 rounded">{action}</code>) requires fresh proof of identity within the last 10 minutes.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-950/60 border border-red-500/50 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 p-1 bg-zinc-800 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setMethod('password')}
              className={`flex-1 py-1.5 rounded-md font-medium transition ${
                method === 'password' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Account Password
            </button>
            <button
              type="button"
              onClick={() => setMethod('totp')}
              className={`flex-1 py-1.5 rounded-md font-medium transition ${
                method === 'totp' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Authenticator Code (TOTP)
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              {method === 'password' ? 'Confirm Password' : '6-Digit TOTP Code'}
            </label>
            <input
              type={method === 'password' ? 'password' : 'text'}
              autoComplete="current-password"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              placeholder={method === 'password' ? 'Enter password' : 'e.g. 123456'}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !credential}
              className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50 transition"
            >
              {loading ? 'Verifying...' : 'Verify & Proceed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
