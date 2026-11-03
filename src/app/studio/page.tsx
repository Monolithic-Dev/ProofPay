'use client'

/**
 * Studio Page — Contract Drafting & Natural Language Compilation.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S1).
 */
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { PromptBox } from '@/components/studio/PromptBox'
import { ErrorState } from '@/components/common/ErrorState'
import { Money } from '@/components/common/Money'
import { StatusChip } from '@/components/contract/StatusChip'
import { useApiClient, useContracts, useCurrentUser } from '@/lib/query'
import defaultTemplate from '@/lib/templates/dataset-summary.json'
import { FileText, ArrowRight, Sparkles, Layers } from 'lucide-react'

export default function StudioPage() {
  const router = useRouter()
  const api = useApiClient()
  const { data: contracts = [], isLoading: isLoadingContracts } = useContracts()
  const { data: currentUser } = useCurrentUser()
  const [isCompiling, setIsCompiling] = useState(false)
  const [errorInfo, setErrorInfo] = useState<{ message: string; requestId?: string; code?: string } | null>(null)

  const ensureSession = async () => {
    if (!currentUser) {
      await fetch('/api/v1/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_key: 'buyer' }),
      }).catch(() => {})
    }
  }

  const handleCompile = async (prompt: string) => {
    setIsCompiling(true)
    setErrorInfo(null)
    try {
      await ensureSession()
      const res = await api.compileContract(prompt)
      if (res?.contract?.id) {
        router.push(`/studio/${res.contract.id}`)
      }
    } catch (err: any) {
      console.error('Compilation failed:', err)
      setErrorInfo({
        message: err.message || 'Failed to compile contract from prompt',
        requestId: err.requestId,
        code: err.code,
      })
    } finally {
      setIsCompiling(false)
    }
  }

  const handleUseTemplate = async (templatePrompt?: string) => {
    setIsCompiling(true)
    setErrorInfo(null)
    const promptToUse =
      templatePrompt ||
      'I need 25 product records as JSON (sku, name, category, price_usd, contact_email, description) for $60, then a high quality summary for $40.'

    try {
      await ensureSession()
      const res = await api.compileContract(promptToUse)
      if (res?.contract?.id) {
        router.push(`/studio/${res.contract.id}`)
      }
    } catch (err: any) {
      setErrorInfo({
        message: err.message || 'Template loading failed. Please try again.',
        requestId: err.requestId,
        code: err.code,
      })
    } finally {
      setIsCompiling(false)
    }
  }

  return (
    <PageShell
      title="Contract Studio"
      subtitle="Compile English agreements into machine-verifiable criteria with automated linting"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Compiler & Errors */}
        <div className="lg:col-span-2 space-y-6">
          <PromptBox
            onCompile={handleCompile}
            onUseTemplate={handleUseTemplate}
            isCompiling={isCompiling}
          />

          {errorInfo && (
            <ErrorState
              title="Compilation Error"
              message={errorInfo.message}
              requestId={errorInfo.requestId}
              code={errorInfo.code}
              action={
                <button
                  type="button"
                  onClick={() => handleUseTemplate()}
                  className="px-3.5 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:opacity-95 transition-all"
                >
                  Use a Pre-built Template
                </button>
              }
            />
          )}
        </div>

        {/* Right Column: Existing Contracts */}
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <FileText className="w-4 h-4 text-brand" />
              <h3 className="text-sm font-semibold text-text">Your Contracts</h3>
            </div>

            {isLoadingContracts ? (
              <p className="text-xs text-muted py-4 text-center">Loading agreements…</p>
            ) : contracts.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted space-y-2">
                <p>No contracts created yet.</p>
                <p className="text-[11px]">Compile a prompt to create your first verified milestone agreement.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {contracts.slice(0, 5).map((c) => (
                  <Link
                    key={c.id}
                    href={c.status === 'DRAFT' ? `/studio/${c.id}` : `/contracts/${c.id}`}
                    className="block p-3 rounded-xl bg-surface-2/60 border border-border hover:border-brand/40 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs text-text truncate max-w-[180px]">
                        {c.title}
                      </span>
                      <StatusChip status={c.status} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <Money minor={c.total_minor} className="text-xs font-semibold text-text" />
                      <span className="inline-flex items-center gap-0.5 text-brand">
                        Open <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
