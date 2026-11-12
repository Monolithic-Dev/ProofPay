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
    },
    {
      href: '/demo/express',
      label: '90s Express Lane',
      badge: 'Real Capture',
      icon: Zap,
    },
    {
      href: '/demo/loophole',
      label: 'Loophole Finder',
      badge: 'Red-Team N1',
      icon: SearchCode,
    },
    {
      href: '/demo/mcp',
      label: 'MCP Agent Simulator',
      badge: 'JSON-RPC',
      icon: Cpu,
    },
    {
      href: '/demo/tribunal',
      label: 'AI Dispute Tribunal',
      badge: 'Arbitration',
      icon: Scale,
    },
    {
      href: '/demo/agent-wallet',
      label: 'Agent Spend Policy',
      badge: 'Guardrails',
      icon: Wallet,
    },
    {
      href: '/demo/lab',
      label: 'Resilience Lab',
      badge: 'Faults',
      icon: ShieldAlert,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sub-header Navigation Bar: Clean wrap; sticky only on md+ viewports to preserve mobile scroll area */}
      <div className="border-b border-border/70 bg-surface/80 backdrop-blur-xl md:sticky md:top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted/70 mr-1.5 hidden lg:inline-flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              <span>Showcase Labs</span>
            </span>

            {tabs.map((tab) => {
              const isActive =
                tab.href === '/demo' ? pathname === '/demo' : pathname.startsWith(tab.href)
              const Icon = tab.icon

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-surface-2 text-text border border-border/80 shadow-xs'
                      : 'text-muted hover:text-text hover:bg-surface-2/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand' : 'text-muted/70'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-surface-3/60 text-muted font-medium">
                      {tab.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex-1">{children}</div>
    </div>
  )
}
