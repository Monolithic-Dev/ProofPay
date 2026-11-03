'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  FileText,
  Sparkles,
  Layers,
  Inbox,
  Settings,
  CreditCard,
  KeyRound,
  Play,
  ArrowRight,
  PlusCircle,
  HelpCircle,
  DollarSign,
  Server,
} from 'lucide-react'
import { useContracts } from '@/lib/query'
import { formatUsd } from '@/lib/format'

interface PaletteItem {
  id: string
  title: string
  subtitle?: string
  href: string
  icon: React.ComponentType<any>
  category: string
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const { data: contracts = [] } = useContracts()

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Navigation Items
  const navItems: PaletteItem[] = [
    { id: 'contracts', title: 'Contracts & Agreements', href: '/contracts', icon: FileText, category: 'Pages' },
    { id: 'inbox', title: 'Action Inbox', href: '/inbox', icon: Inbox, category: 'Pages' },
    { id: 'studio', title: 'AI Contract Studio', href: '/studio', icon: Sparkles, category: 'Pages' },
    { id: 'ledger', title: 'Financial Audit Ledger (AG Grid)', href: '/ledger', icon: Layers, category: 'Pages' },
    { id: 'settings', title: 'Settings & Profile', href: '/settings', icon: Settings, category: 'Settings' },
    { id: 'team', title: 'Team & Members', href: '/settings/team', icon: Settings, category: 'Settings' },
    { id: 'payments', title: 'Payments & PayPal Gateway', href: '/settings/payments', icon: CreditCard, category: 'Settings' },
    { id: 'apikeys', title: 'API Keys & Autonomous Agents', href: '/settings/api-keys', icon: KeyRound, category: 'Settings' },
    { id: 'demo', title: 'Sandbox Demo Playground', href: '/demo', icon: Play, category: 'Tools' },
    { id: 'docs', title: 'Developer Documentation & MCP', href: '/docs', icon: HelpCircle, category: 'Tools' },
    { id: 'pricing', title: 'Pricing & Fees', href: '/pricing', icon: DollarSign, category: 'Pages' },
    { id: 'admin', title: 'Staff Back-Office Console', href: '/admin', icon: Server, category: 'Tools' },
  ]

  // Filtered Contracts
  const filteredContracts = contracts
    .filter((c: any) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.status.toLowerCase().includes(query.toLowerCase()) ||
      c.id.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 5)
    .map((c: any) => ({
      id: c.id,
      title: c.title,
      subtitle: `${c.status} • ${formatUsd(c.total_minor)}`,
      href: `/contracts/${c.id}`,
      icon: FileText,
      category: 'Contracts',
    }))

  // Filtered Navigation
  const filteredNav = navItems.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  )

  const combinedResults = [...filteredContracts, ...filteredNav]

  const handleSelect = (item: (typeof combinedResults)[0]) => {
    setIsOpen(false)
    router.push(item.href)
  }

  // Keyboard navigation through list
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, combinedResults.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + combinedResults.length) % Math.max(1, combinedResults.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (combinedResults[selectedIndex]) {
        handleSelect(combinedResults[selectedIndex])
      }
    }
  }

  return (
    <>
      {/* Search trigger button in header */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/70 bg-surface-2/60 text-xs text-muted hover:text-text hover:border-brand/40 transition-colors"
        title="Search (⌘K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search…</span>
        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted font-mono">
          ⌘K
        </kbd>
      </button>

      {/* Palette Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
          <div className="bg-surface border border-border rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
            {/* Search Input Bar */}
            <div className="p-4 border-b border-border/60 flex items-center gap-3 bg-surface-subtle/50">
              <Search className="w-5 h-5 text-muted shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedIndex(0)
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Search contracts, pages, settings, or actions…"
                className="w-full bg-transparent text-sm text-text placeholder:text-muted/60 focus:outline-none"
              />
              <kbd className="text-[10px] px-2 py-0.5 rounded bg-surface border border-border text-muted font-mono">
                ESC
              </kbd>
            </div>

            {/* Results List */}
            <div className="max-h-96 overflow-y-auto p-2 space-y-1">
              {combinedResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">
                  No matching results found for "{query}".
                </div>
              ) : (
                combinedResults.map((item, index) => {
                  const Icon = item.icon
                  const isSelected = index === selectedIndex
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-brand text-white shadow-md shadow-brand/20'
                          : 'hover:bg-surface-2/60 text-text'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-surface-2 text-muted'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{item.title}</div>
                          {item.subtitle && (
                            <div
                              className={`text-[11px] truncate ${
                                isSelected ? 'text-white/80' : 'text-muted'
                              }`}
                            >
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-surface border border-border text-muted'
                          }`}
                        >
                          {item.category}
                        </span>
                        <ArrowRight
                          className={`w-3.5 h-3.5 ${
                            isSelected ? 'text-white' : 'text-muted opacity-0 group-hover:opacity-100'
                          }`}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 border-t border-border/40 bg-surface-subtle/30 flex items-center justify-between text-[11px] text-muted px-4">
              <span>Navigate with ↑ ↓ arrows</span>
              <span>Press ↵ to select</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
