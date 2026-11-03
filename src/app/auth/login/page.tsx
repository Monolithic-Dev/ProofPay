'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield,
  ArrowRight,
  User,
  Briefcase,
  Bot,
  Sparkles,
  CheckCircle2,
  Lock,
  Layers,
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

  const handleQuickPersona = async (personaKey: 'buyer' | 'seller' | 'buyer_agent' | 'worker_agent') => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_key: personaKey }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message || 'Quick login failed')
      }

      await queryClient.invalidateQueries({ queryKey: ['me'] })
      router.push('/contracts')
    } catch (err: any) {
      setError(err.message || 'Quick login failed')
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

        {/* Quick Switch for Judges / Evaluators */}
        <div className="p-4 rounded-xl bg-surface border border-border/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-muted tracking-wider uppercase">
            <span>Quick Sign-In by Role</span>
            <span className="text-[10px] bg-brand/10 text-brand px-2 py-0.5 rounded-full font-medium lowercase">
              for testing
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickPersona('buyer')}
              disabled={loading}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-surface-2 hover:border-brand/40 hover:bg-surface transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Briefcase className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-text truncate">Sarah Buyer</p>
                <p className="text-[10px] text-muted truncate">Client / Funds Authorization</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickPersona('seller')}
              disabled={loading}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-surface-2 hover:border-brand/40 hover:bg-surface transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-text truncate">Alex Seller</p>
                <p className="text-[10px] text-muted truncate">Provider / Delivers Work</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickPersona('buyer_agent')}
              disabled={loading}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-surface-2 hover:border-brand/40 hover:bg-surface transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-md bg-purple-500/10 text-purple-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-text truncate">ProcureBot</p>
                <p className="text-[10px] text-muted truncate">Autonomous Buyer</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickPersona('worker_agent')}
              disabled={loading}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-surface-2 hover:border-brand/40 hover:bg-surface transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-text truncate">SynthetixBot</p>
                <p className="text-[10px] text-muted truncate">Autonomous Worker</p>
              </div>
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-bg px-2 text-muted">Or continue with email</span>
          </div>
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
      </div>
    </div>
  )
}
