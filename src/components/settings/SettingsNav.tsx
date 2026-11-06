'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Users, Building, CreditCard, KeyRound, Zap, Shield } from 'lucide-react'

const navItems = [
  { href: '/settings', label: 'Profile & Security', icon: User, exact: true },
  { href: '/settings/security-center', label: 'Security Center', icon: Shield },
  { href: '/settings/team', label: 'Team & Roles', icon: Users },
  { href: '/settings/workspace', label: 'Workspace Policy', icon: Building },
  { href: '/settings/payments', label: 'Payments & PayPal', icon: CreditCard },
  { href: '/settings/api-keys', label: 'API Keys & Agents', icon: KeyRound },
  { href: '/settings/webhooks', label: 'Webhooks & Zapier', icon: Zap },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <div className="flex border-b border-border/80 gap-2 mb-8 overflow-x-auto pb-px">
      {navItems.map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 whitespace-nowrap ${
              isActive
                ? 'border-brand text-brand bg-brand/5 rounded-t-lg'
                : 'border-transparent text-muted hover:text-text hover:border-border'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
