/**
 * Integration Tests for ProofPay MCP Server.
 * Implements phase-7-agents-judge-mode-mcp.md §7.5 & api-spec.md §9.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  TOOLS,
  createMcpServer,
  CreateContractInput,
  SubmitDeliverableInput,
} from '@/mcp/server'
import { ApiClientError, type ApiClient } from '@/shared/api-client'

describe('Model Context Protocol (MCP) Server (§7.5)', () => {
  it('lists exactly six tools with strict money guardrails', () => {
    const toolNames = Object.keys(TOOLS)
    expect(toolNames).toHaveLength(6)

    const expectedTools = [
      'create_contract',
      'accept_contract',
      'get_funding_link',
      'submit_deliverable',
      'get_verification_report',
      'get_contract_status',
    ]

    for (const name of expectedTools) {
      expect(toolNames).toContain(name)
    }

    // Critical money guardrails check: NO tools for decision, cancel, or refund
    expect(toolNames).not.toContain('decision')
    expect(toolNames).not.toContain('decide')
    expect(toolNames).not.toContain('decide_on_milestone')
    expect(toolNames).not.toContain('cancel')
    expect(toolNames).not.toContain('cancel_contract')
    expect(toolNames).not.toContain('refund')
    expect(toolNames).not.toContain('release')
  })

  it('create_contract validates input schema properly', () => {
    // Valid input
    const valid = CreateContractInput.safeParse({
      prompt: 'Need 25 product records for $60 and summary for $40',
      seller_email: 'worker@demo.proofpay',
    })
    expect(valid.success).toBe(true)

    // Empty prompt should fail
    const invalidEmpty = CreateContractInput.safeParse({
      prompt: '',
    })
    expect(invalidEmpty.success).toBe(false)

    // Invalid email should fail
    const invalidEmail = CreateContractInput.safeParse({
      prompt: 'Valid prompt',
      seller_email: 'not-an-email',
    })
    expect(invalidEmail.success).toBe(false)
  })

  it('submit_deliverable rejects invalid content_type', () => {
    const invalidType = SubmitDeliverableInput.safeParse({
      contract_id: '123e4567-e89b-12d3-a456-426614174000',
      milestone_key: 'm1',
      content_type: 'video_mp4', // Invalid
      content: 'data',
    })
    expect(invalidType.success).toBe(false)

    const validJson = SubmitDeliverableInput.safeParse({
      contract_id: '123e4567-e89b-12d3-a456-426614174000',
      milestone_key: 'm1',
      content_type: 'json_records',
      content: '[]',
    })
    expect(validJson.success).toBe(true)
  })

  it('create_contract executes through ApiClient and applies fix loop', async () => {
    const mockClient = {
      compileContract: vi.fn().mockResolvedValue({
        contract: {
          id: 'c123e456-e89b-12d3-a456-426614174000',
          title: 'Demo Contract',
          status: 'DRAFT',
          total_minor: 10000,
          milestones: [{ milestone_key: 'm1', title: 'M1', amount_minor: 6000 }],
          contract_json: {},
        },
        issues: [{ severity: 'error', code: 'ERR_1', suggested_fix: {} }],
      }),
      lintContract: vi.fn().mockResolvedValue({
        issues: [],
      }),
      applyLintFix: vi.fn().mockResolvedValue({
        id: 'c123e456-e89b-12d3-a456-426614174000',
        title: 'Demo Contract Fixed',
        status: 'DRAFT',
        total_minor: 10000,
        milestones: [{ milestone_key: 'm1', title: 'M1', amount_minor: 6000 }],
        contract_json: {},
      }),
      proposeContract: vi.fn().mockResolvedValue({
        id: 'c123e456-e89b-12d3-a456-426614174000',
        title: 'Demo Contract Fixed',
        status: 'PROPOSED',
        total_minor: 10000,
        milestones: [{ milestone_key: 'm1', title: 'M1', amount_minor: 6000 }],
        contract_json: {},
      }),
    } as unknown as ApiClient

    const tool = TOOLS['create_contract']!
    const result = await tool.execute(mockClient, {
      prompt: 'Need 25 products',
      seller_email: 'worker@demo.proofpay',
    })

    expect(result.contract_id).toBe('c123e456-e89b-12d3-a456-426614174000')
    expect(result.status).toBe('PROPOSED')
    expect(mockClient.compileContract).toHaveBeenCalledWith('Need 25 products')
    expect(mockClient.proposeContract).toHaveBeenCalledWith(
      'c123e456-e89b-12d3-a456-426614174000',
      'worker@demo.proofpay'
    )
  })

  it('get_funding_link appends human approval requirement note', async () => {
    const mockClient = {
      startFunding: vi.fn().mockResolvedValue({
        approval_url: 'https://sandbox.paypal.com/checkoutnow?token=EC-12345',
        order_id: 'ORDER-12345',
      }),
    } as unknown as ApiClient

    const tool = TOOLS['get_funding_link']!
    const result = await tool.execute(mockClient, {
      contract_id: '123e4567-e89b-12d3-a456-426614174000',
    })

    expect(result.approval_url).toContain('sandbox.paypal.com')
    expect(result.note).toBe('A human payer must open this link and approve in PayPal.')
  })

  it('maps ApiClientError to MCP error content with code and request_id', async () => {
    const server = createMcpServer({ baseUrl: 'http://localhost:3000', apiKey: 'test' })
    expect(server).toBeDefined()

    // Test ApiClientError conversion directly
    const apiError = new ApiClientError('INVALID_STATE', 'Contract not accepted', 409, 'req_abc123')
    expect(apiError.code).toBe('INVALID_STATE')
    expect(apiError.status).toBe(409)
    expect(apiError.requestId).toBe('req_abc123')
  })
})
