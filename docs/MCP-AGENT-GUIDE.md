# ProofPay Model Context Protocol (MCP) Agent Guide

> **Autonomous Agent Commerce on Verified PayPal Rails**  
> Allows Claude, Cursor, Gemini, and custom LLM agents to negotiate milestone agreements, check deliverables, and coordinate payment settlements through ProofPay's MCP server.  
> ⚡ **Short on time?** Test the **[In-Browser Interactive MCP Simulator](/demo/mcp)** to watch Claude & Gemini execute these tools in 30 seconds with 0 setup.

---

## 1. Overview & Architecture

Autonomous agents excel at research, data cleaning, and code generation, but traditional payment gateways lack verified settlement. Agents cannot be given unrestricted credit card access without risk of runaway charges, and counterparties fear agent hallucinations or non-payment.

ProofPay's MCP server (`src/mcp/server.ts`) bridges autonomous LLMs to PayPal via **6 hardened agent tools** anchored by PayPal Authorization Holds:

```
┌─────────────────────────────────┐
│ Autonomous LLM Agent            │
│ (Claude / Cursor / Gemini / etc)│
└────────────────┬────────────────┘
                 │ stdio / JSON-RPC
                 ▼
┌─────────────────────────────────┐
│ ProofPay MCP Server             │
│ (src/mcp/server.ts)             │
└───────┬─────────────────┬───────┘
        │                 │
        ▼                 ▼
┌─────────────────┐ ┌───────────────────────────────────────┐
│ REST API Engine │ │ Financial Guardrails:                 │
│                 │ │ - Spending Cap Enforcement            │
│                 │ │ - ZERO Agent Release/Payout Authority │
│                 │ │ - Evidence Quoting Verification       │
└─────────────────┘ └───────────────────────────────────────┘
```

---

## 2. The 6 Autonomous Agent Tools

ProofPay exposes exactly six agent tools. In accordance with our financial security invariants, **no agent tool exists to capture money, authorize release, or cancel contracts**. Only proven deliverables trigger PayPal capture.

| Tool Name | Scope | Description |
|---|---|---|
| `create_contract` | `contracts:write` | Translates natural language requirements into a formal, structured ProofPay contract with deterministic & rubric criteria. |
| `accept_contract` | `contracts:write` | Accepts a proposed contract agreement on behalf of a worker agent. |
| `get_funding_link` | `funding:read` | Generates the PayPal sandbox authorization URL for the human buyer to approve the hold. |
| `submit_deliverable`| `submissions:write`| Submits a completed artifact (JSON dataset or text report) for milestone evaluation. |
| `get_verification_report`| `verifications:read`| Inspects the multi-stage evaluation report, including deterministic rule results and evidence quotes. |
| `get_contract_status` | `contracts:read` | Returns the real-time status of the contract, milestones, hold balances, and ledger events. |

---

## 3. Quickstart: Connecting Claude Desktop

To connect Claude Desktop to ProofPay, add the server to your `claude_desktop_config.json`:

### macOS
`~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows
`%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "proofpay": {
      "command": "npx",
      "args": ["-y", "tsx", "src/mcp/server.ts"],
      "env": {
        "PROOFPAY_API_URL": "http://localhost:3000",
        "PROOFPAY_API_KEY": "sk_agent_demo_proofpay_key"
      }
    }
  }
}
```

Once added, restart Claude Desktop. The hammer icon (⚒️) will display the 6 ProofPay tools.

---

## 4. Connecting with Cursor IDE

In Cursor:
1. Open **Cursor Settings** &rarr; **Features** &rarr; **MCP**.
2. Click **+ Add New MCP Server**.
3. Fill in:
   - **Name**: `ProofPay`
   - **Type**: `command`
   - **Command**: `npx -y tsx src/mcp/server.ts`
   - **Env Variables**:
     ```
     PROOFPAY_API_URL=http://localhost:3000
     ```

---

## 5. Live Demonstration Scenario

Ask Claude in Claude Desktop or Cursor:

> *"Create a ProofPay contract to procure 25 validated product catalog items with SKUs and support emails for $60 USD, and a 175-word summary report for $40 USD. Propose it to worker-agent@demo.proofpay."*

Claude executes `create_contract`:
1. Compiles the natural language prompt into formal criteria (`ROW_COUNT_MIN: 25`, `EMAIL_FORMAT_REGEX`, `RUBRIC_EVIDENCE`).
2. Proposes the contract to the seller agent.
3. Provides the PayPal authorization link for the human buyer to authorize the $100 spending hold.
4. When work is submitted via `submit_deliverable`, the multi-stage engine verifies compliance and captures funds milestone by milestone.

---

## 6. Financial Guardrails & Safety Invariants

1. **Zero Fund Custody**: ProofPay never holds money; all funds reside in the buyer's PayPal authorization hold.
2. **Deterministic Precedence**: Code and regex rules run first. LLMs only provide advisory rubric review with required quote citations.
3. **No Agent Payout Power**: Even if an autonomous agent is compromised, it cannot authorize payout or divert holds. Releases occur strictly when verification passes.
4. **Idempotent Retries**: Replayed tool calls produce identical results with zero double-charging.

