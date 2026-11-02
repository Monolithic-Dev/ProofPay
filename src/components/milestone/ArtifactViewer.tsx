'use client'

/**
 * ArtifactViewer Component — renders deliverable text or tabular JSON records with evidence highlighting.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S5).
 */
import React, { useState, useMemo } from 'react'
import { EvidenceHighlight } from './EvidenceHighlight'
import { FileCode2, Table as TableIcon, ChevronDown, ChevronUp } from 'lucide-react'

export interface ArtifactViewerProps {
  content: unknown
  contentType: 'json_records' | 'text' | string
  highlightQuotes?: string[]
  className?: string
}

export function ArtifactViewer({
  content,
  contentType,
  highlightQuotes = [],
  className = '',
}: ArtifactViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const maxDisplayChars = 50000

  const { isJsonArray, jsonRows, rawText } = useMemo(() => {
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed)) {
          return { isJsonArray: true, jsonRows: parsed, rawText: content }
        }
      } catch {
        // pure string
      }
      return { isJsonArray: false, jsonRows: [], rawText: content }
    }

    if (Array.isArray(content)) {
      return {
        isJsonArray: true,
        jsonRows: content,
        rawText: JSON.stringify(content, null, 2),
      }
    }

    const str = typeof content === 'object' && content !== null ? JSON.stringify(content, null, 2) : String(content ?? '')
    return { isJsonArray: false, jsonRows: [], rawText: str }
  }, [content])

  const needsTruncation = rawText.length > maxDisplayChars
  const displayText = needsTruncation && !isExpanded ? rawText.slice(0, maxDisplayChars) : rawText

  return (
    <div className={`p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-4 ${className}`}>
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          {isJsonArray ? (
            <TableIcon className="w-4 h-4 text-brand" />
          ) : (
            <FileCode2 className="w-4 h-4 text-brand" />
          )}
          <h3 className="text-sm font-semibold text-text">
            Submitted Deliverable Artifact ({contentType})
          </h3>
        </div>
        <div className="text-xs text-muted font-mono">
          {isJsonArray ? `${jsonRows.length} records` : `${rawText.length.toLocaleString()} characters`}
        </div>
      </div>

      {/* Render as JSON records table if array */}
      {isJsonArray && jsonRows.length > 0 ? (
        <div className="overflow-x-auto max-h-[480px] rounded-xl border border-border">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-2 sticky top-0 border-b border-border text-muted font-semibold">
              <tr>
                <th className="py-2.5 px-3 w-12 font-mono">#</th>
                {Object.keys(jsonRows[0] || {}).map((key) => (
                  <th key={key} className="py-2.5 px-3 font-mono">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {jsonRows.slice(0, isExpanded ? jsonRows.length : 100).map((row: any, i: number) => (
                <tr key={i} className="hover:bg-surface-2/40 transition-colors">
                  <td className="py-2 px-3 text-muted">{i + 1}</td>
                  {Object.keys(jsonRows[0] || {}).map((key) => (
                    <td key={key} className="py-2 px-3 truncate max-w-[240px]">
                      {typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {jsonRows.length > 100 && (
            <div className="p-3 text-center bg-surface-2/60 border-t border-border">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-brand font-medium hover:underline inline-flex items-center gap-1"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Show first 100 records
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Show all {jsonRows.length} records
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Text view with safe Evidence highlighting */
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-surface-2/60 border border-border font-mono text-xs text-text whitespace-pre-wrap leading-relaxed max-h-[480px] overflow-y-auto">
            <EvidenceHighlight text={displayText} quotes={highlightQuotes} />
          </div>

          {needsTruncation && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-brand font-medium hover:underline inline-flex items-center gap-1"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Show full artifact ({rawText.length.toLocaleString()} characters)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
