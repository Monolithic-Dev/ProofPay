'use client'

import React from 'react'
import Link from 'next/link'
import { JudgePanel } from '@/components/judge/JudgePanel'
import { PageShell } from '@/components/common/PageShell'
import { FlaskConical, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react'

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

        <Link
          href="/contracts"
          className="px-4 py-2 rounded-lg bg-brand text-white text-xs font-medium hover:opacity-95 transition-opacity"
        >
          Open App Workspace →
        </Link>
      </div>

      {/* Notice Banner */}
      <div className="p-4 rounded-xl bg-surface border border-border flex items-start gap-3 text-xs text-muted">
        <FlaskConical className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-text block">Dedicated Hackathon Testbench</strong>
          <span>
            This playground runs isolated sandbox scenarios. Any action taken here creates real cryptographic ledger events and exercises the live PayPal v2 order endpoints.
          </span>
        </div>
      </div>

      {/* Scenarios and Persona Switcher */}
      <JudgePanel />
    </div>
  )
}
