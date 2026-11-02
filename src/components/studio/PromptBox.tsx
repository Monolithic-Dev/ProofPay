'use client'

/**
 * PromptBox Component — natural language contract compiler input with example chips.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S1).
 */
import React, { useState } from 'react'
import { Sparkles, ArrowRight, Loader2, FileCode } from 'lucide-react'

export interface PromptBoxProps {
  onCompile: (prompt: string) => Promise<void>
  onUseTemplate: () => void
  isCompiling: boolean
  className?: string
}

const EXAMPLES = [
  {
    label: 'Dataset + Summary ($100)',
    prompt:
      'I need 25 product records as JSON (sku, name, category, price_usd, contact_email, description) for $60, then a high quality summary for $40.',
  },
  {
    label: 'Blog Post + Translation ($80)',
    prompt:
      'Write a 500-word technical blog post about PostgreSQL for $50, then translate it into Spanish for $30.',
  },
  {
    label: 'Logo Design & Vector Export ($150)',
    prompt:
      'Design a modern vector SVG logo for ProofPay for $100, then provide 3 color variation PNGs for $50.',
  },
]

export function PromptBox({
  onCompile,
  onUseTemplate,
  isCompiling,
  className = '',
}: PromptBoxProps) {
  const [prompt, setPrompt] = useState(EXAMPLES[0]?.prompt || '')
  const maxLength = 2000

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isCompiling) return
    await onCompile(prompt.trim())
  }

  return (
    <div className={`p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-text flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" />
            <span>AI Contract Compiler</span>
          </h2>
          <p className="text-xs text-muted">
            Describe the deliverables and payment milestones in plain English.
          </p>
        </div>

        <button
          type="button"
          onClick={onUseTemplate}
          className="text-xs text-brand hover:underline inline-flex items-center gap-1 font-medium"
        >
          <FileCode className="w-3.5 h-3.5" />
          Load Template
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, maxLength))}
            placeholder="Describe the job milestones, formats, and payments…"
            rows={5}
            disabled={isCompiling}
            className="w-full p-3.5 rounded-xl bg-surface-2/60 border border-border text-sm text-text placeholder-muted/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all resize-y disabled:opacity-60"
          />
          <div className="absolute bottom-3 right-3 text-[11px] font-mono text-muted bg-surface/80 px-1.5 py-0.5 rounded backdrop-blur-sm border border-border/40">
            {prompt.length} / {maxLength}
          </div>
        </div>

        {/* Example chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-muted font-medium">Try an example:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              disabled={isCompiling}
              onClick={() => setPrompt(ex.prompt)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-surface-2 border border-border text-muted hover:text-brand hover:border-brand/40 transition-colors disabled:opacity-50"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Submit button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!prompt.trim() || isCompiling}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-95 transition-opacity shadow-sm focus:ring-2 focus:ring-brand focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCompiling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Compiling criteria…</span>
              </>
            ) : (
              <span>Compile contract</span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
