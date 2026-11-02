'use client'

/**
 * ProofPackButtons Component — export cryptographically verifiable settlement proof pack.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S6).
 */
import React, { useState } from 'react'
import { FileDown, FileText, Loader2, Check } from 'lucide-react'
import { useApiClient } from '@/lib/query'

export interface ProofPackButtonsProps {
  contractId: string
  className?: string
}

export function ProofPackButtons({ contractId, className = '' }: ProofPackButtonsProps) {
  const api = useApiClient()
  const [downloadingJson, setDownloadingJson] = useState(false)

  const handleDownloadJson = async () => {
    setDownloadingJson(true)
    try {
      const res = await fetch(`/api/v1/contracts/${contractId}/proof-pack?format=json`)
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `proof-pack-${contractId}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download JSON proof pack:', err)
    } finally {
      setDownloadingJson(false)
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      <button
        type="button"
        disabled={downloadingJson}
        onClick={handleDownloadJson}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text hover:bg-surface-2 transition-colors disabled:opacity-50"
      >
        {downloadingJson ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-brand" />
        )}
        <span>Export Proof Pack (JSON)</span>
      </button>

      <a
        href={`/api/v1/contracts/${contractId}/proof-pack?format=pdf`}
        target="_blank"
        rel="noopener noreferrer"
        download={`proof-pack-${contractId}.pdf`}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:opacity-95 transition-all shadow-sm"
      >
        <FileDown className="w-3.5 h-3.5" />
        <span>Export Proof Pack (PDF)</span>
      </a>
    </div>
  )
}
