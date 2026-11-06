'use client'

/**
 * LedgerGrid Component — AG Grid Community implementation of the immutable audit ledger.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S6).
 * Enhanced with sleek quartz theme variables and responsive card layout for mobile devices.
 */
import React, { useState, useMemo, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  ModuleRegistry,
  AllCommunityModule,
  type ColDef,
  type RowClickedEvent,
  type GridReadyEvent,
} from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { Search, Eye, X, Copy, Check, Table, Smartphone } from 'lucide-react'
import { explainLedgerEvent } from '@/lib/explain'
import { shortHash, relativeTime } from '@/lib/format'
import type { LedgerEvent } from '@/shared/types'

// Register AG Grid Community modules
ModuleRegistry.registerModules([AllCommunityModule])

export interface LedgerGridProps {
  events: LedgerEvent[]
  onSelectEvent: (event: LedgerEvent) => void
  className?: string
}

export function LedgerGrid({ events = [], onSelectEvent, className = '' }: LedgerGridProps) {
  const [quickFilterText, setQuickFilterText] = useState('')
  const [copiedHash, setCopiedHash] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'table' | 'cards'>('table')

  const handleCopy = (hash: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(hash)
    setCopiedHash(hash)
    setTimeout(() => setCopiedHash(null), 1500)
  }

  const columnDefs = useMemo<ColDef<LedgerEvent>[]>(() => {
    return [
      {
        headerName: '#',
        field: 'seq',
        width: 70,
        pinned: 'left',
        cellClass: 'font-mono text-xs font-semibold flex items-center',
      },
      {
        headerName: 'Time',
        field: 'created_at',
        width: 120,
        valueFormatter: (p) => relativeTime(p.value),
        cellClass: 'text-xs text-muted flex items-center',
      },
      {
        headerName: 'Event Type',
        field: 'type',
        width: 220,
        cellRenderer: (p: any) => {
          const type = String(p.value || '')
          const isPassed =
            type.includes('PASSED') ||
            type.includes('ACCEPTED') ||
            type.includes('COMPLETED') ||
            type.includes('CAPTURED')
          const isFailed = type.includes('REJECTED') || type.includes('FAILED')
          const isThreat = type.includes('INJECTION') || type.includes('FLAGGED')
          const isPayPal = type.includes('PAYPAL') || type.includes('AUTHORIZATION')

          let bg = 'bg-surface-2 text-muted border-border'
          if (isThreat) bg = 'bg-bad/10 text-bad border-bad/30 font-bold'
          else if (isPassed) bg = 'bg-ok/10 text-ok border-ok/20 font-semibold'
          else if (isFailed) bg = 'bg-bad/10 text-bad border-bad/20 font-semibold'
          else if (isPayPal) bg = 'bg-brand/10 text-brand border-brand/20 font-semibold'

          return (
            <div className="flex items-center h-full">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border ${bg}`}
              >
                {type}
              </span>
            </div>
          )
        },
      },
      {
        headerName: 'Actor',
        field: 'actor_type',
        width: 100,
        cellClass: 'text-xs capitalize font-medium flex items-center',
      },
      {
        headerName: 'Summary',
        flex: 1,
        minWidth: 260,
        valueGetter: (p) => explainLedgerEvent(p.data?.type || '', p.data?.payload).summary,
        cellClass: 'text-xs text-text truncate flex items-center',
      },
      {
        headerName: 'PayPal Ref',
        width: 160,
        valueGetter: (p) => {
          const payload = p.data?.payload as Record<string, unknown> | undefined
          return (
            payload?.capture_id ||
            payload?.authorization_id ||
            payload?.order_id ||
            '—'
          )
        },
        cellClass: 'font-mono text-[11px] text-muted flex items-center',
      },
      {
        headerName: 'Hash',
        field: 'hash',
        width: 125,
        cellRenderer: (p: any) => {
          const hash = String(p.value || '')
          const isCopied = copiedHash === hash
          return (
            <div className="flex items-center gap-1.5 h-full">
              <span className="font-mono text-xs text-brand font-medium">
                {shortHash(hash, 8)}
              </span>
              <button
                type="button"
                onClick={(e) => handleCopy(hash, e)}
                title="Copy full SHA-256 hash"
                className="text-muted hover:text-text p-0.5 transition-colors"
              >
                {isCopied ? (
                  <Check className="w-3 h-3 text-ok" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          )
        },
      },
      {
        headerName: '',
        width: 60,
        cellRenderer: () => (
          <div className="flex items-center justify-center h-full">
            <span className="inline-flex items-center justify-center text-muted hover:text-brand cursor-pointer p-1 rounded hover:bg-surface-2 transition-colors">
              <Eye className="w-4 h-4" />
            </span>
          </div>
        ),
      },
    ]
  }, [copiedHash])

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      sortable: true,
      filter: true,
      resizable: true,
    }
  }, [])

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit()
  }, [])

  const handleRowClick = (ev: RowClickedEvent<LedgerEvent>) => {
    if (ev.data) {
      onSelectEvent(ev.data)
    }
  }

  // Filtered events for mobile card view
  const filteredEvents = useMemo(() => {
    if (!quickFilterText.trim()) return events
    const q = quickFilterText.toLowerCase()
    return events.filter((e) => {
      const summary = explainLedgerEvent(e.type, e.payload).summary.toLowerCase()
      return (
        e.type.toLowerCase().includes(q) ||
        e.actor_type.toLowerCase().includes(q) ||
        e.hash.toLowerCase().includes(q) ||
        summary.includes(q)
      )
    })
  }, [events, quickFilterText])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={quickFilterText}
            onChange={(e) => setQuickFilterText(e.target.value)}
            placeholder="Search events, types, hashes…"
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-surface border border-border text-xs text-text placeholder-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all shadow-sm"
          />
          {quickFilterText && (
            <button
              type="button"
              onClick={() => setQuickFilterText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-muted">
          <span>
            Showing <strong>{filteredEvents.length}</strong> events · Click row to inspect
          </span>

          {/* Mobile view toggle (hidden on desktop) */}
          <div className="inline-flex sm:hidden items-center p-0.5 rounded-lg bg-surface border border-border">
            <button
              type="button"
              onClick={() => setMobileView('table')}
              className={`p-1.5 rounded ${
                mobileView === 'table' ? 'bg-surface-2 text-text' : 'text-muted'
              }`}
              title="Table view"
            >
              <Table className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMobileView('cards')}
              className={`p-1.5 rounded ${
                mobileView === 'cards' ? 'bg-surface-2 text-text' : 'text-muted'
              }`}
              title="Card view"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop AG Grid Table */}
      <div
        className={`w-full rounded-2xl overflow-hidden border border-border shadow-sm ag-theme-quartz ${
          mobileView === 'cards' ? 'hidden sm:block' : 'block'
        }`}
      >
        <div style={{ width: '100%', height: events.length > 10 ? '580px' : '420px' }}>
          <AgGridReact<LedgerEvent>
            rowData={events}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            quickFilterText={quickFilterText}
            rowHeight={46}
            headerHeight={42}
            onRowClicked={handleRowClick}
            onGridReady={onGridReady}
            animateRows={false}
          />
        </div>
      </div>

      {/* Mobile Card List View (Responsive Fallback) */}
      {mobileView === 'cards' && (
        <div className="block sm:hidden space-y-3">
          {filteredEvents.map((ev) => {
            const explanation = explainLedgerEvent(ev.type, ev.payload)
            return (
              <div
                key={ev.id}
                onClick={() => onSelectEvent(ev)}
                className="p-4 rounded-xl bg-surface border border-border space-y-2 cursor-pointer hover:border-brand/40 transition-colors shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-muted">
                      #{ev.seq}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface-2 border border-border text-text">
                      {ev.type}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted">
                    {relativeTime(ev.created_at)}
                  </span>
                </div>

                <p className="text-xs text-text font-medium leading-relaxed">
                  {explanation.summary}
                </p>

                <div className="flex items-center justify-between text-[11px] text-muted border-t border-border/40 pt-2 font-mono">
                  <span>Actor: {ev.actor_type}</span>
                  <span className="text-brand">{shortHash(ev.hash, 8)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
