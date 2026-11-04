'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCurrentUser } from '@/lib/query'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { NotificationBell } from '@/components/common/NotificationBell'
import { CommandPalette } from '@/components/common/CommandPalette'
import { User, Bot, Play } from 'lucide-react'

export function HeaderNav() {
  const { data: user } = useCurrentUser()
  const pathname = usePathname()

  const navLinks = [
    { href: '/app', label: 'Dashboard' },
    { href: '/contracts', label: 'Agreements' },
    { href: '/inbox', label: 'Inbox' },
    { href: '/app/payments', label: 'Payments' },
    { href: '/app/templates', label: 'Templates' },
    { href: '/app/counterparties', label: 'Contacts' },
    { href: '/app/developers', label: 'Developers' },
    { href: '/trust', label: 'Trust' },
    { href: '/verify', label: 'Verify' },
    { href: '/transparency', label: 'Transparency' },
    { href: '/help', label: 'Help' },
    {
      href: '/ledger',
      label: 'Ledger',
      badge: 'AG Grid',
    },
  ]

  return (
    <nav className="flex items-center space-x-3 text-sm font-medium">
      {/* Global Command Palette Search */}
      <CommandPalette />

      {navLinks.map((link) => {
        const isActive = pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`transition-colors flex items-center gap-1.5 ${
              isActive ? 'text-brand font-semibold' : 'text-muted hover:text-text'
            }`}
          >
            <span>{link.label}</span>
            {link.badge && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-brand/10 text-brand font-mono font-medium">
                {link.badge}
              </span>
            )}
          </Link>
        )
      })}

      <Link
        href="/demo"
        className="text-xs px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors flex items-center gap-1 font-medium"
        title="Open Sandbox Playground"
      >
        <Play className="w-3 h-3 fill-amber-300" />
        <span>Demo Sandbox</span>
      </Link>

      <div className="h-4 w-[1px] bg-border" />

      {/* Notifications Drawer */}
      <NotificationBell />

      {user ? (
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            title="View Profile & Settings"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-2 border border-border text-xs text-text hover:border-brand/40 transition-colors"
          >
            {user.is_agent ? (
              <Bot className="w-3.5 h-3.5 text-brand" />
            ) : (
              <User className="w-3.5 h-3.5 text-muted" />
            )}
            <span className="font-medium max-w-[120px] truncate">{user.display_name}</span>
            <span className="text-[10px] text-brand uppercase font-semibold">({user.role})</span>
          </Link>
        </div>
      ) : (
        <Link
          href="/auth/login"
          className="inline-flex items-center px-3 py-1 rounded-md bg-brand text-white text-xs font-medium hover:opacity-95 transition-opacity"
        >
          Sign In
        </Link>
      )}

      <ThemeToggle />
    </nav>
  )
}
