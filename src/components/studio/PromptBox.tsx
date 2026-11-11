'use client'

/**
 * PromptBox Component — natural language contract compiler input with example chips.
 * Enterprise Luxury edition: monochrome elegance, sleek keyboard shortcut styling, high-contrast borders.
 */
import React, { useState } from 'react'
import { Terminal, ArrowRight, Loader2, FileCode } from 'lucide-react'

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
    label: 'Technical Deep Dive ($80)',
    prompt:
      'Write a 500-word technical blog post about PostgreSQL for $50, then translate it into Spanish for $30.',
  },
  {
    label: 'Vector Brand Identity ($150)',
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
    <div className={`p-6 sm:p-7 rounded-2xl bg-surface border border-border shadow-xs space-y-5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-text flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-surface-2 border border-border text-text">
              <Terminal className="w-4 h-4" />
            </div>
            <span>AI Contract Compiler</span>
          </h2>
          <p className="text-xs text-muted">
            Describe deliverables, acceptance criteria, and milestones in natural language.
          </p>
        </div>

        <button
          type="button"
          onClick={onUseTemplate}
          className="text-xs text-text hover:text-brand inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 border border-border/80 font-semibold transition-all hover:border-brand/40"
        >
          <FileCode className="w-3.5 h-3.5 text-muted" />
          <span>Load Template</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, maxLength))}
            placeholder="Describe the job milestones, formats, and payments…"
            rows={5}
            disabled={isCompiling}
            className="w-full p-4 rounded-xl bg-surface-2/60 border border-border text-sm text-text placeholder-muted/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all resize-y disabled:opacity-60 leading-relaxed font-normal"
          />
          <div className="absolute bottom-3 right-3 text-[10px] font-mono text-muted bg-surface/90 px-2 py-0.5 rounded-md backdrop-blur-sm border border-border">
            {prompt.length} / {maxLength}
          </div>
        </div>

        {/* Example chips */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="text-xs text-muted font-medium">Examples:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              disabled={isCompiling}
              onClick={() => setPrompt(ex.prompt)}
              className="text-xs px-3 py-1 rounded-full bg-surface-2 border border-border/80 text-muted hover:text-text hover:border-border transition-all disabled:opacity-50 font-medium"
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
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-text text-bg text-xs font-bold hover:opacity-90 transition-all shadow-sm focus:ring-2 focus:ring-text/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCompiling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Compiling deterministic criteria…</span>
              </>
            ) : (
              <>
                <span>Compile Formal Contract</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
