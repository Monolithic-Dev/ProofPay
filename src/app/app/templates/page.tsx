'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/common/PageShell'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { formatUsd } from '@/lib/format'
import {
  FileCode,
  Sparkles,
  Layers,
  ArrowRight,
  CheckCircle2,
  Database,
  PenTool,
  Globe,
  Sliders,
  DollarSign,
  Clock,
  ShieldCheck,
  Plus,
  X,
} from 'lucide-react'

interface TemplateVariable {
  key: string
  label: string
  type: 'string' | 'number'
  default: any
}

interface ContractTemplate {
  id: string
  slug: string
  name: string
  category: string
  description: string
  contract_json: any
  variables?: TemplateVariable[]
  is_system: boolean
}

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')

  // Selected template for variable configuration modal
  const [activeTemplate, setActiveTemplate] = useState<ContractTemplate | null>(null)
  const [varValues, setVarValues] = useState<Record<string, any>>({})
  const [sellerEmail, setSellerEmail] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTemplates() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/v1/templates', { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load templates')
        const data = await res.json()
        setTemplates(data.templates || [])
      } catch (err: any) {
        setError(err.message || 'Error loading templates')
      } finally {
        setIsLoading(false)
      }
    }
    loadTemplates()
  }, [])

  const handleOpenTemplateModal = (t: ContractTemplate) => {
    setActiveTemplate(t)
    const initialVars: Record<string, any> = {}
    if (t.variables) {
      for (const v of t.variables) {
        initialVars[v.key] = v.default
      }
    }
    setVarValues(initialVars)
    setSellerEmail('')
    setCreateError(null)
  }

  const handleCreateFromTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTemplate) return

    setCreateError(null)
    setIsCreating(true)

    try {
      // Substitute variables in the template json
      const baseContract = JSON.parse(JSON.stringify(activeTemplate.contract_json))

      // Update title if customized
      if (varValues.title) {
        baseContract.title = varValues.title
      }

      // If amounts or targets were supplied, scale milestones accordingly
      if (baseContract.milestones && baseContract.milestones.length > 0) {
        if (varValues.amount_minor_1 && baseContract.milestones[0]) {
          baseContract.milestones[0].amount_minor = Number(varValues.amount_minor_1)
        }
        if (varValues.amount_minor_2 && baseContract.milestones[1]) {
          baseContract.milestones[1].amount_minor = Number(varValues.amount_minor_2)
        }
        if (varValues.amount_minor_3 && baseContract.milestones[2]) {
          baseContract.milestones[2].amount_minor = Number(varValues.amount_minor_3)
        }

        // Recompute total
        const total = baseContract.milestones.reduce(
          (sum: number, m: any) => sum + (m.amount_minor || 0),
          0
        )
        baseContract.total_minor = total
      }

      const payload = {
        title: baseContract.title || activeTemplate.name,
        seller_email: sellerEmail.trim() || 'seller@sandbox.proofpay.io',
        currency: baseContract.currency || 'USD',
        milestones: baseContract.milestones,
      }

      const res = await fetch('/api/v1/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Failed to instantiate template')
      }

      const created = await res.json()
      const contractId = created.contract?.id || created.id
      router.push(`/contracts/${contractId}`)
    } catch (err: any) {
      setCreateError(err.message || 'Could not create contract from template')
      setIsCreating(false)
    }
  }

  const categories = ['ALL', ...Array.from(new Set(templates.map((t) => t.category)))]

  const filteredTemplates = templates.filter((t) => {
    if (selectedCategory === 'ALL') return true
    return t.category.toLowerCase() === selectedCategory.toLowerCase()
  })

  if (isLoading) {
    return (
      <PageShell title="Contract Templates">
        <LoadingBlock message="Loading pre-built smart templates and organizational standards…" />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell title="Contract Templates">
        <ErrorState
          title="Could not load templates"
          message={error}
          onRetry={() => window.location.reload()}
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Contract Templates Library"
      subtitle="Standardized agreement structures with pre-configured automated verification criteria, rule checks, and milestone funding schedules."
      actions={
        <Link
          href="/studio"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface border border-border text-xs font-semibold text-text hover:bg-surface-2 transition-colors shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-brand" />
          <span>Draft from AI Prompt</span>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-xl border border-border text-xs font-medium self-start overflow-x-auto max-w-full">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-surface text-text shadow-xs font-semibold'
                  : 'text-muted hover:text-text'
              }`}
            >
              {cat === 'ALL' ? 'All Templates' : cat}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Custom Blank Canvas Option */}
          <div className="p-6 rounded-2xl bg-surface border-2 border-dashed border-border hover:border-brand/40 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center mb-4">
                <Plus className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-text mb-1 group-hover:text-brand transition-colors">
                Blank Agreement
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Start from scratch with custom milestone scopes, custom deliverable formats, and rules-based verification policies.
              </p>
            </div>
            <div className="pt-6">
              <Link
                href="/studio"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <span>Open Blank Studio</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Standard Templates */}
          {filteredTemplates.map((template) => {
            const milestones = template.contract_json?.milestones || []
            const totalMinor = template.contract_json?.total_minor || 0

            return (
              <div
                key={template.id}
                className="p-6 rounded-2xl bg-surface border border-border shadow-sm flex flex-col justify-between hover:border-brand/40 transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-brand">
                      {template.category.toLowerCase().includes('data') ? (
                        <Database className="w-5 h-5" />
                      ) : template.category.toLowerCase().includes('content') ? (
                        <PenTool className="w-5 h-5" />
                      ) : (
                        <Globe className="w-5 h-5" />
                      )}
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                      {template.category}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-text mb-1 group-hover:text-brand transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-xs text-muted leading-relaxed mb-4">
                    {template.description}
                  </p>

                  {/* Milestones Preview List */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-surface-2/60 border border-border/60 text-xs">
                    <div className="text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center justify-between">
                      <span>{milestones.length} Milestones</span>
                      <span className="text-text font-bold">{formatUsd(totalMinor)}</span>
                    </div>
                    <div className="space-y-1 pt-1">
                      {milestones.map((m: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-[11px]">
                          <span className="text-muted truncate max-w-[180px]">
                            {idx + 1}. {m.title}
                          </span>
                          <span className="text-text font-mono">{formatUsd(m.amount_minor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Auto-verify enabled</span>
                  </span>
                  <button
                    onClick={() => handleOpenTemplateModal(template)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    <span>Use Template</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Template Configuration & Creation Modal */}
        {activeTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand/10 text-brand">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text">Instantiate {activeTemplate.name}</h3>
                    <p className="text-[11px] text-muted">Configure variables and counterparty details</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTemplate(null)}
                  className="p-1 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateFromTemplate} className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                {createError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {createError}
                  </div>
                )}

                {/* Agreement Title */}
                <div>
                  <label className="block font-medium text-text mb-1">Agreement Title *</label>
                  <input
                    type="text"
                    required
                    value={varValues.title || activeTemplate.name}
                    onChange={(e) => setVarValues({ ...varValues, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text focus:outline-none focus:border-brand transition-colors"
                  />
                </div>

                {/* Counterparty / Seller Email */}
                <div>
                  <label className="block font-medium text-text mb-1">Seller / Vendor Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. seller@sandbox.proofpay.io"
                    value={sellerEmail}
                    onChange={(e) => setSellerEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text placeholder-muted focus:outline-none focus:border-brand transition-colors"
                  />
                  <p className="text-[10px] text-muted mt-1">
                    An acceptance invite with cryptographically locked criteria will be sent to this email.
                  </p>
                </div>

                {/* Milestone Amount Customization */}
                <div className="pt-2 border-t border-border space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    Milestone Funding Values (USD)
                  </div>
                  {(activeTemplate.contract_json?.milestones || []).map((m: any, idx: number) => {
                    const varKey = `amount_minor_${idx + 1}`
                    const currentVal = varValues[varKey] !== undefined ? varValues[varKey] : m.amount_minor

                    return (
                      <div key={idx} className="flex items-center justify-between gap-3 bg-surface-2 p-2.5 rounded-xl border border-border/80">
                        <div className="text-xs">
                          <p className="font-semibold text-text">{idx + 1}. {m.title}</p>
                          <p className="text-[10px] text-muted">{m.criteria?.length || 0} automated verification criteria</p>
                        </div>
                        <div className="flex items-center gap-1.5 w-32">
                          <span className="text-muted text-xs">$</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={currentVal / 100}
                            onChange={(e) =>
                              setVarValues({
                                ...varValues,
                                [varKey]: Math.round(Number(e.target.value) * 100),
                              })
                            }
                            className="w-full px-2 py-1 text-xs rounded-lg bg-surface border border-border text-text text-right font-mono focus:outline-none focus:border-brand"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Honest Explainer */}
                <div className="p-3 rounded-xl bg-brand/5 border border-brand/20 text-[11px] text-muted leading-relaxed">
                  <span className="font-semibold text-text">PayPal Authorization: </span>
                  Creating this agreement drafts the immutable milestone ledger. Once the seller accepts, you can authorize the PayPal hold directly.
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setActiveTemplate(null)}
                    className="px-4 py-2 rounded-xl bg-surface-2 text-text font-medium hover:bg-surface-2/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold shadow-md shadow-brand/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isCreating ? (
                      'Creating Agreement…'
                    ) : (
                      <>
                        <span>Create Agreement</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
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
