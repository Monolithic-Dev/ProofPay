'use client'

/**
 * Sandbox Playground Control Panel — interactive persona switcher & scenarios.
 */
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  UserCheck,
  Shield,
  Bot,
  Video,
  FileText,
  CheckCircle2,
  Loader2,
  Zap,
  Play,
} from 'lucide-react'
import { useApiClient, useCurrentUser } from '@/lib/query'
import { SandboxCredsBanner } from './SandboxCredsBanner'
import { ScenarioButtons } from './ScenarioButtons'
import { WorkerStatusBanner } from './WorkerStatusBanner'

interface PersonaConfig {
  key: 'buyer' | 'seller' | 'buyer_agent' | 'worker_agent'
  email: string
  name: string
  role: string
  isAgent: boolean
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const PERSONAS: PersonaConfig[] = [
  {
    key: 'buyer',
    email: 'buyer@demo.proofpay',
    name: 'Sarah Buyer',
    role: 'Buyer',
    isAgent: false,
    description: 'Creates contracts, deposits PayPal authorization holds, reviews deliverables.',
    icon: Shield,
  },
  {
    key: 'seller',
    email: 'seller@demo.proofpay',
    name: 'Alex Seller',
    role: 'Seller',
    isAgent: false,
    description: 'Accepts contracts, submits milestone artifacts, receives payouts.',
    icon: UserCheck,
  },
  {
    key: 'buyer_agent',
    email: 'buyer-agent@demo.proofpay',
    name: 'ProcureBot',
    role: 'Buyer Agent',
    isAgent: true,
    description: 'Autonomous AI agent procuring datasets and orchestrating holds via API.',
    icon: Bot,
  },
  {
    key: 'worker_agent',
    email: 'worker-agent@demo.proofpay',
    name: 'SynthetixBot',
    role: 'Worker Agent',
    isAgent: true,
    description: 'Autonomous worker agent generating JSON data and submitting for check.',
    icon: Bot,
  },
]

export function JudgePanel({ className = '' }: { className?: string }) {
  const router = useRouter()
  const api = useApiClient()
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()
  const [switchingPersona, setSwitchingPersona] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [isLaunchingExpress, setIsLaunchingExpress] = useState(false)
  const [expressError, setExpressError] = useState<string | null>(null)

  const handleSwitchPersona = async (personaKey: string) => {
    try {
      setSwitchError(null)
      setSwitchingPersona(personaKey)
      await api.demoLogin(personaKey)
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      await queryClient.invalidateQueries({ queryKey: ['contracts'] })
      router.refresh()
    } catch (err: any) {
      console.error('Failed to switch persona:', err)
      setSwitchError(err?.message || 'Failed to switch sandbox persona')
    } finally {
      setSwitchingPersona(null)
    }
  }

  const handleLaunchExpressLane = async () => {
    setIsLaunchingExpress(true)
    setExpressError(null)
    router.push('/demo/express')
  }

  return (
    <div id="judge-mode" className={`p-6 sm:p-8 rounded-2xl bg-surface border border-border shadow-sm space-y-8 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-text">Sandbox Playground &amp; Interactive Testing</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-ok/10 text-ok border border-ok/20">
              Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Test both sides of milestone settlements or run automated agent scenarios
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://github.com/Monolithic-Dev/ProofPay"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text hover:bg-surface-2 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-muted" />
            README
          </a>
          {process.env.NEXT_PUBLIC_DEMO_VIDEO_URL && (
            <a
              href={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:opacity-95 transition-all"
            >
              <Video className="w-3.5 h-3.5" />
              Watch Video
            </a>
          )}
        </div>
      </div>

      {/* Express Sandbox Lane (90 Seconds End-to-End) */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-brand/10 via-surface to-accent/10 border border-brand/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Zap className="w-4 h-4 text-brand" />
              <span className="text-xs font-bold text-text uppercase tracking-wider">
                Express Sandbox Lane • 90-Second Walkthrough
              </span>
              <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-mono font-semibold">
                1-Click
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted max-w-2xl leading-relaxed">
              Want a guided end-to-end walkthrough? Run a complete pre-authorized flow:
              Contract setup &rarr; PayPal authorization hold &rarr; Deterministic schema evaluation &rarr; PayPal capture &rarr; Offline Proof Pack.
              <strong> No manual PayPal login required for this lane.</strong>
            </p>
          </div>

          <button
            type="button"
            disabled={isLaunchingExpress}
            onClick={handleLaunchExpressLane}
            className="px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 flex-shrink-0 disabled:opacity-50"
          >
            {isLaunchingExpress ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Opening Express Lane…</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Launch 90s Express Lane</span>
              </>
            )}
          </button>
        </div>

        {expressError && (
          <p className="text-xs text-bad">{expressError}</p>
        )}
      </div>

      {/* Persona Switcher */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text">Select Active Persona</h3>
          {currentUser && (
            <span className="text-xs text-muted flex flex-wrap items-center gap-1.5">
              <span>Logged in as:</span>
              <strong className="text-text font-medium">{currentUser.display_name}</strong>
              <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] font-mono border border-border">
                {currentUser.role}
              </span>
            </span>
          )}
        </div>

        {switchError && (
          <div className="p-3 rounded-xl bg-bad/10 border border-bad/30 text-xs text-bad">
            {switchError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PERSONAS.map((p) => {
            const Icon = p.icon
            const isActive =
              currentUser?.persona_key === p.key || currentUser?.email === p.email
            const isPending = switchingPersona === p.key

            return (
              <div
                key={p.key}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                  isActive
                    ? 'bg-brand/5 border-brand shadow-sm ring-1 ring-brand'
                    : 'bg-surface-2/60 border-border hover:border-brand/40'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                        p.role.includes('Buyer')
                          ? 'bg-brand/10 text-brand'
                          : 'bg-ok/10 text-ok'
                      }`}
                    >
                      {p.role}
                    </span>
                    {isActive && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-ok">
                        <CheckCircle2 className="w-3.5 h-3.5 text-ok" />
                        Active
                      </span>
                    )}
                  </div>

                  <div className="font-semibold text-sm text-text flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-muted" />
                    <span>{p.name}</span>
                  </div>

                  <p className="text-xs text-muted leading-relaxed">{p.description}</p>
                </div>

                <button
                  type="button"
                  disabled={isPending || isActive}
                  onClick={() => handleSwitchPersona(p.key)}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium transition-all focus:ring-2 focus:ring-brand focus:outline-none flex items-center justify-center gap-1.5 ${
                    isActive
                      ? 'bg-brand/10 text-brand font-semibold cursor-default'
                      : 'bg-surface border border-border text-text hover:bg-brand hover:text-white hover:border-transparent'
                  }`}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Switching…
                    </>
                  ) : isActive ? (
                    'Current Persona'
                  ) : (
                    `Continue as ${p.name.split(' ')[0]}`
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* PayPal Sandbox Credentials Banner */}
      <SandboxCredsBanner />

      {/* Worker Status Indicator */}
      <WorkerStatusBanner />

      {/* 5 Scenario Buttons */}
      <ScenarioButtons />
    </div>
  )
}
