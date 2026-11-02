'use client'

/**
 * EvidenceHighlight Component — safely marks quotes inside artifact text without innerHTML.
 * Implements phase-6-frontend.md §6.4 & security rule (never dangerouslySetInnerHTML).
 */
import React from 'react'

export interface EvidenceHighlightProps {
  text: string
  quotes: string[]
  className?: string
}

export function EvidenceHighlight({
  text,
  quotes = [],
  className = '',
}: EvidenceHighlightProps) {
  const validQuotes = quotes.filter((q) => typeof q === 'string' && q.trim().length > 3)

  if (validQuotes.length === 0 || !text) {
    return <span className={className}>{text}</span>
  }

  // Find occurrences of quotes in text
  interface MatchRange {
    start: number
    end: number
  }

  const ranges: MatchRange[] = []

  for (const quote of validQuotes) {
    let pos = 0
    while (pos < text.length) {
      const idx = text.toLowerCase().indexOf(quote.toLowerCase(), pos)
      if (idx === -1) break
      ranges.push({ start: idx, end: idx + quote.length })
      pos = idx + quote.length
    }
  }

  if (ranges.length === 0) {
    return <span className={className}>{text}</span>
  }

  // Sort and merge overlapping ranges
  ranges.sort((a, b) => a.start - b.start)
  const merged: MatchRange[] = []
  if (ranges.length === 0 || !ranges[0]) return <span className={className}>{text}</span>

  let current: MatchRange = ranges[0]

  for (let i = 1; i < ranges.length; i++) {
    const next = ranges[i]
    if (!next) continue
    if (next.start <= current.end) {
      current.end = Math.max(current.end, next.end)
    } else {
      merged.push(current)
      current = next
    }
  }
  merged.push(current)

  // Construct React elements array safely
  const elements: React.ReactNode[] = []
  let lastIndex = 0

  merged.forEach((range, i) => {
    if (range.start > lastIndex) {
      elements.push(
        <span key={`text-${lastIndex}`}>{text.slice(lastIndex, range.start)}</span>
      )
    }
    elements.push(
      <mark
        key={`mark-${range.start}-${i}`}
        className="bg-brand/20 text-brand font-semibold px-1 py-0.5 rounded border-b-2 border-brand"
        title="Evidence verified by AI grader"
      >
        {text.slice(range.start, range.end)}
      </mark>
    )
    lastIndex = range.end
  })

  if (lastIndex < text.length) {
    elements.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }

  return <span className={className}>{elements}</span>
}
