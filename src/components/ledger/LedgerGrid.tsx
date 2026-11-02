'use client'

/**
 * LedgerGrid Component — AG Grid Community implementation of the immutable audit ledger.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S6).
 */
import React, { useState, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  ModuleRegistry,
  AllCommunityModule,
  type ColDef,
  type RowClickedEvent,
} from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { Search, Eye } from 'lucide-react'
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

  const columnDefs = useMemo<ColDef<LedgerEvent>[]>(() => {
    return [
      {
        headerName: '#',
        field: 'seq',
        width: 70,
        pinned: 'left',
        cellClass: 'font-mono text-xs font-semibold',
      },
      {
        headerName: 'Time',
        field: 'created_at',
        width: 115,
        valueFormatter: (p) => relativeTime(p.value),
        cellClass: 'text-xs text-muted',
      },
      {
        headerName: 'Type',
        field: 'type',
        width: 220,
        cellRenderer: (p: any) => {
          const type = String(p.value || '')
          const isPassed = type.includes('PASSED') || type.includes('ACCEPTED') || type.includes('COMPLETED')
          const isFailed = type.includes('REJECTED') || type.includes('FAILED')
          const isWarn = type.includes('ESCALATED') || type.includes('FLAGGED')

          let bg = 'bg-surface-2 text-muted border-border'
          if (isPassed) bg = 'bg-ok/10 text-ok border-ok/20'
          else if (isFailed) bg = 'bg-bad/10 text-bad border-bad/20'
          else if (isWarn) bg = 'bg-warn/10 text-warn border-warn/30'

          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border ${bg}`}
            >
              {type}
            </span>
          )
        },
      },
      {
        headerName: 'Actor',
        field: 'actor_type',
        width: 100,
        cellClass: 'text-xs capitalize font-medium',
      },
      {
        headerName: 'Summary',
        flex: 1,
        minWidth: 240,
        valueGetter: (p) => explainLedgerEvent(p.data?.type || '', p.data?.payload).summary,
        cellClass: 'text-xs text-text truncate',
      },
      {
        headerName: 'PayPal Ref',
        width: 150,
        valueGetter: (p) => {
          const payload = p.data?.payload as Record<string, unknown> | undefined
          return (
            payload?.capture_id ||
            payload?.authorization_id ||
            payload?.order_id ||
            '—'
          )
        },
        cellClass: 'font-mono text-[11px] text-muted',
      },
      {
        headerName: 'Hash',
        field: 'hash',
        width: 110,
        valueFormatter: (p) => shortHash(p.value, 8),
        cellClass: 'font-mono text-xs text-brand font-medium',
      },
      {
        headerName: '',
        width: 60,
        cellRenderer: () => (
          <span className="inline-flex items-center justify-center text-muted hover:text-brand cursor-pointer p-1">
            <Eye className="w-3.5 h-3.5" />
          </span>
        ),
      },
    ]
  }, [])

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      sortable: true,
      filter: true,
      resizable: true,
    }
  }, [])

  const handleRowClick = (ev: RowClickedEvent<LedgerEvent>) => {
    if (ev.data) {
      onSelectEvent(ev.data)
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Quick Filter Box */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={quickFilterText}
            onChange={(e) => setQuickFilterText(e.target.value)}
            placeholder="Search events, types, hashes…"
            className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-surface-2 border border-border text-xs text-text placeholder-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
          />
        </div>

        <div className="text-xs text-muted">
          Showing <strong>{events.length}</strong> ledger events · Click row to inspect payload
        </div>
      </div>

      {/* Grid container */}
      <div className="w-full rounded-xl overflow-hidden border border-border shadow-sm ag-theme-quartz">
        <div style={{ width: '100%', height: events.length > 10 ? '560px' : '380px' }}>
          <AgGridReact<LedgerEvent>
            rowData={events}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            quickFilterText={quickFilterText}
            rowHeight={44}
            headerHeight={40}
            onRowClicked={handleRowClick}
            animateRows={false}
          />
        </div>
      </div>
    </div>
  )
}
