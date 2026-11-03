'use client'

/**
 * API Keys Management Screen — /settings/api-keys
 * Create, view prefix, and revoke machine/agent API keys.
 * Displays curl and MCP server configuration snippets.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S8).
 */
import React, { useState } from 'react'
import { PageShell } from '@/components/common/PageShell'
import { MonoText } from '@/components/common/MonoText'
import { LoadingBlock } from '@/components/common/LoadingBlock'
import { ErrorState } from '@/components/common/ErrorState'
import { KeyRound, Plus, Trash2, Check, Copy, Terminal, Bot, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/lib/query'
import { relativeTime } from '@/lib/format'
import { SettingsNav } from '@/components/settings/SettingsNav'

export default function ApiKeysPage() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      return api.listApiKeys()
    },
  })

  const createMutation = useMutation({
    mutationFn: async (label: string) => {
      return api.createApiKey(label)
    },
    onSuccess: (res) => {
      setCreatedSecret((res as any).secret || (res as any).key)
      setIsModalOpen(true)
      setNewKeyLabel('')
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to create API key')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return api.revokeApiKey(keyId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to revoke API key')
    },
  })

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyLabel.trim()) return
    createMutation.mutate(newKeyLabel.trim())
  }

  const keys = data?.api_keys || []

  return (
    <PageShell
      title="Settings"
      subtitle="Manage your profile, team members, financial policies, and credentials"
    >
      <SettingsNav />
      <div className="space-y-8">
        {actionError && (
          <ErrorState
            title="Action Failed"
            message={actionError}
            onRetry={() => setActionError(null)}
          />
        )}

        {/* Create API Key Box */}
        <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <KeyRound className="w-5 h-5 text-brand" />
            <h2 className="text-base font-bold text-text">Create New API Key</h2>
          </div>

          <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              value={newKeyLabel}
              onChange={(e) => setNewKeyLabel(e.target.value)}
              placeholder="Key label (e.g. Worker Agent, MCP Client)"
              disabled={createMutation.isPending}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface-2 border border-border text-xs text-text placeholder-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand transition-all"
            />
            <button
              type="submit"
              disabled={!newKeyLabel.trim() || createMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-white text-xs font-medium hover:opacity-95 transition-opacity shadow-sm focus:ring-2 focus:ring-brand focus:outline-none disabled:opacity-50 flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{createMutation.isPending ? 'Generating…' : 'Generate API key'}</span>
            </button>
          </form>
        </div>

        {/* Existing Keys Table */}
        <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-text">
            Active keys ({keys.length})
          </h2>

          {isLoading ? (
            <LoadingBlock message="Loading API keys…" rows={2} />
          ) : keys.length === 0 ? (
            <p className="text-xs text-muted py-6 text-center">No active API keys found. Generate one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-2 border-b border-border text-muted font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Label</th>
                    <th className="py-2.5 px-3">Prefix</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3">Last Used</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {keys.map((k: any) => (
                    <tr key={k.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-3 px-3 font-medium text-text">{k.label}</td>
                      <td className="py-3 px-3">
                        <MonoText value={`pp_k_${k.keyPrefix}…`} short />
                      </td>
                      <td className="py-3 px-3 text-muted">{relativeTime(k.createdAt)}</td>
                      <td className="py-3 px-3 text-muted">
                        {k.lastUsedAt ? relativeTime(k.lastUsedAt) : 'Never'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          disabled={revokeMutation.isPending}
                          onClick={() => revokeMutation.mutate(k.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-bad hover:bg-bad/10 transition-colors text-xs font-medium focus:outline-none"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Integration Code Snippets (curl + MCP) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* curl */}
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-brand" />
              <h3 className="text-xs font-semibold text-text">REST API (curl)</h3>
            </div>
            <pre className="p-3.5 rounded-xl bg-surface-2 border border-border font-mono text-[11px] text-text overflow-x-auto leading-relaxed">
{`curl -X POST http://localhost:3000/api/v1/contracts/compile \\
  -H "Authorization: Bearer pp_k_..." \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Deliver 25 verified records..."}'`}
            </pre>
          </div>

          {/* MCP config */}
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-brand" />
              <h3 className="text-xs font-semibold text-text">MCP server configuration</h3>
            </div>
            <pre className="p-3.5 rounded-xl bg-surface-2 border border-border font-mono text-[11px] text-text overflow-x-auto leading-relaxed">
{`{
  "mcpServers": {
    "proofpay": {
      "command": "npm",
      "args": ["run", "mcp:start"],
      "env": {
        "PROOFPAY_API_KEY": "pp_k_..."
      }
    }
  }
}`}
            </pre>
          </div>
        </div>

        {/* Secret Display Modal */}
        {isModalOpen && createdSecret && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-ok">
                <ShieldCheck className="w-6 h-6" />
                <h3 className="font-bold text-base text-text">API Key Generated</h3>
              </div>

              <div className="p-3 rounded-xl bg-warn/10 border border-warn/20 text-xs text-warn flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Save this secret key now. It will <strong>never be shown again</strong>.
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-muted font-medium">Your API Secret:</span>
                <MonoText value={createdSecret} className="w-full p-2.5 text-xs font-semibold justify-between" />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setCreatedSecret(null)
                  }}
                  className="w-full py-2.5 rounded-xl bg-brand text-white text-xs font-semibold hover:opacity-95 transition-all shadow-sm"
                >
                  I have saved this key safely
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
