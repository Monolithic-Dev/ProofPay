/**
 * Model Context Protocol (MCP) Server for ProofPay.
 * Exposes exactly six autonomous agent tools with strict money guardrails.
 * Implements phase-7-agents-judge-mode-mcp.md §7.5 & api-spec.md §9.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { z } from 'zod'
import { createApiClient, ApiClientError, type ApiClient } from '@/shared/api-client'

// ---------------------------------------------------------------------------
// Environment & Config
// ---------------------------------------------------------------------------
const EnvConfigSchema = z.object({
  PROOFPAY_API_URL: z.string().url().default('http://localhost:3000'),
  PROOFPAY_API_KEY: z.string().min(1).optional(),
})

// ---------------------------------------------------------------------------
// Tool Schemas & Definitions
// ---------------------------------------------------------------------------
export const CreateContractInput = z.object({
  prompt: z
    .string()
    .min(1)
    .max(2000)
    .describe('Natural language specification of work, milestones, deliverables, and payment amounts'),
  seller_email: z
    .string()
    .email()
    .optional()
    .describe('Optional email of the seller/worker agent to propose the contract to immediately'),
  budget_cap_minor: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Optional hard budget cap in USD cents'),
})

export const AcceptContractInput = z.object({
  contract_id: z.string().uuid().describe('The UUID of the proposed contract to accept'),
})

export const GetFundingLinkInput = z.object({
  contract_id: z.string().uuid().describe('The UUID of the contract requiring PayPal authorization'),
})

export const SubmitDeliverableInput = z.object({
  contract_id: z.string().uuid().describe('The UUID of the contract'),
  milestone_key: z.string().describe("The milestone key to submit for (e.g. 'm1', 'm2')"),
  content_type: z
    .enum(['json_records', 'text'])
    .describe("The format of the deliverable: 'json_records' or 'text'"),
  content: z
    .string()
    .describe('The raw text or JSON string containing the deliverable artifact'),
  note: z.string().optional().describe('Optional message describing the submission or changes made'),
})

export const GetVerificationReportInput = z.object({
  verification_id: z.string().describe('The UUID of the verification run to inspect'),
})

export const GetContractStatusInput = z.object({
  contract_id: z.string().uuid().describe('The UUID of the contract to check'),
})

export interface ToolDefinition {
  name: string
  description: string
  schema: z.ZodTypeAny
  inputSchema: Record<string, unknown>
  execute: (client: ApiClient, args: any) => Promise<any>
}

export const TOOLS: Record<string, ToolDefinition> = {
  create_contract: {
    name: 'create_contract',
    description:
      'Compiles a natural language job description into a formal ProofPay verified contract and optionally proposes it to a seller.',
    schema: CreateContractInput,
    inputSchema: zodToJsonSchema(CreateContractInput) as Record<string, unknown>,
    execute: async (client, args) => {
      const compileRes = await client.compileContract(args.prompt)
      let contract = compileRes.contract

      // Automatically apply fixable lint issues
      if (compileRes.issues && compileRes.issues.length > 0) {
        let iterations = 0
        while (iterations < 5) {
          const lintRes = await client.lintContract(contract.id)
          const fixable = lintRes.issues.find((i) => i.severity === 'error' && i.suggested_fix)
          if (!fixable) break
          contract = await client.applyLintFix(contract.id, fixable.code)
          iterations++
        }
      }

      // If seller email provided, propose it
      if (args.seller_email) {
        contract = await client.proposeContract(contract.id, args.seller_email)
      }

      return {
        contract_id: contract.id,
        title: contract.title,
        status: contract.status,
        total_minor: contract.total_minor,
        milestones: contract.milestones?.map((m) => ({
          key: m.milestone_key,
          title: m.title,
          amount_minor: m.amount_minor,
        })),
        contract_json: contract.contract_json,
      }
    },
  },

  accept_contract: {
    name: 'accept_contract',
    description:
      'Worker/Seller agent accepts the proposed contract terms, locking the contract specifications and computing the cryptographic contract hash.',
    schema: AcceptContractInput,
    inputSchema: zodToJsonSchema(AcceptContractInput) as Record<string, unknown>,
    execute: async (client, args) => {
      const contract = await client.acceptContract(args.contract_id)
      return {
        contract_id: contract.id,
        status: contract.status,
        contract_hash: contract.contract_hash,
        accepted_at: contract.accepted_at,
      }
    },
  },

  get_funding_link: {
    name: 'get_funding_link',
    description:
      'Generates the PayPal escrow authorization URL. A human payer must open this link to approve the authorization hold.',
    schema: GetFundingLinkInput,
    inputSchema: zodToJsonSchema(GetFundingLinkInput) as Record<string, unknown>,
    execute: async (client, args) => {
      const res = await client.startFunding(args.contract_id)
      return {
        contract_id: args.contract_id,
        approval_url: res.approval_url,
        order_id: res.order_id,
        note: 'A human payer must open this link and approve in PayPal.',
      }
    },
  },

  submit_deliverable: {
    name: 'submit_deliverable',
    description:
      'Submits a completed deliverable for a contract milestone to initiate automated cryptographic, schema, and AI evaluation.',
    schema: SubmitDeliverableInput,
    inputSchema: zodToJsonSchema(SubmitDeliverableInput) as Record<string, unknown>,
    execute: async (client, args) => {
      const res = await client.submitDeliverable(args.contract_id, args.milestone_key, {
        content_type: args.content_type,
        content_text: args.content,
        note: args.note,
      })
      return {
        contract_id: args.contract_id,
        milestone_key: args.milestone_key,
        submission_id: res.id,
        attempt: res.attempt,
        content_type: res.content_type,
        size_bytes: res.size_bytes,
        sha256: res.sha256,
      }
    },
  },

  get_verification_report: {
    name: 'get_verification_report',
    description:
      'Retrieves the detailed multi-stage verification report for a milestone submission, including deterministic checks, rubric scoring, and adversarial manipulation detection.',
    schema: GetVerificationReportInput,
    inputSchema: zodToJsonSchema(GetVerificationReportInput) as Record<string, unknown>,
    execute: async (client, args) => {
      const report = await client.getVerification(args.verification_id)
      return report
    },
  },

  get_contract_status: {
    name: 'get_contract_status',
    description:
      'Retrieves current contract state, live escrow funds breakdown, and milestone progress.',
    schema: GetContractStatusInput,
    inputSchema: zodToJsonSchema(GetContractStatusInput) as Record<string, unknown>,
    execute: async (client, args) => {
      const contract = await client.getContract(args.contract_id)
      return {
        id: contract.id,
        title: contract.title,
        status: contract.status,
        total_minor: contract.total_minor,
        currency: contract.currency,
        authorization_id: contract.authorization_id,
        funded_at: contract.funded_at,
        milestones: contract.milestones?.map((m) => ({
          key: m.milestone_key,
          title: m.title,
          status: m.status,
          amount_minor: m.amount_minor,
          capture_id: m.capture_id,
          captured_at: m.captured_at,
          latest_verification_status: m.latest_verification?.status,
        })),
      }
    },
  },
}

// ---------------------------------------------------------------------------
// Server Factory
// ---------------------------------------------------------------------------
export function createMcpServer(options?: { baseUrl?: string; apiKey?: string }): Server {
  const envParsed = EnvConfigSchema.parse(process.env)
  const baseUrl = options?.baseUrl || envParsed.PROOFPAY_API_URL
  const apiKey = options?.apiKey || envParsed.PROOFPAY_API_KEY

  const apiClient = createApiClient({ baseUrl, apiKey })

  const server = new Server(
    {
      name: 'proofpay-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // 1. List available tools (must be exactly 6)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: Object.values(TOOLS).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }
  })

  // 2. Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params
    const tool = TOOLS[name]

    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`)
    }

    // Validate inputs
    const parseResult = tool.schema.safeParse(rawArgs || {})
    if (!parseResult.success) {
      const errors = parseResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters for tool ${name}: ${errors}`)
    }

    try {
      const result = await tool.execute(apiClient, parseResult.data)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: err.code,
                message: err.message,
                status: err.status,
                request_id: err.requestId,
              }),
            },
          ],
        }
      }

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'INTERNAL_ERROR',
              message: err.message || 'Unknown error during tool execution',
            }),
          },
        ],
      }
    }
  })

  return server
}

// ---------------------------------------------------------------------------
// Standalone CLI Runner
// ---------------------------------------------------------------------------
export async function main() {
  const server = createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('ProofPay MCP Server running on stdio')
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  main().catch((err) => {
    console.error('Fatal MCP Server error:', err)
    process.exit(1)
  })
}
