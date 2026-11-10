'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap, Cpu, Scale, Wallet, Play, ShieldAlert, SearchCode } from 'lucide-react'

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const tabs = [
    {
      href: '/demo',
      label: 'Playground Overview',
      icon: Play,
      activeColor: 'text-amber-500 border-amber-500 bg-amber-500/10',
    },
    {
      href: '/demo/express',
      label: '90s Express Lane',
      badge: 'Real Capture',
      icon: Zap,
      activeColor: 'text-brand border-brand bg-brand/10',
    },
    {
      href: '/demo/loophole',
      label: 'Loophole Finder',
      badge: 'Red-Team N1',
      icon: SearchCode,
      activeColor: 'text-orange-400 border-orange-400 bg-orange-500/10',
    },
    {
      href: '/demo/mcp',
      label: 'MCP Agent Simulator',
      badge: 'Claude/Gemini',
      icon: Cpu,
      activeColor: 'text-purple-400 border-purple-400 bg-purple-500/10',
    },
    {
      href: '/demo/tribunal',
      label: 'AI Dispute Tribunal',
      badge: 'Arbitration',
      icon: Scale,
      activeColor: 'text-indigo-400 border-indigo-400 bg-indigo-500/10',
    },
    {
      href: '/demo/agent-wallet',
      label: 'Agent Spend Policy',
      badge: 'Guardrails',
      icon: Wallet,
      activeColor: 'text-emerald-400 border-emerald-400 bg-emerald-500/10',
    },
    {
      href: '/demo/lab',
      label: 'Resilience Lab',
      badge: 'Faults',
      icon: ShieldAlert,
      activeColor: 'text-red-400 border-red-400 bg-red-500/10',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sub-header Navigation Bar for Demo Showcase */}
      <div className="border-b border-border bg-surface-2/60 backdrop-blur-md sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-2.5 overflow-x-auto scrollbar-none">
            <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-muted mr-1 hidden sm:inline-flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span>Showcase Labs:</span>
              </span>

              {tabs.map((tab) => {
                const isActive =
                  tab.href === '/demo' ? pathname === '/demo' : pathname.startsWith(tab.href)
                const Icon = tab.icon

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap ${
                      isActive
                        ? tab.activeColor
                        : 'border-transparent text-muted hover:text-text hover:bg-surface'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full font-mono bg-surface-3/80 text-muted">
                        {tab.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>

            <div className="hidden lg:flex items-center gap-2 text-[11px] text-muted font-mono shrink-0">
              <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
              <span>PayPal Sandbox Rails Active</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1">{children}</div>
    </div>
  )
}
