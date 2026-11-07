'use client'

import React from 'react'
import Link from 'next/link'
import { JudgePanel } from '@/components/judge/JudgePanel'
import { PageShell } from '@/components/common/PageShell'
import { FlaskConical, ArrowLeft, Zap, ArrowRight, ShieldCheck, Sparkles, Bot, Cpu } from 'lucide-react'

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
            href="/demo/mcp"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors shadow-sm"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>MCP Simulator</span>
          </Link>
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

      {/* Feature Callouts Grid: Express Lane & In-Browser MCP Simulator */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Callout 1: 90s Express Judge Lane */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-brand/10 via-surface to-surface border border-brand/30 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-brand/10 text-brand flex-shrink-0 mt-0.5">
              <Zap className="w-5 h-5 fill-brand text-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <strong className="text-sm font-bold text-text">
                  90-Second Express Judge Sandbox
                </strong>
                <span className="px-1.5 py-0.2 rounded bg-brand/10 text-brand text-[10px] font-mono font-bold">
                  PRE-AUTHORIZED
                </span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Experience the full PayPal payment lifecycle: hold &rarr; AI verify &rarr; capture in &lt; 90 seconds without logging into PayPal.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/demo/express"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover transition-all shadow-sm"
            >
              <span>Launch 90s Express Lane</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Callout 2: In-Browser MCP Agent Simulator */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 via-surface to-surface border border-purple-500/30 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 flex-shrink-0 mt-0.5">
              <Cpu className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <strong className="text-sm font-bold text-text">
                  In-Browser MCP Agent Simulator
                </strong>
                <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 text-[10px] font-mono font-bold">
                  AUTONOMOUS
                </span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Watch Claude and Gemini execute the 6 ProofPay MCP tools via JSON-RPC: create contracts, hold funds, and release payments.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/demo/mcp"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-all shadow-sm"
            >
              <span>Open MCP Simulator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Scenarios and Persona Switcher */}
      <JudgePanel />
    </div>
  )
}
