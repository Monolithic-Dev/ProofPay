'use client'

/**
 * SubmitPanel Component — seller submission form for milestone deliverables.
 * Enforces <= 1 MiB payload limit and client-side JSON record array checks.
 * Displays per-attempt Idempotency-Key for replay safety.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S5).
 */
import React, { useState, useEffect } from 'react'
import { Upload, Send, FileText, AlertCircle, Loader2, Key } from 'lucide-react'

export interface SubmitPanelProps {
  milestoneKey: string
  deliverableType: 'json_records' | 'text' | string
  deliverableDesc?: string
  onSubmit: (payload: {
    content_type: 'json_records' | 'text'
    content_text: string
    note?: string
    idempotency_key: string
  }) => Promise<void>
  isSubmitting?: boolean
  className?: string
}

export function SubmitPanel({
  milestoneKey,
  deliverableType,
  deliverableDesc,
  onSubmit,
  isSubmitting = false,
  className = '',
}: SubmitPanelProps) {
  const [content, setContent] = useState('')
  const [note, setNote] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Generate a fresh idempotency key per submission attempt
  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID())
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 1 MiB limit check
    if (file.size > 1024 * 1024) {
      setValidationError('File size exceeds 1 MiB limit. Please upload a smaller file.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setContent(text || '')
      setValidationError(null)
    }
    reader.readAsText(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    const trimmed = content.trim()
    if (!trimmed) {
      setValidationError('Please provide the deliverable text or file.')
      return
    }

    // Client-side JSON array check for json_records deliverable
    if (deliverableType === 'json_records') {
      try {
        const parsed = JSON.parse(trimmed)
        if (!Array.isArray(parsed)) {
          setValidationError('Deliverable must be a valid JSON array of records [ { ... } ].')
          return
        }
      } catch (err: any) {
        setValidationError(`Invalid JSON format: ${err.message}`)
        return
      }
    }

    await onSubmit({
      content_type: deliverableType === 'json_records' ? 'json_records' : 'text',
      content_text: trimmed,
      note: note.trim() || undefined,
      idempotency_key: idempotencyKey,
    })
  }

  return (
    <div className={`p-6 sm:p-8 rounded-2xl bg-surface border border-border shadow-sm space-y-6 ${className}`}>
      <div className="border-b border-border pb-4 space-y-1">
        <h3 className="text-base font-bold text-text">Submit Deliverable ({milestoneKey})</h3>
        {deliverableDesc && <p className="text-xs text-muted">{deliverableDesc}</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Textarea */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="deliverable-content" className="text-xs font-semibold text-text">
              Artifact Content ({deliverableType === 'json_records' ? 'JSON Array' : 'Text / Markdown'})
            </label>
            <div className="flex items-center gap-2">
              <label
                htmlFor="file-upload"
                className="cursor-pointer text-xs font-medium text-brand hover:underline inline-flex items-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload file (&le; 1 MiB)
              </label>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept={deliverableType === 'json_records' ? '.json' : '.txt,.md,.json'}
                onChange={handleFileUpload}
              />
            </div>
          </div>

          <textarea
            id="deliverable-content"
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              setValidationError(null)
            }}
            placeholder={
              deliverableType === 'json_records'
                ? '[\n  {\n    "sku": "PROD-001",\n    "name": "Sample Product",\n    "category": "Electronics"\n  }\n]'
                : 'Write or paste your deliverable content here…'
            }
            rows={8}
            disabled={isSubmitting}
            className="w-full p-3.5 rounded-xl bg-surface-2/60 border border-border font-mono text-xs text-text placeholder-muted/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand transition-all resize-y"
          />
        </div>

        {/* Seller Note */}
        <div className="space-y-1.5">
          <label htmlFor="submission-note" className="text-xs font-semibold text-text">
            Submission Note (optional)
          </label>
          <input
            id="submission-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Cleaned up rows per feedback; verified schema format."
            disabled={isSubmitting}
            className="w-full p-2.5 rounded-xl bg-surface-2/60 border border-border text-xs text-text placeholder-muted/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand transition-all"
          />
        </div>

        {/* Idempotency Key preview */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted border-t border-border/40 pt-3">
          <div className="flex items-center gap-1.5">
            <Key className="w-3 h-3 text-brand" />
            <span>Idempotency Key:</span>
            <code className="font-mono bg-surface-2 px-1.5 py-0.5 rounded border border-border text-text">
              {idempotencyKey.slice(0, 16)}…
            </code>
          </div>
          <span>Max size: 1 MiB</span>
        </div>

        {/* Validation Error banner */}
        {validationError && (
          <div className="p-3 rounded-xl bg-bad/10 border border-bad/20 flex items-center gap-2 text-xs text-bad">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Submit button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white text-xs font-semibold hover:opacity-95 transition-all shadow-sm focus:ring-2 focus:ring-brand focus:outline-none disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running Verification Pipeline…</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Deliverable for Verification</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
