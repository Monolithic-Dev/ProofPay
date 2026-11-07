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
    { href: '/app/security', label: 'Security' },
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
        href="/demo/mcp"
        className="px-2 py-1 rounded-md text-xs font-semibold bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 transition-colors flex items-center gap-1.5"
      >
        <Bot className="w-3 h-3" />
        <span>MCP</span>
      </Link>

      <Link
        href="/demo"
        className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 transition-colors flex items-center gap-1.5"
      >
        <Play className="w-3 h-3 fill-amber-500" />
        <span>Sandbox Playground</span>
      </Link>

      <div className="flex items-center space-x-2 pl-2 border-l border-border">
        <ThemeToggle />
        <NotificationBell />

        {user && (
          <Link
            href="/settings"
            className="flex items-center space-x-2 pl-2 text-xs text-muted hover:text-text transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs uppercase border border-brand/20">
              {user.display_name ? user.display_name.slice(0, 2) : 'ME'}
            </div>
          </Link>
        )}
      </div>
    </nav>
  )
}
