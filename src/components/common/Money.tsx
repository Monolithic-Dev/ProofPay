'use client'

/**
 * Money Component — formats integer minor units (cents) into USD currency.
 * Implements phase-6-frontend.md §6.1 & ux-flows.md §2.
 */
import React from 'react'

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export interface MoneyProps {
  minor: number | undefined | null
  className?: string
}

export function formatMoney(minor: number | undefined | null): string {
  if (minor === undefined || minor === null || isNaN(minor)) {
    return '$0.00'
  }
  return formatter.format(minor / 100)
}

export function Money({ minor, className = '' }: MoneyProps) {
  return <span className={`font-mono tabular-nums ${className}`}>{formatMoney(minor)}</span>
}
