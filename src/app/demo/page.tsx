'use client'

import React from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { JudgePanel } from '@/components/judge/JudgePanel'
import {
  Zap,
  ArrowRight,
  Cpu,
  Scale,
  Wallet,
  SearchCode,
  ShieldAlert,
} from 'lucide-react'

export default function DemoPlaygroundPage() {
  const showcaseLabs = [
    {
      title: '90-Second Express Judge Sandbox',
      badge: 'PRE-AUTHORIZED',
      desc: 'Experience the full PayPal payment lifecycle: authorization hold → AI verify → partial capture in < 90 seconds without logging into PayPal.',
      href: '/demo/express',
      cta: 'Launch 90s Express Lane',
      icon: Zap,
    },
    {
      title: 'N1 Adversarial Loophole Finder',
      badge: 'RED-TEAM & PATCH',
      desc: 'Attack your own contract rules with schema-valid exploit payloads (Lorem Ipsum spam, duplicate SKUs, banned copy), prove the bypass in code, and seal it via RFC 6902 in one click.',
      href: '/demo/loophole',
      cta: 'Launch Loophole Finder',
      icon: SearchCode,
    },
    {
      title: 'In-Browser MCP Agent Simulator',
      badge: 'AUTONOMOUS',
      desc: 'Watch Claude and Gemini execute the 6 ProofPay MCP tools via JSON-RPC: create contracts, inspect status, and submit deliverables under bounded human funding policies.',
      href: '/demo/mcp',
      cta: 'Open MCP Simulator',
      icon: Cpu,
    },
    {
      title: 'Multi-Agent AI Dispute Tribunal',
      badge: 'ARBITRATION',
      desc: 'Three autonomous LLM agents (Buyer Advocate, Seller Defense, and Chief Arbitrator) debate ambiguous deliverables with grounded evidence recommendations before human sign-off.',
      href: '/demo/tribunal',
      cta: 'Enter AI Tribunal',
      icon: Scale,
    },
    {
      title: 'PayPal Agent Spend Policy Guardrail',
      badge: 'AGENTIC COMMERCE',
      desc: 'Safely delegate bounded workflow scopes to autonomous AI agents with milestone caps, human approval requirements, and prompt injection filters.',
      href: '/demo/agent-wallet',
      cta: 'Explore Agent Wallet',
      icon: Wallet,
    },
    {
      title: 'N3 Chaos Resilience Lab',
      badge: 'MONEY INVARIANT',
      desc: 'Inject synthetic PayPal 504 timeouts, duplicate webhook replays, worker pauses, and LLM outages while preserving zero double captures.',
      href: '/demo/lab',
      cta: 'Open Resilience Lab',
      icon: ShieldAlert,
    },
  ]

  return (
    <PageShell
      title="Sandbox Playground"
      subtitle="Test multi-agent transactions, adversarial prompt injections, contract loophole red-teaming, and PayPal sandbox holds without manual setup."
      backHref="/"
      backLabel="Back to Home"
      maxWidth="6xl"
      actions={
        <div className="flex items-center gap-2.5">
          <Link
            href="/demo/express"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-text text-bg hover:opacity-90 font-bold text-xs transition-all shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>90s Express Lane</span>
          </Link>
          <Link
            href="/contracts"
            className="px-3.5 py-2 rounded-xl bg-surface border border-border text-text text-xs font-semibold hover:bg-surface-2 transition-colors"
          >
            Workspace &rarr;
          </Link>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Feature Callouts 6-Grid: Modern luxury cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showcaseLabs.map((lab) => {
            const Icon = lab.icon
            return (
              <div
                key={lab.href}
                className="p-6 rounded-2xl bg-surface border border-border/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-brand/40 hover:shadow-md transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-xl bg-surface-2 border border-border/60 text-text group-hover:text-brand transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-surface-2 border border-border text-muted">
                      {lab.badge}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-text group-hover:text-brand transition-colors">
                      {lab.title}
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      {lab.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <Link
                    href={lab.href}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text text-xs font-semibold border border-border transition-all group/btn"
                  >
                    <span>{lab.cta}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted group-hover/btn:translate-x-0.5 group-hover/btn:text-text transition-all" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* Scenarios and Persona Switcher */}
        <JudgePanel />
      </div>
    </PageShell>
  )
}
