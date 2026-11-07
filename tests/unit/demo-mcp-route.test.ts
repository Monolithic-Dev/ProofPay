import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/v1/demo/mcp/route'
import { NextRequest } from 'next/server'

describe('Demo MCP API Route (/api/v1/demo/mcp)', () => {
  beforeEach(() => {
    vi.stubEnv('DEMO_MODE', 'true')
  })

  it('GET returns tool definitions and zero-custody financial guardrails', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/demo/mcp')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.status).toBe('ready')
    expect(data.protocol).toBe('Model Context Protocol (MCP) JSON-RPC 2.0')
    expect(data.tools).toHaveLength(6)

    const toolNames = data.tools.map((t: { name: string }) => t.name)
    expect(toolNames).toContain('create_contract')
    expect(toolNames).toContain('get_funding_link')
    expect(toolNames).toContain('submit_deliverable')

    expect(data.financial_guardrails).toBeDefined()
    expect(data.financial_guardrails.fund_custody).toContain('ZERO_CUSTODY')
    expect(data.financial_guardrails.agent_payout_authority).toBe('FORBIDDEN')
  })

  it('POST handles tools execution for create_contract simulation', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/demo/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'create_contract',
        arguments: {
          prompt: 'Procure 25 verified records from SynthetixBot for $10 USD',
          seller_email: 'synthetixbot@agent.network',
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.jsonrpc).toBe('2.0')
    expect(data.result.content[0].type).toBe('text')

    const parsedContent = JSON.parse(data.result.content[0].text)
    expect(parsedContent.contract_id).toBeDefined()
    expect(parsedContent.status).toBe('PROPOSED')
    expect(parsedContent.proposed_to).toBe('synthetixbot@agent.network')
  })

  it('POST rejects invalid tool arguments with -32602 JSON-RPC error', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/demo/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'create_contract',
        arguments: {
          prompt: '', // Empty prompt is invalid according to CreateContractInput schema
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.jsonrpc).toBe('2.0')
    expect(data.error.code).toBe(-32602)
    expect(data.error.message).toBe('Invalid tool arguments')
  })

  it('POST rejects unknown tool with 400 validation error', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/demo/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'decide_on_milestone', // disallowed / unknown
        arguments: {},
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBeDefined()
  })
})
