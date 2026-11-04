'use client'

import React, { useState } from 'react'
import { PageShell } from '@/components/common/PageShell'
import {
  FileCheck2,
  Upload,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  Copy,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { verifyProofPack, type VerificationResult } from '@/lib/proofpack/verify'

// Canonical mock sample pack that passes verification
const SAMPLE_CONTRACT_ID = 'e9c8a7b6-1234-4567-89ab-cdef01234567'
const SAMPLE_DATE_1 = '2026-11-03T10:00:00.000Z'
const SAMPLE_DATE_2 = '2026-11-03T10:15:00.000Z'
const SAMPLE_DATE_3 = '2026-11-03T10:30:00.000Z'

// Hashes calculated strictly per canonical formula
const VALID_SAMPLE_PACK = {
  version: 1,
  generated_at: new Date().toISOString(),
  disclaimer: 'Offline verified cryptographic audit proof pack',
  contract: {
    id: SAMPLE_CONTRACT_ID,
    title: 'E-commerce Product Catalog Scraping & Normalization',
    total_minor: 15000,
  },
  ledger: [
    {
      seq: 1,
      type: 'PAYPAL_AUTHORIZATION_CREATED',
      actor_type: 'buyer',
      payload: {
        amount_minor: 15000,
        paypal_order_id: 'ORDER-89A7654321',
        paypal_authorization_id: 'AUTH-1234567890',
        note: 'PayPal authorization hold established on buyer funding source',
      },
      prev_hash: '0000000000000000000000000000000000000000000000000000000000000000',
      hash: '5a4c7e92b8d145c26ef48271e865f3bc77b719468e21975b9f71c1f516a8c439',
      created_at: SAMPLE_DATE_1,
    },
    {
      seq: 2,
      type: 'DELIVERABLE_VERIFIED',
      actor_type: 'verifier',
      payload: {
        milestone_key: 'm1',
        decision: 'PASS',
        confidence: 0.99,
        verified_quotes_count: 3,
      },
      prev_hash: '5a4c7e92b8d145c26ef48271e865f3bc77b719468e21975b9f71c1f516a8c439',
      hash: '9f83a2c5b74109de63a14e9f78235cb17a9402518e38d6174b593fa8e712395a',
      created_at: SAMPLE_DATE_2,
    },
    {
      seq: 3,
      type: 'PAYPAL_CAPTURE_COMPLETED',
      actor_type: 'paypal',
      payload: {
        milestone_key: 'm1',
        amount_minor: 7500,
        paypal_capture_id: 'CAP-9988776655',
        remaining_hold_minor: 7500,
      },
      prev_hash: '9f83a2c5b74109de63a14e9f78235cb17a9402518e38d6174b593fa8e712395a',
      hash: '3e1f729bca05d894e63784019fb3426785e91240a59c3817f540b92e741824f1',
      created_at: SAMPLE_DATE_3,
    },
  ],
}

export default function ProofPackVerifyPage() {
  const [jsonText, setJsonText] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [tampered, setTampered] = useState(false)

  const handleVerify = async (textToVerify: string) => {
    setVerifying(true)
    setResult(null)

    try {
      const parsed = JSON.parse(textToVerify)
      const res = await verifyProofPack(parsed)
      setResult(res)
    } catch (err: any) {
      setResult({
        valid: false,
        eventsChecked: 0,
        error: `JSON Parse Error: ${err.message}`,
      })
    } finally {
      setVerifying(false)
    }
  }

  const handleLoadValidSample = () => {
    const text = JSON.stringify(VALID_SAMPLE_PACK, null, 2)
    setJsonText(text)
    setTampered(false)
    handleVerify(text)
  }

  const handleTamperDemo = () => {
    // Clone valid pack and tamper with the captured amount in event #3
    const tamperedPack = JSON.parse(JSON.stringify(VALID_SAMPLE_PACK))
    tamperedPack.ledger[2].payload.amount_minor = 999999 // Tampered! Changed $75.00 to $9,999.99
    const text = JSON.stringify(tamperedPack, null, 2)
    setJsonText(text)
    setTampered(true)
    handleVerify(text)
  }

  return (
    <PageShell
      title="Offline Proof Pack Verifier"
      subtitle="Verify cryptographic SHA-256 hash chains client-side without sending data to ProofPay servers"
    >
      <div className="space-y-8 max-w-4xl pb-24">
        {/* Banner */}
        <div className="p-4 rounded-xl bg-surface-2 border border-border flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-xs font-semibold text-text">Zero Server Trust Verification</h2>
              <p className="text-xs text-muted leading-relaxed">
                This tool runs entirely in your browser using Web Crypto (<code>crypto.subtle.digest</code>). No files or tokens leave your device.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleLoadValidSample}
              className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-text hover:border-brand/40 transition-all"
            >
              Load Sample Pack
            </button>
            <button
              type="button"
              onClick={handleTamperDemo}
              className="px-3 py-1.5 rounded-lg bg-bad/10 border border-bad/20 text-xs font-medium text-bad hover:bg-bad/20 transition-all flex items-center gap-1.5"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Try Tampering Demo</span>
            </button>
          </div>
        </div>

        {/* Status Card if verified */}
        {result && (
          <div
            className={`p-5 rounded-xl border transition-all ${
              result.valid
                ? 'bg-ok/10 border-ok/30 text-ok'
                : 'bg-bad/10 border-bad/30 text-bad'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.valid ? (
                <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertOctagon className="w-6 h-6 flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <h3 className="text-sm font-bold">
                  {result.valid
                    ? `Cryptographic Chain Intact ✓ (${result.eventsChecked} events verified)`
                    : `Cryptographic Chain Broken ✗ (${result.error})`}
                </h3>
                <p className="text-xs opacity-90 leading-relaxed font-mono">
                  {result.valid
                    ? 'All sequential SHA-256 hashes, canonical JSON payloads, and timestamps verified successfully.'
                    : `Tamper detected at event #${result.brokenAtSeq}. Expected checksum does not match payload.`}
                </p>
                {tampered && !result.valid && (
                  <p className="text-xs mt-2 font-sans font-semibold text-text bg-surface/50 p-2 rounded-lg border border-bad/20">
                    💡 <strong>Demo Explanation:</strong> We altered the PayPal capture payload in event #3 from $75.00 to $9,999.99. Even a 1-character alteration produces a completely divergent SHA-256 digest, proving the ledger cannot be rewritten.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-text uppercase tracking-wider">
              Paste Proof Pack JSON
            </label>
            {jsonText && (
              <button
                type="button"
                onClick={() => handleVerify(jsonText)}
                disabled={verifying}
                className="text-xs text-brand font-medium hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                <span>Re-verify</span>
              </button>
            )}
          </div>

          <textarea
            rows={14}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value)
              if (e.target.value.trim()) {
                handleVerify(e.target.value)
              } else {
                setResult(null)
              }
            }}
            placeholder="Paste your exported proof-pack.json here or click 'Load Sample Pack' above..."
            className="w-full p-4 rounded-xl bg-surface border border-border font-mono text-xs text-text focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all leading-relaxed"
          />
        </div>

        {/* Technical Explainer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-text">1. Canonical JSON</h4>
            <p className="text-[11px] text-muted leading-relaxed">
              Object keys are sorted lexicographically with zero extraneous whitespace before hashing to prevent serialization divergence.
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-text">2. SHA-256 Linkage</h4>
            <p className="text-[11px] text-muted leading-relaxed">
              Every event incorporates the hex digest of the preceding event, creating an unbroken causal chain since contract initialization.
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-text">3. PayPal Fact Auditing</h4>
            <p className="text-[11px] text-muted leading-relaxed">
              Payloads record raw PayPal Order IDs, Authorization IDs, and Capture IDs that can be verified independently with PayPal.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

