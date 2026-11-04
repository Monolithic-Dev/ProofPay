'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import {
  Users,
  UserPlus,
  Mail,
  FileText,
  Plus,
  Search,
  ExternalLink,
  Copy,
  Check,
  Building,
  ArrowRight,
  ShieldCheck,
  X,
} from 'lucide-react'

interface Counterparty {
  id: string
  name: string
  email: string
  notes?: string | null
  organization_id: string
  counterparty_org_id?: string | null
  created_at: string
}

export default function CounterpartiesPage() {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)

  // Form state for adding counterparty
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchCounterparties = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/counterparties', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load counterparties')
      const data = await res.json()
      setCounterparties(data.counterparties || [])
    } catch (err: any) {
      setError(err.message || 'Error loading counterparties')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCounterparties()
  }, [])

  const handleCopyEmail = (emailStr: string) => {
    navigator.clipboard.writeText(emailStr)
    setCopiedEmail(emailStr)
    setTimeout(() => setCopiedEmail(null), 2000)
  }

  const handleAddCounterparty = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!name.trim() || !email.trim()) {
      setFormError('Name and email are required')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/v1/counterparties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Failed to add counterparty')
      }

      // Reset and refresh
      setName('')
      setEmail('')
      setNotes('')
      setIsModalOpen(false)
      await fetchCounterparties()
    } catch (err: any) {
      setFormError(err.message || 'Could not save counterparty')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredCounterparties = counterparties.filter((cp) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return cp.name.toLowerCase().includes(q) || cp.email.toLowerCase().includes(q)
  })

  if (isLoading) {
    return (
      <PageShell title="Counterparties">
        <LoadingBlock message="Loading trusted clients, agencies, and sellers…" />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell title="Counterparties">
        <ErrorState
          title="Could not load counterparties"
          message={error}
          onRetry={fetchCounterparties}
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Counterparties Directory"
      subtitle="Manage external clients, agencies, freelancers, and AI vendors you collaborate and trade with."
      actions={
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-md shadow-brand/20 transition-all"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add Counterparty</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Search & Stats Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">
              Total Contacts: <strong className="text-text font-semibold">{counterparties.length}</strong>
            </span>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-surface border border-border text-text placeholder-muted focus:outline-none focus:border-brand transition-colors"
            />
          </div>
        </div>

        {/* Counterparties List */}
        {filteredCounterparties.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3 text-muted">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-text mb-1">No counterparties found</h3>
            <p className="text-xs text-muted max-w-sm mx-auto mb-5 leading-relaxed">
              {searchQuery
                ? 'No contacts matched your search query.'
                : 'Save buyers, agencies, or AI providers here for one-click agreement invites and PayPal hold routing.'}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Your First Counterparty</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCounterparties.map((cp) => {
              const initials = cp.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()

              return (
                <div
                  key={cp.id}
                  className="p-5 rounded-2xl bg-surface border border-border shadow-sm flex flex-col justify-between hover:border-brand/30 transition-all group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center font-bold text-xs text-brand">
                          {initials || 'CP'}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text group-hover:text-brand transition-colors">
                            {cp.name}
                          </h4>
                          <span className="text-[10px] text-muted font-medium flex items-center gap-1">
                            <Building className="w-2.5 h-2.5" />
                            <span>External Partner</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs pt-1">
                      {/* Email Row with Copy Button */}
                      <div className="flex items-center justify-between text-muted bg-surface-2 p-2 rounded-xl border border-border/60">
                        <span className="truncate max-w-[190px] text-text font-mono text-[11px]">
                          {cp.email}
                        </span>
                        <button
                          onClick={() => handleCopyEmail(cp.email)}
                          className="hover:text-text transition-colors p-1"
                          title="Copy email address"
                        >
                          {copiedEmail === cp.email ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 opacity-60" />
                          )}
                        </button>
                      </div>

                      {/* Notes if any */}
                      {cp.notes && (
                        <p className="text-[11px] text-muted line-clamp-2 italic pt-1">
                          &quot;{cp.notes}&quot;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-5 pt-3 border-t border-border/80 flex items-center justify-between">
                    <span className="text-[10px] text-muted">
                      Added {new Date(cp.created_at).toLocaleDateString()}
                    </span>
                    <Link
                      href={`/studio?seller_email=${encodeURIComponent(cp.email)}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                    >
                      <span>Create Agreement</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add Counterparty Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand/10 text-brand">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text">Add New Counterparty</h3>
                    <p className="text-[11px] text-muted">Save partner details for milestone contracts</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddCounterparty} className="p-5 space-y-4 text-xs">
                {formError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block font-medium text-text mb-1">Full Name or Agency Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Rivera or Apex AI Labs"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text placeholder-muted focus:outline-none focus:border-brand transition-colors"
                  />
                </div>

                <div>
                  <label className="block font-medium text-text mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. alex@apexlabs.io"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text placeholder-muted focus:outline-none focus:border-brand transition-colors"
                  />
                  <p className="text-[10px] text-muted mt-1">
                    Agreement invitations and PayPal notifications will be routed to this address.
                  </p>
                </div>

                <div>
                  <label className="block font-medium text-text mb-1">Notes / Relationship (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Fine-tuning vendor, delivery via GitHub PRs"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text placeholder-muted focus:outline-none focus:border-brand transition-colors resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-surface-2 text-text font-medium hover:bg-surface-2/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold shadow-md shadow-brand/20 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving…' : 'Save Counterparty'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
