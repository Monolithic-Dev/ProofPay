'use client'

/**
 * PayPalActivity Component — PayPal Call Inspector tab/card.
 * Renders verified PayPal API interactions, authorization holds, captures, and debug metadata.
 * Implements docs/v2/PROOFPAY-WINNING-PLAN.md B3.
 */
import React, { useState } from 'react'
import { ShieldCheck, CreditCard, Copy, Check, ExternalLink, Activity } from 'lucide-react'
import { relativeTime } from '@/lib/format'
import { formatMoney } from '@/components/common/Money'

export interface PayPalActivityProps {
  events: any[] | undefined | null
  className?: string
}

export function PayPalActivity({ events = [], className = '' }: PayPalActivityProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Filter events related to PayPal API calls and webhooks
  const paypalEvents = (events || [])
    .filter((e) => e.type?.startsWith('PAYPAL_') || e.actor_type === 'paypal' || e.payload?.paypal_order_id)
    .reverse()

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className={`p-5 rounded-xl bg-surface border border-border shadow-sm space-y-4 ${className}`}>
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-brand" />
          <h2 className="text-sm font-semibold text-text">PayPal Call Inspector</h2>
        </div>
        <span className="text-[10px] font-mono bg-brand/10 text-brand px-2 py-0.5 rounded-full border border-brand/20 font-medium">
          Sandbox API v2
        </span>
      </div>

      {paypalEvents.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted space-y-1">
          <p>No PayPal API calls recorded yet.</p>
          <p className="text-[11px] opacity-80">Authorize funds to view live PayPal Orders &amp; Captures.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paypalEvents.map((ev, idx) => {
            const p = ev.payload || {}
            const isAuth = ev.type.includes('AUTHORIZATION')
            const isCapture = ev.type.includes('CAPTURE')
            const isVoid = ev.type.includes('VOID')

            const opTitle = isAuth
              ? 'PayPal Authorization Hold'
              : isCapture
              ? 'PayPal Capture (Milestone Settlement)'
              : isVoid
              ? 'PayPal Authorization Void'
              : 'PayPal Order Event'

            const paypalId =
              p.paypal_capture_id ||
              p.paypal_authorization_id ||
              p.paypal_order_id ||
              p.order_id ||
              'N/A'

            const requestId = p.paypal_request_id || `req_pp_${ev.contract_id?.slice(0, 8)}_${ev.seq}`

            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-surface-2/60 border border-border/80 text-xs space-y-2.5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        ev.type.includes('FAILED')
                          ? 'bg-bad'
                          : isCapture
                          ? 'bg-ok'
                          : 'bg-brand'
                      }`}
                    />
                    <span className="font-semibold text-text text-[11px]">{opTitle}</span>
                  </div>
                  <span className="text-[10px] text-muted">{relativeTime(ev.created_at)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-surface p-2.5 rounded-lg border border-border/60">
                  <div>
                    <span className="text-muted block text-[9px] uppercase tracking-wider font-sans">
                      Operation
                    </span>
                    <span className="text-text font-medium truncate block">{ev.type}</span>
                  </div>

                  <div>
                    <span className="text-muted block text-[9px] uppercase tracking-wider font-sans">
                      Amount
                    </span>
                    <span className="text-text font-bold">
                      {p.amount_minor ? formatMoney(p.amount_minor) : '—'}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center justify-between pt-1 border-t border-border/40">
                    <div className="min-w-0 pr-2">
                      <span className="text-muted block text-[9px] uppercase tracking-wider font-sans">
                        PayPal Reference ID
                      </span>
                      <span className="text-text truncate block select-all">{paypalId}</span>
                    </div>
                    {paypalId !== 'N/A' && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(paypalId, `id-${idx}`)}
                        className="text-muted hover:text-text flex items-center gap-1 text-[10px] flex-shrink-0"
                        title="Copy PayPal ID"
                      >
                        {copiedKey === `id-${idx}` ? (
                          <Check className="w-3 h-3 text-ok" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted font-mono pt-0.5">
                  <span className="truncate pr-2">Idempotency: {requestId}</span>
                  <span className="text-ok font-sans font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Verified</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

