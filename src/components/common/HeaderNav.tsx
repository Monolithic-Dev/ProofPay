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
  LayoutDashboard,
  FileText,
  CreditCard,
  Shield,
  Layers,
  Users,
  Terminal,
  Scale,
  Sparkles,
  LogOut,
  ExternalLink,
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
    { href: '/inbox', label: 'Inbox' },
    { href: '/app/payments', label: 'Payments' },
    { href: '/app/security', label: 'Security' },
    { href: '/verify', label: 'Verify' },
    { href: '/ledger', label: 'Ledger' },
  ]

  const moreLinks = [
    { href: '/app/templates', label: 'Templates' },
    { href: '/app/counterparties', label: 'Contacts' },
    { href: '/app/developers', label: 'Developers' },
    { href: '/trust', label: 'Trust & Custody' },
    { href: '/transparency', label: 'Transparency' },
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
      href: '/demo/mcp',
      title: 'MCP Agent Simulator',
      desc: 'Claude & Gemini executing tool calls via JSON-RPC',
      badge: 'Autonomous',
    },
    {
      href: '/demo/tribunal',
      title: 'Multi-Agent Tribunal',
      desc: 'Claimant, respondent & arbitrator AI binding courtroom',
      badge: 'Tribunal',
    },
    {
      href: '/demo/agent-wallet',
      title: 'Agent Spend Guardrails',
      desc: 'Autonomous wallet limits, velocity caps & policies',
      badge: 'Guardrail',
    },
  ]

  return (
    <nav className="flex items-center space-x-2 text-sm font-medium">
      {/* Command Palette */}
      <CommandPalette />

      {/* Primary Navigation Links */}
      <div className="hidden lg:flex items-center space-x-1">
        {mainLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                isActive
                  ? 'bg-brand/10 text-brand dark:text-sky-400 font-bold shadow-sm'
                  : 'text-muted hover:text-text hover:bg-surface-2'
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
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1"
          >
            <span>More</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 rounded-xl bg-surface border border-border shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
              {moreLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDropdownOpen(false)}
                  className="block px-3.5 py-2 text-xs font-medium text-text hover:bg-brand/10 hover:text-brand transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Agent Demos Dropdown */}
      <div className="relative" ref={demoRef}>
        <button
          onClick={() => setDemoMenuOpen(!demoMenuOpen)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide bg-gradient-to-r from-sky-500/10 via-purple-500/10 to-emerald-500/10 hover:from-sky-500/20 hover:to-emerald-500/20 text-text border border-sky-500/30 shadow-sm transition-all flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          <span>Agent Demos</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${demoMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {demoMenuOpen && (
          <div className="absolute top-full right-0 mt-2 w-72 rounded-2xl bg-surface border border-border shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-1 space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              Live PayPal Agent Demonstrations
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
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand/10 text-brand">
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

      {/* Right Controls: Theme Toggle & User Auth */}
      <div className="flex items-center space-x-2 pl-2 border-l border-border">
        <ThemeToggle />
        <NotificationBell />

        {user ? (
          <Link
            href="/settings"
            className="flex items-center space-x-2 pl-2 text-xs font-semibold text-text hover:text-brand transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-brand/15 text-brand border border-brand/30 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
              {user.email ? user.email.slice(0, 1) : <User className="w-3.5 h-3.5" />}
            </div>
          </Link>
        ) : (
          <div className="flex items-center space-x-1.5 pl-2">
            <Link
              href="/auth/login"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/login?tab=register"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand text-white hover:bg-brand/90 shadow-sm transition-all"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
