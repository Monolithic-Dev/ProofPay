'use client'

import React from 'react'
import Link from 'next/link'
import { JudgePanel } from '@/components/judge/JudgePanel'
import { PageShell } from '@/components/common/PageShell'
import { FlaskConical, ArrowLeft, Zap, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'

export default function DemoPlaygroundPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-brand transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Public Product</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
              Sandbox Playground
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
              Demo Mode Active
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            Test multi-agent transactions, adversarial prompt injections, and instant PayPal sandbox holds without manual setup.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/demo/express"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand text-white text-xs font-bold hover:bg-brand-hover transition-colors shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>90s Express Lane</span>
          </Link>
          <Link
            href="/contracts"
            className="px-3.5 py-2 rounded-lg bg-surface border border-border text-text text-xs font-medium hover:bg-surface-2 transition-colors"
          >
            App Workspace →
          </Link>
        </div>
      </div>

      {/* Express Lane Callout for Judges */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-brand/10 via-surface to-accent/10 border border-brand/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-brand/10 text-brand flex-shrink-0 mt-0.5">
            <Zap className="w-5 h-5 fill-brand text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <strong className="text-sm font-bold text-text">
                Hackathon Judge 90-Second Express Sandbox
              </strong>
              <span className="px-2 py-0.5 rounded bg-brand/10 text-brand text-[10px] font-mono font-bold">
                PRE-AUTHORIZED
              </span>
            </div>
            <p className="text-xs text-muted mt-1 max-w-2xl leading-relaxed">
              Experience the entire ProofPay payment capture flow in &lt; 90 seconds. Uses pre-authorized PayPal sandbox holds funded by the ProofPay team — no personal PayPal sandbox login required.
            </p>
          </div>
        </div>

        <Link
          href="/demo/express"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover transition-all flex-shrink-0 shadow-sm"
        >
          <span>Launch Express Lane</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Scenarios and Persona Switcher */}
      <JudgePanel />
    </div>
  )
}
