'use client'

/**
 * ThemeToggle Component — switches between Light and Dark mode.
 * Persists choice in localStorage and applies .dark class to root element.
 * Implements phase-6-frontend.md §6.5 & ux-flows.md §2.
 */
import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('proofpay-theme') as 'light' | 'dark' | null
    if (stored) {
      setTheme(stored)
      applyTheme(stored)
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark')
      applyTheme('dark')
    }
  }, [])

  const applyTheme = (nextTheme: 'light' | 'dark') => {
    const root = document.documentElement
    if (nextTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('proofpay-theme', nextTheme)
  }

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  if (!mounted) {
    return (
      <div className={`w-8 h-8 rounded-lg bg-surface-2 border border-border ${className}`} />
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={`p-2 rounded-lg border border-border bg-surface text-text hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-brand transition-colors ${className}`}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-warn" />
      ) : (
        <Moon className="w-4 h-4 text-muted" />
      )}
    </button>
  )
}
