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
  SlidersHorizontal,
  Menu,
  X,
} from 'lucide-react'

export function HeaderNav() {
  const { data: user } = useCurrentUser()
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [demoMenuOpen, setDemoMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
    setDropdownOpen(false)
    setDemoMenuOpen(false)
  }, [pathname])

  const mainLinks = [
    { href: '/app', label: 'Dashboard', exact: true },
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
      title: '90s Express Lane',
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
      desc: 'AI agents (Anthropic Claude, Groq/Qwen) calling MCP tools via JSON-RPC',
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
    <div className="w-full relative">
      <div className="w-full flex items-center justify-between gap-2">
        {/* Brand & Left Navigation */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 -ml-1 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors focus:outline-none"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link href="/" className="flex items-center space-x-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-text text-bg flex items-center justify-center font-black text-sm tracking-tight shadow-sm group-hover:scale-105 transition-transform">
              PP
            </div>
            <span className="font-extrabold text-base tracking-tight text-text whitespace-nowrap">
              Proof<span className="text-brand">Pay</span>
            </span>
          </Link>

          {/* Primary Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {mainLinks.map((link) => {
              const isActive = link.exact
                ? pathname === link.href
                : pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href + '/'))
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${
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
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted hover:text-text hover:bg-surface-2/60 transition-all flex items-center gap-1 whitespace-nowrap"
              >
                <span>More</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 max-w-[calc(100vw-1.5rem)] rounded-xl bg-surface border border-border shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-1 divide-y divide-border/40">
                  <div className="px-3.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-muted/70">
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

        {/* Right Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
          <CommandPalette />

          {/* Demos Button */}
          <div className="relative" ref={demoRef}>
            <button
              type="button"
              onClick={() => setDemoMenuOpen(!demoMenuOpen)}
              aria-label="Open Sandbox Playground Menu"
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide text-muted hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted" />
              <span className="hidden sm:inline">Playground</span>
              <ChevronDown className={`w-3 h-3 text-muted transition-transform ${demoMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {demoMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl bg-surface border border-border shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-1 space-y-1">
                <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-muted border-b border-border/40 mb-1">
                  Live PayPal Agent Demos
                </div>
                {demoScenarios.map((demo) => (
                  <Link
                    key={demo.href}
                    href={demo.href}
                    onClick={() => setDemoMenuOpen(false)}
                    className="block p-2.5 rounded-lg hover:bg-surface-2 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-text group-hover:text-brand transition-colors truncate">
                        {demo.title}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-2 border border-border/70 text-muted shrink-0">
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
              className="flex items-center space-x-2 pl-1 sm:pl-2 text-xs font-semibold text-text hover:opacity-80 transition-opacity shrink-0"
              title={user.display_name || user.email}
            >
              <div className="w-7 h-7 rounded-full bg-text text-bg flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                {user.email ? user.email.slice(0, 1) : <User className="w-3.5 h-3.5" />}
              </div>
            </Link>
          ) : (
            <div className="flex items-center space-x-2 pl-1 sm:pl-2 shrink-0">
              <Link
                href="/auth/login"
                className="hidden sm:inline-block px-3 py-1.5 rounded-lg text-xs font-semibold text-muted hover:text-text hover:bg-surface-2 transition-colors whitespace-nowrap"
              >
                Sign In
              </Link>
              <Link
                href="/auth/login?tab=register"
                className="px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold bg-text text-bg hover:opacity-90 transition-all shadow-sm whitespace-nowrap shrink-0"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 mt-2 rounded-2xl bg-surface border border-border shadow-2xl p-4 z-50 space-y-4 animate-in fade-in slide-in-from-top-1 max-h-[calc(100vh-5rem)] overflow-y-auto">
          <div className="space-y-1">
            <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
              Primary Navigation
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {mainLinks.map((link) => {
                const isActive = link.exact
                  ? pathname === link.href
                  : pathname === link.href || pathname.startsWith(link.href + '/')
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-brand/10 text-brand border border-brand/20'
                        : 'bg-surface-2 text-text hover:bg-surface-3'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="space-y-1 border-t border-border/60 pt-3">
            <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
              Workspace &amp; Trust Tools
            </div>
            <div className="grid grid-cols-2 gap-1">
              {moreLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-text hover:bg-surface-2 transition-colors truncate"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {!user && (
            <div className="border-t border-border/60 pt-3 flex items-center gap-2">
              <Link
                href="/auth/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center px-3 py-2 rounded-xl border border-border bg-surface-2 text-xs font-semibold text-text"
              >
                Sign In
              </Link>
              <Link
                href="/demo"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center px-3 py-2 rounded-xl bg-brand text-white text-xs font-semibold"
              >
                Playground
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
