import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-semibold tracking-wide uppercase">
          PayPal AI Hackathon 2026
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-text">
          Pay when it&apos;s <span className="text-brand">proven.</span>
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-muted">
          AI reads and explains; deterministic code decides; PayPal settles.
          Never pay upfront for unverifiable work. Never chase an invoice again.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/studio"
            className="px-6 py-3 rounded-lg bg-brand text-white font-medium shadow-md hover:opacity-95 transition-all text-sm"
          >
            Create Contract
          </Link>
          <a
            href="#judge-mode"
            className="px-6 py-3 rounded-lg bg-surface border border-border text-text font-medium hover:bg-surface-2 transition-all text-sm"
          >
            Judge Mode &amp; Scenarios
          </a>
        </div>

        {/* The Honesty Line */}
        <p className="text-xs text-muted/80 max-w-lg mx-auto italic pt-2">
          PayPal authorization hold, not escrow. Sandbox only.
        </p>
      </div>

      {/* Three Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
        <div className="p-6 rounded-xl bg-surface border border-border shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold">
            1
          </div>
          <h2 className="text-lg font-semibold text-text">Compile &amp; Lint</h2>
          <p className="text-sm text-muted">
            Translate plain-English agreements into strict, machine-checkable acceptance criteria with automated linting for ambiguity.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-surface border border-border shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-lg bg-ok/10 text-ok flex items-center justify-center font-bold">
            2
          </div>
          <h2 className="text-lg font-semibold text-text">Authorization Hold</h2>
          <p className="text-sm text-muted">
            PayPal authorization places a 29-day hold on the buyer&apos;s funds without charging. Proof of funds before seller starts work.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-surface border border-border shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold">
            3
          </div>
          <h2 className="text-lg font-semibold text-text">Prove &amp; Release</h2>
          <p className="text-sm text-muted">
            4-stage verification pipeline runs deterministic schemas, LLM rubric, and adversarial checks. Code triggers PayPal partial captures.
          </p>
        </div>
      </div>

      {/* Judge Mode & Demo Personas */}
      <div id="judge-mode" className="mt-16 p-8 rounded-2xl bg-surface border border-border shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-text">Judge Mode &amp; Interactive Personas</h2>
            <p className="text-xs text-muted mt-1">One-click test environments with pre-configured PayPal sandbox accounts</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono bg-surface-2 text-muted border border-border">
            DEMO_MODE=active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-surface-2/60 border border-border space-y-2">
            <span className="text-xs font-semibold uppercase text-brand">Buyer</span>
            <div className="font-medium text-sm text-text">Sarah Buyer</div>
            <p className="text-xs text-muted">Creates contracts, deposits PayPal authorization holds.</p>
          </div>
          <div className="p-4 rounded-lg bg-surface-2/60 border border-border space-y-2">
            <span className="text-xs font-semibold uppercase text-ok">Seller</span>
            <div className="font-medium text-sm text-text">Alex Seller</div>
            <p className="text-xs text-muted">Submits milestone deliverables and verifies evidence.</p>
          </div>
          <div className="p-4 rounded-lg bg-surface-2/60 border border-border space-y-2">
            <span className="text-xs font-semibold uppercase text-brand">AI Agent Buyer</span>
            <div className="font-medium text-sm text-text">ProcureBot</div>
            <p className="text-xs text-muted">Autonomous agent ordering data synthesis via API.</p>
          </div>
          <div className="p-4 rounded-lg bg-surface-2/60 border border-border space-y-2">
            <span className="text-xs font-semibold uppercase text-ok">AI Worker Agent</span>
            <div className="font-medium text-sm text-text">SynthetixBot</div>
            <p className="text-xs text-muted">Autonomous worker delivering verified JSON data.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
