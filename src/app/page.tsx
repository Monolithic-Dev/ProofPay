import Link from 'next/link'
import { JudgePanel } from '@/components/judge/JudgePanel'
import { Sparkles, Shield, CheckCircle, Lock, Cpu } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-16">
      {/* Hero Section */}
      <div className="text-center space-y-6 pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>PayPal AI Hackathon 2026</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-text max-w-3xl mx-auto leading-tight">
          Pay when it is proven.
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted leading-relaxed">
          Autonomous agents negotiate agreements. PayPal locks authorization holds.
          Deterministic code and adversarial checks verify deliverables before funds ever release.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/studio"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-brand text-white font-medium shadow-sm hover:opacity-95 transition-opacity text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
          >
            Create a contract
          </Link>
          <a
            href="#judge-mode"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-surface border border-border text-text font-medium hover:bg-surface-2 transition-colors text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-border"
          >
            Explore Judge Mode
          </a>
        </div>

        {/* The Honesty Line */}
        <p className="text-xs text-muted max-w-md mx-auto pt-1">
          PayPal authorization hold, not escrow. Sandbox only.
        </p>
      </div>

      {/* Trust & Verification Architecture (Three Pillars) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl bg-surface border border-border shadow-sm space-y-3">
          <div className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-text font-medium">
            <Cpu className="w-4 h-4 text-brand" />
          </div>
          <h2 className="text-base font-semibold text-text">1. Synthesize &amp; Lint</h2>
          <p className="text-sm text-muted leading-relaxed">
            Translate plain English agreements into machine-checkable criteria with automated checks for ambiguity, budget mismatches, and deadline integrity.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-surface border border-border shadow-sm space-y-3">
          <div className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-text font-medium">
            <Lock className="w-4 h-4 text-ok" />
          </div>
          <h2 className="text-base font-semibold text-text">2. Authorization Hold</h2>
          <p className="text-sm text-muted leading-relaxed">
            PayPal authorization places a 29-day hold on the buyer’s funding source without charging upfront. The seller receives cryptographically verified proof of funds.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-surface border border-border shadow-sm space-y-3">
          <div className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-text font-medium">
            <CheckCircle className="w-4 h-4 text-brand" />
          </div>
          <h2 className="text-base font-semibold text-text">3. Verify &amp; Settle</h2>
          <p className="text-sm text-muted leading-relaxed">
            Submissions run through deterministic JSON schema checks, LLM rubrics, and prompt injection defense. Passing results automatically trigger PayPal partial captures.
          </p>
        </div>
      </div>

      {/* Judge Mode & Interactive Personas */}
      <JudgePanel />
    </div>
  )
}
