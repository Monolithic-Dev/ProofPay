'use client'

/**
 * FundsBar Component — Signature ProofPay money state visualizer.
 * Stacked horizontal bar displaying Released, Held, and Voided funds against Total.
 * Implements phase-6-frontend.md §6.3 & ux-flows.md §3.
 */
import React from 'react'
import { formatMoney } from '@/components/common/Money'

export interface FundsBarProps {
  totalMinor: number
  releasedMinor: number
  heldMinor: number
  voidedMinor: number
  className?: string
}

export function FundsBar({
  totalMinor,
  releasedMinor,
  heldMinor,
  voidedMinor,
  className = '',
}: FundsBarProps) {
  const safeTotal = Math.max(0, totalMinor)
  const safeReleased = Math.max(0, releasedMinor)
  const safeHeld = Math.max(0, heldMinor)
  const safeVoided = Math.max(0, voidedMinor)

  // Percentages based on safeTotal
  const releasedPct = safeTotal > 0 ? Math.min(100, (safeReleased / safeTotal) * 100) : 0
  const heldPct =
    safeTotal > 0 ? Math.min(100 - releasedPct, (safeHeld / safeTotal) * 100) : 0
  const voidedPct =
    safeTotal > 0 ? Math.min(100 - releasedPct - heldPct, (safeVoided / safeTotal) * 100) : 0

  const ariaLabel = `Released ${formatMoney(safeReleased)}, held ${formatMoney(
    safeHeld
  )}, voided ${formatMoney(safeVoided)} of ${formatMoney(safeTotal)}`

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Bar container */}
      <div
        role="img"
        aria-label={ariaLabel}
        className="w-full h-4 rounded-full bg-surface-2 border border-border overflow-hidden flex relative"
      >
        {/* Released segment */}
        {releasedPct > 0 && (
          <div
            style={{ width: `${releasedPct}%` }}
            title={`Released: ${formatMoney(safeReleased)} — paid out to seller via PayPal`}
            className="h-full bg-ok transition-[width] duration-150 ease-out flex-shrink-0"
          />
        )}

        {/* Held segment */}
        {heldPct > 0 && (
          <div
            style={{ width: `${heldPct}%` }}
            title={`Held: ${formatMoney(safeHeld)} — authorized on PayPal, not yet charged`}
            className="h-full bg-brand transition-[width] duration-150 ease-out flex-shrink-0"
          />
        )}

        {/* Voided segment (diagonal stripes) */}
        {voidedPct > 0 && (
          <div
            style={{
              width: `${voidedPct}%`,
              backgroundImage:
                'repeating-linear-gradient(45deg, var(--void), var(--void) 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 8px)',
            }}
            title={`Voided: ${formatMoney(safeVoided)} — unreleased authorization returned to buyer`}
            className="h-full bg-void transition-[width] duration-150 ease-out flex-shrink-0"
          />
        )}
      </div>

      {/* Legend & Breakdown text */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5" title="Paid out to seller via PayPal capture">
            <span className="w-2.5 h-2.5 rounded-full bg-ok inline-block" />
            <span>
              Released <strong className="text-text font-mono">{formatMoney(safeReleased)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5" title="Authorized on PayPal, not yet charged">
            <span className="w-2.5 h-2.5 rounded-full bg-brand inline-block" />
            <span>
              Held <strong className="text-text font-mono">{formatMoney(safeHeld)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5" title="Unreleased authorization returned to buyer">
            <span className="w-2.5 h-2.5 rounded-full bg-void inline-block border border-border" />
            <span>
              Voided <strong className="text-text font-mono">{formatMoney(safeVoided)}</strong>
            </span>
          </div>
        </div>

        <div className="text-muted">
          Total <strong className="text-text font-mono">{formatMoney(safeTotal)}</strong>
        </div>
      </div>
    </div>
  )
}
