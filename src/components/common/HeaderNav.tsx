'use client'

import React from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/query'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { User, Bot } from 'lucide-react'

export function HeaderNav() {
  const { data: user } = useCurrentUser()

  return (
    <nav className="flex items-center space-x-5 text-sm font-medium">
      <Link href="/studio" className="text-muted hover:text-text transition-colors">
        Studio
      </Link>
      <Link href="/settings/api-keys" className="text-muted hover:text-text transition-colors">
        API Keys
      </Link>
      <Link href="/#judge-mode" className="text-muted hover:text-text transition-colors">
        Judge Mode
      </Link>

      <div className="h-4 w-[1px] bg-border" />

      {user ? (
        <Link
          href="/#judge-mode"
          title="Click to switch persona in Judge Mode"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-2 border border-border text-xs text-text hover:border-brand/40 transition-colors"
        >
          {user.is_agent ? (
            <Bot className="w-3.5 h-3.5 text-brand" />
          ) : (
            <User className="w-3.5 h-3.5 text-muted" />
          )}
          <span className="font-medium max-w-[120px] truncate">{user.display_name}</span>
          <span className="text-[10px] text-muted capitalize">({user.role})</span>
        </Link>
      ) : null}

      <ThemeToggle />
    </nav>
  )
}
