import { NextResponse } from 'next/server'

export async function GET() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'ProofPay API',
      version: '2.1.0',
      description:
        'Pay-on-acceptance protocol for digital deliverables with PayPal authorization holds and deterministic AI verification.',
      contact: {
        name: 'ProofPay Developer Support',
        url: 'https://proofpay.app',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Local Developer Sandbox',
      },
      {
        url: 'https://proofpay.app/api/v1',
        description: 'Cloud Production Sandbox',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key (pp_k_...)',
          description: 'Scoped Machine or User API Key',
        },
      },
      schemas: {
        Contract: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            status: {
              type: 'string',
              enum: ['DRAFT', 'PROPOSED', 'ACCEPTED', 'FUNDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED'],
            },
            total_minor: { type: 'integer', description: 'Total in USD minor cents' },
            currency: { type: 'string', default: 'USD' },
            contract_hash: { type: 'string', description: 'Canonical SHA-256 agreement hash' },
            paypal_order_id: { type: 'string', nullable: true },
            authorization_id: { type: 'string', nullable: true },
          },
        },
        Milestone: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            amount_minor: { type: 'integer' },
            status: {
              type: 'string',
              enum: ['PENDING', 'SUBMITTED', 'VERIFYING', 'PASSED', 'REJECTED', 'ESCALATED', 'RELEASED', 'VOIDED'],
            },
            capture_id: { type: 'string', nullable: true },
          },
        },
        VerificationReport: {
          type: 'object',
          properties: {
            decision: { type: 'string', enum: ['PASSED', 'REJECTED', 'ESCALATED'] },
            confidence: { type: 'number' },
            reasons: { type: 'array', items: { type: 'string' } },
            latency_ms: { type: 'integer' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      '/contracts': {
        get: {
          summary: 'List user contracts',
          tags: ['Contracts'],
          responses: {
            '200': {
              description: 'List of contracts for the current session or API key',
            },
          },
        },
        post: {
          summary: 'Compile & create a contract from natural language prompt',
          tags: ['Contracts'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['prompt'],
                  properties: {
                    prompt: { type: 'string', description: 'Specification of milestones and deliverables' },
                    seller_email: { type: 'string', format: 'email' },
                    budget_cap_minor: { type: 'integer' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Contract compiled and created successfully' },
          },
        },
      },
      '/contracts/{id}/accept': {
        post: {
          summary: 'Accept contract terms and lock agreement hash',
          tags: ['Lifecycle'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            '200': { description: 'Contract accepted and hash locked in ledger' },
          },
        },
      },
      '/contracts/{id}/fund': {
        post: {
          summary: 'Generate PayPal authorization hold approval link',
          tags: ['Funding'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            '200': { description: 'Returns PayPal approval URL for human payer authorization' },
          },
        },
      },
      '/contracts/{id}/milestones/{milestoneKey}/submit': {
        post: {
          summary: 'Submit deliverable payload for automated verification',
          tags: ['Deliverables'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'milestoneKey', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['payload'],
                  properties: {
                    payload: { type: 'string', description: 'JSON string or text deliverable' },
                    content_type: { type: 'string', enum: ['json_records', 'text'] },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Deliverable received and verification initiated' },
          },
        },
      },
      '/contracts/{id}/proof-pack': {
        get: {
          summary: 'Download cryptographic Proof Pack (JSON or PDF)',
          tags: ['Ledger & Evidence'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'pdf'] } },
          ],
          responses: {
            '200': { description: 'Cryptographic Proof Pack evidence bundle' },
          },
        },
      },
      '/ledger': {
        get: {
          summary: 'Global append-only financial audit ledger (AG Grid query)',
          tags: ['Ledger & Evidence'],
          responses: {
            '200': { description: 'Sequence-ordered immutable events with hash verification' },
          },
        },
      },
    },
  }

  return NextResponse.json(spec, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
