'use client'

import React, { useState } from 'react'
import { PageShell } from '@/components/common/PageShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { MonoText } from '@/components/common/MonoText'
import { Zap, ShieldCheck, CheckCircle2, AlertCircle, Send, KeyRound, ExternalLink } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export default function WebhooksSettingsPage() {
  const queryClient = useQueryClient()

  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [pingSuccess, setPingSuccess] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['outbound-webhook'],
    queryFn: async () => {
      const res = await fetch('/api/v1/webhooks/outbound')
      if (!res.ok) return null
      const json = await res.json()
      if (json.config) {
        setUrl(json.config.url || '')
        setSecret(json.config.secret || '')
        setEnabled(!!json.config.enabled)
      }
      return json
    },
  })

  const saveMutation = useMutation({
    mutationFn: async ({ testPing = false }: { testPing?: boolean }) => {
      setErrorMsg(null)
      setPingSuccess(null)
      const res = await fetch('/api/v1/webhooks/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          secret,
          enabled,
          events: ['contract.funded', 'milestone.verified', 'milestone.released'],
          test_ping: testPing,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Failed to save webhook configuration')
      }

      return res.json()
    },
    onSuccess: (data, variables) => {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      if (variables.testPing) {
        setPingSuccess('Test event dispatched successfully to your webhook receiver.')
      }
      queryClient.invalidateQueries({ queryKey: ['outbound-webhook'] })
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Webhook operation failed')
    },
  })

  return (
    <PageShell
      title="Settings"
      subtitle="Manage your profile, team members, financial policies, and credentials"
    >
      <SettingsNav />

      <div className="space-y-8 max-w-4xl pb-16">
        {saveSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Webhook configuration saved successfully.</span>
          </div>
        )}

        {pingSuccess && (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{pingSuccess}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Zapier & Automation Banner */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text">Zapier &amp; Outbound Webhooks</h3>
              <p className="text-xs text-muted">
                Trigger autonomous agent workflows in Zapier, Slack, or internal microservices on contract events
              </p>
            </div>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            ProofPay signs every webhook payload using HMAC-SHA256 with your shared secret in the <code className="bg-surface px-1.5 py-0.5 rounded text-brand font-mono">X-ProofPay-Signature</code> header.
          </p>
        </div>

        {/* Configuration Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate({ testPing: false })
          }}
          className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div>
              <h4 className="text-sm font-semibold text-text">Outbound Endpoint</h4>
              <p className="text-xs text-muted">Where ProofPay should POST real-time event JSON payloads</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-brand focus:ring-brand accent-brand"
              />
              <span className="text-xs font-semibold text-text">Enable Webhook</span>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted block mb-1">Webhook URL (HTTPS)</label>
              <input
                type="url"
                required
                placeholder="https://hooks.zapier.com/hooks/catch/12345/abcde"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-xs text-text font-mono focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted block mb-1">HMAC Signature Secret Key</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2 text-xs text-text font-mono focus:outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => setSecret('whsec_' + Math.random().toString(36).substring(2, 16))}
                  className="px-3 py-2 rounded-xl bg-surface border border-border text-xs text-muted hover:text-text shrink-0"
                >
                  Regenerate
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/60 bg-surface/30 space-y-2">
              <span className="text-xs font-semibold text-text block">Subscribed Events</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
                  <span>contract.funded</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
                  <span>milestone.verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
                  <span>milestone.released</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/60">
            <button
              type="button"
              disabled={!url || saveMutation.isPending}
              onClick={() => saveMutation.mutate({ testPing: true })}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border hover:border-brand/40 text-xs font-semibold text-text transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-brand" />
              <span>Send Test Ping to Zapier</span>
            </button>

            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-lg shadow-brand/20 transition-all disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Webhook'}
            </button>
          </div>
        </form>
      </div>
    </PageShell>
  )
}
