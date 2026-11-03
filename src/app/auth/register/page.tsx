'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Lock,
  ArrowRight,
  User,
  Building,
  CheckCircle2,
  Shield,
  Layers,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

export default function RegisterPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer')
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!termsAgreed) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          display_name: displayName,
          org_name: orgName || `${displayName || 'New'}'s Workspace`,
          role,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message || `Registration failed (${res.status})`)
      }

      await queryClient.invalidateQueries({ queryKey: ['me'] })
      router.push('/contracts')
    } catch (err: any) {
      setError(err.message || 'Registration error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 text-brand mb-2">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Create your ProofPay Account
          </h1>
          <p className="text-sm text-muted">
            Start securing client commitments or delivering verified work with PayPal authorization holds
          </p>
        </div>

        <div className="card p-8 border border-border/80 rounded-2xl bg-surface/50 backdrop-blur-sm shadow-xl space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <span className="font-semibold">Error:</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted block mb-1.5">
                Full Name / Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Sarah Chen"
                className="w-full bg-surface-subtle border border-border rounded-xl px-4 py-2.5 text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted block mb-1.5">
                Work Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@acme.ai"
                className="w-full bg-surface-subtle border border-border rounded-xl px-4 py-2.5 text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted block mb-1.5">
                Organization / Workspace Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Autonomous Labs"
                className="w-full bg-surface-subtle border border-border rounded-xl px-4 py-2.5 text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted block mb-1.5">
                Primary Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('buyer')}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    role === 'buyer'
                      ? 'border-brand bg-brand/10 text-brand font-medium ring-1 ring-brand'
                      : 'border-border bg-surface text-muted hover:border-border-hover'
                  }`}
                >
                  <div className="font-semibold text-text">Client / Buyer</div>
                  <div className="text-[11px] text-muted mt-0.5">Deposit PayPal hold &amp; verify</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('seller')}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    role === 'seller'
                      ? 'border-brand bg-brand/10 text-brand font-medium ring-1 ring-brand'
                      : 'border-border bg-surface text-muted hover:border-border-hover'
                  }`}
                >
                  <div className="font-semibold text-text">Provider / Seller</div>
                  <div className="text-[11px] text-muted mt-0.5">Submit deliverables &amp; get paid</div>
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-2">
              <input
                type="checkbox"
                id="terms"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-brand focus:ring-brand accent-brand cursor-pointer"
              />
              <label htmlFor="terms" className="text-xs text-muted leading-relaxed cursor-pointer">
                I agree to the{' '}
                <Link href="/legal/terms" className="text-brand hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/legal/privacy" className="text-brand hover:underline">
                  Privacy Policy
                </Link>
                . I acknowledge that ProofPay operates on sandbox PayPal rails.
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-lg shadow-brand/20 transition-all disabled:opacity-50 mt-4"
            >
              <span>{loading ? 'Creating Workspace...' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-border/60 text-center">
            <span className="text-xs text-muted">Already have an account? </span>
            <Link href="/auth/login" className="text-xs font-semibold text-brand hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
