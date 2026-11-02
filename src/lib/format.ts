/**
 * Formatting utilities for timestamps, durations, and cryptographic hashes.
 * Implements phase-6-frontend.md §6.1.
 */

/**
 * Format duration in milliseconds into a compact human-readable string.
 * Examples:
 * - 187,200,000 ms -> "2d 4h"
 * - 170,000,000 ms -> "1d 23h"
 * - 7,200,000 ms -> "2h 0m"
 * - 120,000 ms -> "2m"
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '0m'

  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${Math.max(1, minutes)}m`
}

/**
 * Truncates a 64-char SHA-256 hash or UUID to its first N chars (default 8).
 */
export function shortHash(hash: string | undefined | null, length = 8): string {
  if (!hash) return ''
  return hash.slice(0, length)
}

/**
 * Converts an ISO string or Date into a concise relative time string.
 * e.g. "just now", "5m ago", "2h ago", "yesterday", "in 2d"
 */
export function relativeTime(isoOrDate: string | Date | undefined | null): string {
  if (!isoOrDate) return ''
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 0) {
    // future
    const absSec = Math.abs(diffSec)
    if (absSec < 60) return 'in a few seconds'
    if (absSec < 3600) return `in ${Math.floor(absSec / 60)}m`
    if (absSec < 86400) return `in ${Math.floor(absSec / 3600)}h`
    return `in ${Math.floor(absSec / 86400)}d`
  }

  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 172800) return 'yesterday'
  return `${Math.floor(diffSec / 86400)}d ago`
}
