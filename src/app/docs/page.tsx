'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/common/PageShell'
import { Terminal, Copy, Check, Bot, BookOpen, KeyRound, Shield, ExternalLink, FileCode } from 'lucide-react'

export default function DocsPage() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(id)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const curlCreateSnippet = `curl -X POST https://proofpay.app/api/v1/contracts \\
  -H "Authorization: Bearer pp_k_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "B2B SaaS Lead Generation Dataset",
    "prompt": "Deliver 200 validated fintech leads with work email, title, and linkedin url",
    "total_minor": 150000,
    "currency": "USD"
  }'`

  const mcpConfigSnippet = `{
  "mcpServers": {
    "proofpay": {
      "command": "npx",
      "args": ["-y", "@proofpay/mcp-server"],
      "env": {
        "PROOFPAY_API_KEY": "pp_k_your_api_key_here",
        "PROOFPAY_BASE_URL": "http://localhost:3000"
      }
    }
  }
}`

  const pythonSnippet = `import requests

API_KEY = "pp_k_your_api_key_here"
BASE_URL = "http://localhost:3000/api/v1"

# 1. Synthesize and Create Contract with AI
response = requests.post(
    f"{BASE_URL}/contracts",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "title": "AI Market Research Dataset",
        "prompt": "Extract 50 AI companies with series B funding and founder bios",
        "total_minor": 100000,
        "currency": "USD"
    }
)
contract = response.json()["contract"]
print(f"Contract Created: {contract['id']} (Hash: {contract['contract_hash'][:12]}...)")`

  return (
    <PageShell
      title="Developer Documentation"
      subtitle="Integrate ProofPay into autonomous agent workflows, Cursor, Claude Desktop, and CLI scripts"
    >
      <div className="space-y-12 max-w-4xl pb-16">
        {/* Quickstart Header & Sponsor Resources */}
        <div className="card p-6 border border-border/80 rounded-2xl bg-surface/40 backdrop-blur-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-text">Developer SDKs &amp; Tooling</h3>
            <p className="text-xs text-muted">
              Pre-built Postman collection, APIMatic OpenAPI 3.1 spec, and scoped agent credentials
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/v1/openapi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-border hover:border-brand/40 text-text text-xs font-semibold transition-all shadow-sm"
            >
              <FileCode className="w-3.5 h-3.5 text-brand" />
              <span>OpenAPI 3.1 Spec</span>
            </a>
            <a
              href="/postman/proofpay-postman-collection.json"
              download="proofpay-postman-collection.json"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 text-orange-700 dark:text-orange-400 text-xs font-semibold transition-all whitespace-nowrap"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Postman Collection</span>
            </a>
            <Link
              href="/settings/api-keys"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-md shadow-brand/20 transition-all"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Manage API Keys</span>
            </Link>
          </div>
        </div>

        {/* Section 1: REST API Quickstart */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand/10 text-brand">
              <Terminal className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-text">REST API Quickstart</h2>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            All API requests must include your service account key in the <code className="bg-surface px-1.5 py-0.5 rounded border border-border text-brand font-mono">Authorization</code> header. ProofPay endpoints use integer minor currency units (e.g., $1,500.00 = <code className="text-text font-mono">150000</code>).
          </p>

          <div className="rounded-2xl border border-border/80 bg-surface/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 bg-surface-subtle flex items-center justify-between">
              <span className="text-xs font-mono text-muted">POST /api/v1/contracts</span>
              <button
                type="button"
                onClick={() => copyToClipboard(curlCreateSnippet, 'curl')}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors"
              >
                {copiedSection === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSection === 'curl' ? 'Copied' : 'Copy cURL'}</span>
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-text/90 overflow-x-auto leading-relaxed">
              {curlCreateSnippet}
            </pre>
          </div>
        </div>

        {/* Section 2: MCP Server Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Bot className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-text">Model Context Protocol (MCP) Setup</h2>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Connect Claude Desktop, Cursor, or OpenManus directly to ProofPay to let your AI agents negotiate, verify, and track contract milestones autonomously. Add this snippet to your <code className="bg-surface px-1.5 py-0.5 rounded border border-border text-brand font-mono">claude_desktop_config.json</code>:
          </p>

          <div className="rounded-2xl border border-border/80 bg-surface/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 bg-surface-subtle flex items-center justify-between">
              <span className="text-xs font-mono text-muted">claude_desktop_config.json</span>
              <button
                type="button"
                onClick={() => copyToClipboard(mcpConfigSnippet, 'mcp')}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors"
              >
                {copiedSection === 'mcp' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSection === 'mcp' ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-text/90 overflow-x-auto leading-relaxed">
              {mcpConfigSnippet}
            </pre>
          </div>
        </div>

        {/* Section 3: Python Agent Integration */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-text">Python Script Example</h2>
          </div>

          <div className="rounded-2xl border border-border/80 bg-surface/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 bg-surface-subtle flex items-center justify-between">
              <span className="text-xs font-mono text-muted">agent_workflow.py</span>
              <button
                type="button"
                onClick={() => copyToClipboard(pythonSnippet, 'python')}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors"
              >
                {copiedSection === 'python' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSection === 'python' ? 'Copied' : 'Copy Python'}</span>
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-text/90 overflow-x-auto leading-relaxed">
              {pythonSnippet}
            </pre>
          </div>
        </div>

        {/* Section 4: Ecosystem Integrations & Toolkits */}
        <div className="space-y-6 pt-4 border-t border-border/60">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-text">Ecosystem Integrations &amp; Toolkits</h2>
            <p className="text-xs text-muted">
              Built-in integrations for API testing, SDK generation, ledger inspection, event streaming, and cloud deployment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Postman */}
            <div className="p-5 rounded-2xl bg-surface border border-border/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-text">Postman Collection</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-400 font-semibold border border-orange-500/20">
                  Ready to Import
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Complete REST API collection and sandbox environment for 1-click endpoint testing.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <a
                  href="/postman/proofpay-postman-collection.json"
                  download="proofpay-postman-collection.json"
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Download Collection ↓
                </a>
                <span className="text-muted text-xs">•</span>
                <a
                  href="/postman/proofpay-sandbox.postman_environment.json"
                  download="proofpay-sandbox.postman_environment.json"
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Environment ↓
                </a>
              </div>
            </div>

            {/* APIMatic */}
            <div className="p-5 rounded-2xl bg-surface border border-border/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-text">APIMatic SDKs</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400 font-semibold border border-purple-500/20">
                  OpenAPI 3.1
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Turnkey <code className="font-mono text-text">apimatic.json</code> configuration for generating SDKs in Python, TS, C#, Java, Go, and PHP.
              </p>
              <div className="pt-1">
                <a
                  href="/openapi.json"
                  download="openapi.json"
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Download OpenAPI 3.1 Spec ↓
                </a>
              </div>
            </div>

            {/* AG Grid */}
            <div className="p-5 rounded-2xl bg-surface border border-border/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-text">AG Grid Ledger</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 font-semibold border border-blue-500/20">
                  AG Grid v33
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                High-performance financial audit grid with live column filtering, sorting, and CSV export.
              </p>
              <div className="pt-1">
                <Link
                  href="/ledger"
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Open AG Grid Ledger →
                </Link>
              </div>
            </div>

            {/* Elastic */}
            <div className="p-5 rounded-2xl bg-surface border border-border/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-text">Elastic (ECS) Feed</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                  ECS 8.x
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Elastic Common Schema stream for indexing cryptographic proofs and PayPal state transitions into Elasticsearch.
              </p>
              <div className="pt-1">
                <a
                  href="/api/v1/ledger/elastic?format=ndjson"
                  download="proofpay-elastic-bulk.ndjson"
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Download Bulk NDJSON ↓
                </a>
              </div>
            </div>

            {/* Zapier */}
            <div className="p-5 rounded-2xl bg-surface border border-border/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-text">Zapier Webhooks</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20">
                  HMAC-SHA256
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Signed outbound event triggers to fire Zaps on contract funding, verification verdicts, and PayPal releases.
              </p>
              <div className="pt-1">
                <Link
                  href="/settings/webhooks"
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Configure Zapier Webhook →
                </Link>
              </div>
            </div>

            {/* Render */}
            <div className="p-5 rounded-2xl bg-surface border border-border/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-text">Render Cloud Deploy</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 font-semibold border border-cyan-500/20">
                  render.yaml
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Infrastructure-as-code blueprint deploying web service, worker process, and PostgreSQL 16 database.
              </p>
              <div className="pt-1">
                <span className="text-xs font-mono text-muted">
                  render.yaml in repo root
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
