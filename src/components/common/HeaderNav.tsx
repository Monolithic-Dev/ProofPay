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
    <div className="w-full flex items-center justify-between">
      {/* Brand & Left Navigation */}
      <div className="flex items-center space-x-6 sm:space-x-8">
        <Link href="/" className="flex items-center space-x-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-text text-bg flex items-center justify-center font-black text-sm tracking-tight shadow-sm group-hover:scale-105 transition-transform">
            PP
          </div>
          <span className="font-extrabold text-base tracking-tight text-text">
            Proof<span className="text-brand">Pay</span>
          </span>
        </Link>

        {/* Primary Links */}
        <nav className="hidden md:flex items-center space-x-1">
          {mainLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  isActive
                    ? 'text-text font-bold bg-surface-2'
                    : 'text-muted hover:text-text hover:bg-surface-2/60'
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
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted hover:text-text hover:bg-surface-2/60 transition-all flex items-center gap-1"
            >
              <span>More</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 rounded-xl bg-surface/95 backdrop-blur-xl border border-border shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-1 divide-y divide-border/40">
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
        </nav>
      </div>

      {/* Right Controls: Featurebase Clean Pattern */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        <CommandPalette />

        {/* Demos Button */}
        <div className="relative" ref={demoRef}>
          <button
            onClick={() => setDemoMenuOpen(!demoMenuOpen)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide text-muted hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand" />
            <span className="hidden sm:inline">Playground</span>
            <ChevronDown className={`w-3 h-3 text-muted transition-transform ${demoMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {demoMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 rounded-xl bg-surface/95 backdrop-blur-xl border border-border shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-1 space-y-1">
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

        {/* Auth / CTA Button */}
        {user ? (
          <Link
            href="/settings"
            className="flex items-center space-x-2 pl-2 text-xs font-semibold text-text hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-full bg-text text-bg flex items-center justify-center font-bold text-xs uppercase shadow-xs">
              {user.email ? user.email.slice(0, 1) : <User className="w-3.5 h-3.5" />}
            </div>
          </Link>
        ) : (
          <div className="flex items-center space-x-2 pl-2">
            <Link
              href="/auth/login"
              className="hidden sm:inline-block px-3 py-1.5 rounded-lg text-xs font-semibold text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/login?tab=register"
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-text text-bg hover:opacity-90 transition-all shadow-sm"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
