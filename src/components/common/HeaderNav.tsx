'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCurrentUser } from '@/lib/query'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { NotificationBell } from '@/components/common/NotificationBell'
import { CommandPalette } from '@/components/common/CommandPalette'
import {
  User,
  ChevronDown,
  Sparkles,
} from 'lucide-react'

export function HeaderNav() {
  const { data: user } = useCurrentUser()
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [demoMenuOpen, setDemoMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const demoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
      if (demoRef.current && !demoRef.current.contains(event.target as Node)) {
        setDemoMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const mainLinks = [
    { href: '/app', label: 'Dashboard' },
    { href: '/contracts', label: 'Agreements' },
    { href: '/app/payments', label: 'Payments' },
    { href: '/verify', label: 'Verify' },
  ]

  const moreLinks = [
    { href: '/inbox', label: 'Inbox & Approvals' },
    { href: '/ledger', label: 'Merkle Ledger' },
    { href: '/app/security', label: 'Security Center' },
    { href: '/app/templates', label: 'Smart Templates' },
    { href: '/app/counterparties', label: 'Contacts' },
    { href: '/app/developers', label: 'Developers & MCP' },
    { href: '/trust', label: 'Trust & Custody' },
    { href: '/transparency', label: 'Transparency' },
    { href: '/status', label: 'System Status' },
    { href: '/help', label: 'Help' },
  ]

  const demoScenarios = [
    {
      href: '/demo/express',
      title: '90s Express Judge',
      desc: 'Instant pre-authorized PayPal hold & fast-path consensus',
      badge: 'Interactive',
    },
    {
      href: '/demo/loophole',
      title: 'Loophole Finder',
      desc: 'Red-team contract criteria with exploits & patch with RFC 6902',
      badge: 'Red-Team',
    },
    {
      href: '/demo/mcp',
      title: 'MCP Agent Simulator',
      desc: 'Claude & Gemini executing tool calls via JSON-RPC',
      badge: 'Autonomous',
    },
    {
      href: '/demo/tribunal',
      title: 'Multi-Agent Tribunal',
      desc: 'Claimant, respondent & arbitrator AI dispute courtroom',
      badge: 'Tribunal',
    },
    {
      href: '/demo/agent-wallet',
      title: 'Agent Spend Guardrails',
      desc: 'Autonomous wallet limits, velocity caps & policies',
      badge: 'Guardrail',
    },
    {
      href: '/demo/lab',
      title: 'Resilience Lab',
      desc: 'Inject PayPal faults & verify money conservation invariants',
      badge: 'Chaos',
    },
  ]

  return (
    <nav className="w-full flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 rounded-2xl bg-surface/80 dark:bg-surface/75 backdrop-blur-2xl border border-border/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] transition-all">
      {/* Brand & Sandbox Pill */}
      <div className="flex items-center space-x-3 shrink-0">
        <Link href="/" className="flex items-center space-x-2 group">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-text text-bg flex items-center justify-center font-black text-xs sm:text-sm tracking-tighter shadow-sm group-hover:scale-105 transition-transform">
            PP
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-text leading-none">
              Proof<span className="text-brand">Pay</span>
            </span>
          </div>
        </Link>

        <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-2 border border-border/80 text-[10px] font-mono font-medium text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>PayPal Sandbox v2</span>
        </span>
      </div>

      {/* Center Links (Linear/Stripe floating dock style) */}
      <div className="hidden md:flex items-center space-x-1 lg:space-x-1.5 px-2 py-1 rounded-xl bg-surface-2/60 border border-border/40">
        {mainLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                isActive
                  ? 'bg-surface text-text shadow-xs font-bold'
                  : 'text-muted hover:text-text hover:bg-surface/50'
              }`}
            >
              {link.label}
            </Link>
          )
        })}

        {/* More Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-muted hover:text-text hover:bg-surface/50 transition-all flex items-center gap-1"
          >
            <span>More</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-2.5 w-56 rounded-2xl bg-surface/95 backdrop-blur-xl border border-border shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-1 divide-y divide-border/40">
              <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted/70">
                Workspace Tools
              </div>
              <div className="py-1">
                {moreLinks.slice(0, 4).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDropdownOpen(false)}
                    className="block px-3.5 py-1.5 text-xs font-medium text-text hover:bg-surface-2 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="py-1">
                {moreLinks.slice(4).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDropdownOpen(false)}
                    className="block px-3.5 py-1.5 text-xs font-medium text-muted hover:text-text hover:bg-surface-2 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Command Palette, Demos, Theme & Auth */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        <CommandPalette />

        {/* Agent Demos Pill */}
        <div className="relative" ref={demoRef}>
          <button
            onClick={() => setDemoMenuOpen(!demoMenuOpen)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide bg-surface-2 hover:bg-surface-3 text-text border border-border/80 shadow-xs transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand" />
            <span className="hidden sm:inline">Demos</span>
            <ChevronDown className={`w-3 h-3 text-muted transition-transform ${demoMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {demoMenuOpen && (
            <div className="absolute top-full right-0 mt-2.5 w-80 rounded-2xl bg-surface/95 backdrop-blur-xl border border-border shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-1 space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                Live PayPal Agent Demos
              </div>
              {demoScenarios.map((demo) => (
                <Link
                  key={demo.href}
                  href={demo.href}
                  onClick={() => setDemoMenuOpen(false)}
                  className="block p-2.5 rounded-xl hover:bg-surface-2 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text group-hover:text-brand transition-colors">
                      {demo.title}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface-3 text-muted">
                      {demo.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted line-clamp-1 mt-0.5">
                    {demo.desc}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1 pl-1 border-l border-border/60">
          <ThemeToggle />
          <NotificationBell />
        </div>

        {/* User Auth: Monochromatic Luxury Action Button */}
        {user ? (
          <Link
            href="/settings"
            className="flex items-center space-x-1.5 pl-1.5 text-xs font-semibold text-text hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-full bg-text text-bg flex items-center justify-center font-bold text-xs uppercase shadow-xs">
              {user.email ? user.email.slice(0, 1) : <User className="w-3.5 h-3.5" />}
            </div>
          </Link>
        ) : (
          <div className="flex items-center space-x-1.5 pl-1.5">
            <Link
              href="/auth/login"
              className="hidden sm:inline-block px-3 py-1.5 rounded-xl text-xs font-medium text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/login?tab=register"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-text text-bg hover:opacity-90 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
