'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import {
  HelpCircle,
  MessageSquare,
  ShieldCheck,
  DollarSign,
  Bot,
  Scale,
  Send,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Mail,
  ArrowRight,
} from 'lucide-react'

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  // Ticket form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('general')
  const [contractId, setContractId] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedTicket, setSubmittedTicket] = useState<any | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const faqs = [
    {
      q: 'What is a PayPal authorization hold, and is this escrow?',
      a: 'ProofPay is NOT an escrow service and never holds or pools user money. When an agreement is funded, a standard PayPal authorization hold is placed on the buyer’s PayPal funding source. Funds remain reserved with PayPal for up to 29 days, and are only captured directly to the seller when delivered work meets 100% of agreed verification criteria.',
    },
    {
      q: 'How does automated milestone verification work?',
      a: 'Each milestone defines exact, verifiable acceptance criteria (e.g., minimum row counts, JSON schema compliance, automated code passes, or multi-metric AI evaluation). When a seller submits deliverable proof, ProofPay runs deterministic checks and generates an immutable cryptographic verification report and hash-chained ledger entry.',
    },
    {
      q: 'What happens if a milestone delivery fails or is rejected?',
      a: 'If delivered work does not meet the criteria, the seller receives structured feedback specifying the exact lines, rows, or criteria that failed, along with clear instructions to fix and resubmit. If a dispute arises, the buyer can manually review the evidence or escalate to human mediation.',
    },
    {
      q: 'Can autonomous AI agents use ProofPay?',
      a: 'Yes. Autonomous agents (e.g., LangChain, AutoGen, CrewAI, or Claude Desktop) can register Service Accounts with granular scopes (e.g., contracts:write, submissions:write) and strict budget caps. Agents can propose agreements and submit deliverables via our REST API or Model Context Protocol (MCP) tools.',
    },
    {
      q: 'How does ProofPay prevent prompt injection or manipulated test results?',
      a: 'ProofPay isolates deliverable evaluation in hardened sandboxes, enforces strict schema matching, quotes exact evidence chunks in every report, and validates cryptographic hashes. The LLM acts solely as an advisory evaluator while the deterministic rules engine holds the absolute decision authority.',
    },
  ]

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/v1/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          category,
          contract_id: contractId.trim() || undefined,
          message: message.trim(),
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Failed to submit support ticket')
      }

      const data = await res.json()
      setSubmittedTicket(data.ticket)
      setName('')
      setEmail('')
      setSubject('')
      setMessage('')
      setContractId('')
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not send support ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageShell
      title="Help & Support Center"
      subtitle="Frequently asked questions about PayPal authorization holds, verification rules, and dedicated assistance."
    >
      <div className="space-y-10">
        {/* FAQ Accordion */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-brand" />
            <h3 className="text-base font-bold text-text">Frequently Asked Questions</h3>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs transition-colors"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-text hover:bg-surface-2 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-muted shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-muted leading-relaxed border-t border-border/40 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Contact & Support Form */}
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 rounded-xl bg-brand/10 text-brand">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-text">Submit a Support Request</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed mb-6">
              Need assistance with a PayPal authorization hold, agreement verification criteria, or dispute mediation? Our team and mediation desk respond promptly.
            </p>

            {submittedTicket ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Support Ticket Submitted (#{submittedTicket.id.slice(0, 8)})</span>
                </div>
                <p className="text-muted leading-relaxed">
                  Thank you! We have received your inquiry regarding <strong>&quot;{submittedTicket.subject}&quot;</strong>. A confirmation has been logged and a support representative will follow up with you at <strong>{submittedTicket.email}</strong>.
                </p>
                <button
                  onClick={() => setSubmittedTicket(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border text-text font-medium hover:bg-surface-2 transition-colors mt-2"
                >
                  Submit Another Request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitTicket} className="space-y-4 text-xs">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                    {errorMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-text mb-1">Your Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Miller"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text placeholder-muted focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-text mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. sarah@acme.inc"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text placeholder-muted focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-text mb-1">Category *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text focus:outline-none focus:border-brand"
                    >
                      <option value="general">General Support</option>
                      <option value="funding">PayPal Authorization & Holds</option>
                      <option value="verification">Milestone Criteria Verification</option>
                      <option value="mediation">Dispute Mediation</option>
                      <option value="agents">Machine Agents & API / MCP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-text mb-1">Agreement ID (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. c7a2b910-..."
                      value={contractId}
                      onChange={(e) => setContractId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text font-mono placeholder-muted focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-text mb-1">Subject *</label>
                  <input
                    type="text"
                    required
                    placeholder="Brief description of your question or issue"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text placeholder-muted focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block font-medium text-text mb-1">Message *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Please include relevant details, error messages, or steps..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text placeholder-muted focus:outline-none focus:border-brand resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold shadow-md shadow-brand/20 transition-all disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Sending Request…' : 'Submit Ticket'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
