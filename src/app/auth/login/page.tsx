'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Lock,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

export default function LoginPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const endpoint = mode === 'register' ? '/api/v1/auth/register' : '/api/v1/auth/login'
      const payload =
        mode === 'register'
          ? { email, display_name: displayName, role }
          : { email, role, display_name: displayName || undefined }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message || `Authentication failed (${res.status})`)
      }

      await queryClient.invalidateQueries({ queryKey: ['me'] })
      router.push('/contracts')
    } catch (err: any) {
      setError(err.message || 'Authentication error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 text-brand mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            {mode === 'login' ? 'Sign in to ProofPay' : 'Create an Account'}
          </h1>
          <p className="text-sm text-muted">
            {mode === 'login'
              ? 'Access your agreements, milestone proof, and PayPal holds'
              : 'Start locking authorization holds or delivering verified work'}
          </p>
        </div>

        {/* Auth Form Card */}
        <div className="p-6 rounded-xl bg-surface border border-border shadow-sm space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-bad/10 border border-bad/20 text-bad text-xs font-medium flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-text mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text mb-1.5">
                Primary Account Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('buyer')}
                  className={`p-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                    role === 'buyer'
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border bg-surface-2 text-muted hover:text-text'
                  }`}
                >
                  <p className="font-semibold">Buyer / Client</p>
                  <p className="text-[10px] opacity-80">I hire &amp; authorize holds</p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('seller')}
                  className={`p-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                    role === 'seller'
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border bg-surface-2 text-muted hover:text-text'
                  }`}
                >
                  <p className="font-semibold">Seller / Contractor</p>
                  <p className="text-[10px] opacity-80">I deliver &amp; get paid</p>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-95 transition-opacity disabled:opacity-50 shadow-sm"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                setError(null)
              }}
              className="text-xs text-brand hover:underline transition-all"
            >
              {mode === 'login'
                ? "Don't have an account yet? Register here"
                : 'Already have an account? Sign in here'}
            </button>
          </div>
        </div>

        {/* Dedicated Sandbox / Judge Notice */}
        <div className="p-4 rounded-xl bg-surface-2 border border-border text-center space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted">
            <Sparkles className="w-3.5 h-3.5 text-brand" />
            <span>Testing the PayPal Sandbox or Judge Mode?</span>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Visit the{' '}
            <Link href="/demo" className="text-brand font-medium hover:underline">
              Interactive Judge Sandbox &rarr;
            </Link>{' '}
            for one-click scenario testing and pre-configured personas.
          </p>
        </div>
      </div>
    </div>
  )
}
