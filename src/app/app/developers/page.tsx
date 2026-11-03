'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { formatUsd } from '@/lib/format'
import {
  Key,
  Bot,
  Terminal,
  Webhook,
  Plus,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  Lock,
  Layers,
  Sparkles,
  AlertCircle,
  FileCode,
  DollarSign,
  X,
} from 'lucide-react'

interface ServiceAccount {
  id: string
  name: string
  description?: string | null
  scopes: string[]
  max_contract_total_minor?: number | null
  max_open_holds_minor?: number | null
  is_active: boolean
  created_at: string
}

interface ApiKey {
  id: string
  label: string
  key_prefix: string
  created_at: string
  last_used_at?: string | null
}

export default function DevelopersPage() {
  const [activeTab, setActiveTab] = useState<'service_accounts' | 'api_keys' | 'quickstart' | 'webhooks'>('service_accounts')
  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccount[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)

  // Service Account Modal
  const [isSaModalOpen, setIsSaModalOpen] = useState(false)
  const [saName, setSaName] = useState('')
  const [saDesc, setSaDesc] = useState('')
  const [saScopes, setSaScopes] = useState<string[]>([
    'contracts:read',
    'contracts:write',
    'submissions:write',
    'verification:read',
  ])
  const [saMaxContract, setSaMaxContract] = useState<number>(500)
  const [saMaxHolds, setSaMaxHolds] = useState<number>(2000)
  const [isSubmittingSa, setIsSubmittingSa] = useState(false)
  const [saError, setSaError] = useState<string | null>(null)

  // API Key Modal
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false)
  const [keyLabel, setKeyLabel] = useState('')
  const [newRawKey, setNewRawKey] = useState<string | null>(null)
  const [isSubmittingKey, setIsSubmittingKey] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [saRes, keyRes] = await Promise.all([
        fetch('/api/v1/service-accounts', { credentials: 'include' }),
        fetch('/api/v1/me/api-keys', { credentials: 'include' }),
      ])

      if (saRes.ok) {
        const saData = await saRes.json()
        setServiceAccounts(saData.service_accounts || [])
      }

      if (keyRes.ok) {
        const keyData = await keyRes.json()
        setApiKeys(keyData.api_keys || [])
      }
    } catch (err: any) {
      setError(err.message || 'Error loading developer settings')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCopy = (text: string, snippetId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSnippet(snippetId)
    setTimeout(() => setCopiedSnippet(null), 2000)
  }

  const handleCreateServiceAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaError(null)
    if (!saName.trim()) {
      setSaError('Name is required')
      return
    }

    setIsSubmittingSa(true)
    try {
      const res = await fetch('/api/v1/service-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: saName.trim(),
          description: saDesc.trim() || undefined,
          scopes: saScopes,
          max_contract_total_minor: saMaxContract ? Math.round(saMaxContract * 100) : undefined,
          max_open_holds_minor: saMaxHolds ? Math.round(saMaxHolds * 100) : undefined,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Failed to create service account')
      }

      setIsSaModalOpen(false)
      setSaName('')
      setSaDesc('')
      await fetchData()
    } catch (err: any) {
      setSaError(err.message || 'Error creating service account')
    } finally {
      setIsSubmittingSa(false)
    }
  }

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setKeyError(null)
    setIsSubmittingKey(true)

    try {
      const res = await fetch('/api/v1/me/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label: keyLabel.trim() || 'API Key' }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Failed to generate API key')
      }

      const created = await res.json()
      setNewRawKey(created.key || created.api_key || 'sk_live_generated_key_demo')
      setKeyLabel('')
      await fetchData()
    } catch (err: any) {
      setKeyError(err.message || 'Error generating API key')
    } finally {
      setIsSubmittingKey(false)
    }
  }

  const availableScopes = [
    { id: 'contracts:read', label: 'contracts:read — View contracts and milestone states' },
    { id: 'contracts:write', label: 'contracts:write — Propose new milestone agreements' },
    { id: 'funding:link', label: 'funding:link — Generate shareable PayPal authorization links' },
    { id: 'submissions:write', label: 'submissions:write — Submit deliverable artifacts for verification' },
    { id: 'verification:read', label: 'verification:read — Read criteria validation reports & hashes' },
  ]

  const mcpConfigSnippet = `{
  "mcpServers": {
    "proofpay": {
      "command": "npx",
      "args": ["-y", "@proofpay/mcp-server"],
      "env": {
        "PROOFPAY_API_KEY": "${apiKeys[0]?.key_prefix ? `${apiKeys[0].key_prefix}...` : 'sk_sandbox_your_key'}",
        "PROOFPAY_BASE_URL": "http://localhost:3000"
      }
    }
  }
}`

  const curlCreateSnippet = `curl -X POST http://localhost:3000/api/v1/contracts \\
  -H "Authorization: Bearer sk_sandbox_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Autonomous Data Pipeline Agreement",
    "seller_email": "seller@apex.io",
    "currency": "USD",
    "milestones": [
      {
        "title": "Cleaned Dataset Validation",
        "amount_minor": 15000,
        "deliverable_type": "DATASET",
        "criteria": [
          { "type": "ROW_COUNT_MIN", "threshold": 100 },
          { "type": "SCHEMA_MATCH", "schema_name": "ecommerce_v1" }
        ]
      }
    ]
  }'`

  if (isLoading) {
    return (
      <PageShell title="Developers & Machine Agents">
        <LoadingBlock message="Loading API keys, agent permissions, and SDK configs…" />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Developers & Machine Agents"
      subtitle="Equip autonomous AI agents with scoped identities, budget caps, PayPal authorization links, and MCP tooling."
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-border text-xs font-semibold text-text hover:bg-surface-2 transition-colors shadow-sm"
          >
            <FileCode className="w-3.5 h-3.5 text-brand" />
            <span>API Docs</span>
          </Link>
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-md shadow-brand/20 transition-all"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Create API Key</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-xl border border-border text-xs font-medium self-start">
          <button
            onClick={() => setActiveTab('service_accounts')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'service_accounts'
                ? 'bg-surface text-text shadow-xs font-semibold'
                : 'text-muted hover:text-text'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Service Accounts ({serviceAccounts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('api_keys')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'api_keys'
                ? 'bg-surface text-text shadow-xs font-semibold'
                : 'text-muted hover:text-text'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys ({apiKeys.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('quickstart')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'quickstart'
                ? 'bg-surface text-text shadow-xs font-semibold'
                : 'text-muted hover:text-text'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Quickstart & MCP</span>
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'webhooks'
                ? 'bg-surface text-text shadow-xs font-semibold'
                : 'text-muted hover:text-text'
            }`}
          >
            <Webhook className="w-3.5 h-3.5" />
            <span>Webhooks</span>
          </button>
        </div>

        {/* Tab 1: Service Accounts */}
        {activeTab === 'service_accounts' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text">Autonomous AI Machine Identities</h3>
                <p className="text-xs text-muted">
                  Service accounts allow autonomous agents (e.g. LangChain, CrewAI, AutoGen) to draft agreements and submit deliverables under strict budget caps.
                </p>
              </div>
              <button
                onClick={() => setIsSaModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface border border-border text-xs font-semibold text-text hover:bg-surface-2 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-brand" />
                <span>New Service Account</span>
              </button>
            </div>

            {serviceAccounts.length === 0 ? (
              <div className="p-10 rounded-2xl bg-surface border border-border text-center shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-text mb-1">No service accounts registered</h4>
                <p className="text-xs text-muted max-w-md mx-auto mb-4">
                  Create a dedicated identity for your background agents to interact with ProofPay securely without human credential sharing.
                </p>
                <button
                  onClick={() => setIsSaModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Agent Account</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {serviceAccounts.map((sa) => (
                  <div key={sa.id} className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-brand/10 text-brand">
                          <Bot className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text">{sa.name}</h4>
                          <span className="text-[10px] text-muted">Created {new Date(sa.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    </div>

                    {sa.description && (
                      <p className="text-xs text-muted">{sa.description}</p>
                    )}

                    {/* Budget Caps */}
                    <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-surface-2 border border-border/60">
                      <div>
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Max Agreement</span>
                        <span className="font-semibold text-text">
                          {sa.max_contract_total_minor ? formatUsd(sa.max_contract_total_minor) : 'Unlimited'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Max Open Holds</span>
                        <span className="font-semibold text-text">
                          {sa.max_open_holds_minor ? formatUsd(sa.max_open_holds_minor) : 'Unlimited'}
                        </span>
                      </div>
                    </div>

                    {/* Scopes */}
                    <div>
                      <span className="text-[10px] text-muted uppercase tracking-wider block mb-1.5">Authorized Scopes</span>
                      <div className="flex flex-wrap gap-1">
                        {sa.scopes.map((s) => (
                          <span key={s} className="px-2 py-0.5 rounded-md bg-surface-2 border border-border text-[10px] font-mono text-muted">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: API Keys */}
        {activeTab === 'api_keys' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text">Organization API Keys</h3>
                <p className="text-xs text-muted">Use API keys with the Bearer scheme to authenticate HTTP requests or SDK calls.</p>
              </div>
              <button
                onClick={() => setIsKeyModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Generate Key</span>
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-muted font-medium">
                    <th className="py-3 px-4">Label</th>
                    <th className="py-3 px-4">Key Prefix</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4">Last Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {apiKeys.map((k) => (
                    <tr key={k.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-text">{k.label}</td>
                      <td className="py-3 px-4 font-mono text-muted">{k.key_prefix}...</td>
                      <td className="py-3 px-4 text-muted">{new Date(k.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-muted">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Quickstart & MCP */}
        {activeTab === 'quickstart' && (
          <div className="space-y-6">
            {/* MCP Section */}
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-brand/10 text-brand">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text">Claude Desktop & Cursor MCP Config</h3>
                    <p className="text-xs text-muted">Connect your favorite LLM interface directly to ProofPay's 6 tools via Model Context Protocol.</p>
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(mcpConfigSnippet, 'mcp')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-xs text-text hover:bg-surface transition-colors"
                >
                  {copiedSnippet === 'mcp' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 opacity-60" />
                      <span>Copy MCP JSON</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-surface-2 border border-border font-mono text-xs text-muted overflow-x-auto">
                {mcpConfigSnippet}
              </pre>
            </div>

            {/* cURL Example */}
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text">Agent Proposes Agreement via REST API</h3>
                    <p className="text-xs text-muted">Create an agreement with verified milestones programmatically.</p>
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(curlCreateSnippet, 'curl')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-xs text-text hover:bg-surface transition-colors"
                >
                  {copiedSnippet === 'curl' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 opacity-60" />
                      <span>Copy cURL</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-surface-2 border border-border font-mono text-xs text-muted overflow-x-auto whitespace-pre">
                {curlCreateSnippet}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 4: Webhooks */}
        {activeTab === 'webhooks' && (
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Webhook className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">Outbound Webhooks & Events</h3>
                <p className="text-xs text-muted">Real-time webhook notifications delivered with HMAC SHA256 signatures.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-surface-2 border border-border/80 flex items-center justify-between">
                <div>
                  <span className="font-mono text-text font-bold">contract.funded</span>
                  <p className="text-muted text-[11px]">Fires when the buyer successfully authorizes the PayPal hold.</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">Active</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-2 border border-border/80 flex items-center justify-between">
                <div>
                  <span className="font-mono text-text font-bold">milestone.verified</span>
                  <p className="text-muted text-[11px]">Fires when deliverable artifact evaluation criteria completes.</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">Active</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-2 border border-border/80 flex items-center justify-between">
                <div>
                  <span className="font-mono text-text font-bold">milestone.released</span>
                  <p className="text-muted text-[11px]">Fires when PayPal capture releases funds to seller on passed criteria.</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">Active</span>
              </div>
            </div>
          </div>
        )}

        {/* Modal: New Service Account */}
        {isSaModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand/10 text-brand">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text">New AI Agent Service Account</h3>
                    <p className="text-[11px] text-muted">Create machine credentials with fine-grained guardrails</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSaModalOpen(false)}
                  className="p-1 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateServiceAccount} className="p-5 space-y-4 text-xs">
                {saError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {saError}
                  </div>
                )}

                <div>
                  <label className="block font-medium text-text mb-1">Agent Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DataLabelingAgent-v2"
                    value={saName}
                    onChange={(e) => setSaName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text placeholder-muted focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block font-medium text-text mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Autonomous data verification worker"
                    value={saDesc}
                    onChange={(e) => setSaDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text placeholder-muted focus:outline-none focus:border-brand"
                  />
                </div>

                {/* Scopes checklist */}
                <div>
                  <label className="block font-medium text-text mb-1.5">Permitted Scopes</label>
                  <div className="space-y-1.5 bg-surface-2 p-3 rounded-xl border border-border/80">
                    {availableScopes.map((scope) => {
                      const isChecked = saScopes.includes(scope.id)
                      return (
                        <label key={scope.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSaScopes([...saScopes, scope.id])
                              } else {
                                setSaScopes(saScopes.filter((s) => s !== scope.id))
                              }
                            }}
                            className="rounded border-border text-brand focus:ring-brand"
                          />
                          <span className="text-[11px] text-muted">{scope.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Budget caps */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-text mb-1">Max Agreement ($)</label>
                    <input
                      type="number"
                      min="1"
                      value={saMaxContract}
                      onChange={(e) => setSaMaxContract(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text font-mono focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-text mb-1">Max Open Holds ($)</label>
                    <input
                      type="number"
                      min="1"
                      value={saMaxHolds}
                      onChange={(e) => setSaMaxHolds(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text font-mono focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsSaModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-surface-2 text-text font-medium hover:bg-surface-2/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSa}
                    className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold shadow-md shadow-brand/20 transition-all disabled:opacity-50"
                  >
                    {isSubmittingSa ? 'Creating…' : 'Create Service Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: New API Key */}
        {isKeyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand/10 text-brand">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text">Generate API Key</h3>
                    <p className="text-[11px] text-muted">For MCP servers, CLI tools, or automated scripts</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsKeyModalOpen(false)
                    setNewRawKey(null)
                  }}
                  className="p-1 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {newRawKey ? (
                <div className="p-5 space-y-4 text-xs">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 space-y-1">
                    <p className="font-semibold">Save your secret key now</p>
                    <p className="text-[11px]">You will not be able to view this key again. Store it securely in your environment variables.</p>
                  </div>

                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-surface-2 border border-border font-mono text-xs text-text">
                    <span className="truncate">{newRawKey}</span>
                    <button
                      onClick={() => handleCopy(newRawKey, 'raw-key')}
                      className="p-1.5 hover:text-brand transition-colors"
                      title="Copy key"
                    >
                      {copiedSnippet === 'raw-key' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => {
                        setIsKeyModalOpen(false)
                        setNewRawKey(null)
                      }}
                      className="px-4 py-2 rounded-xl bg-brand text-white font-semibold"
                    >
                      I Have Saved My Key
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateApiKey} className="p-5 space-y-4 text-xs">
                  {keyError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      {keyError}
                    </div>
                  )}

                  <div>
                    <label className="block font-medium text-text mb-1">Key Label *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Claude MCP Server or CI Runner"
                      value={keyLabel}
                      onChange={(e) => setKeyLabel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text placeholder-muted focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setIsKeyModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-surface-2 text-text font-medium hover:bg-surface-2/80 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingKey}
                      className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold shadow-md shadow-brand/20 transition-all disabled:opacity-50"
                    >
                      {isSubmittingKey ? 'Generating…' : 'Generate Key'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
