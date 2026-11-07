/**
 * Integration Test: IDOR Protection & Authorization Matrix
 * Implements phase-8-testing-and-hardening.md §8.4 & security-privacy.md §4, §7.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { requireParty, requireRole, forbidAgent } from '@/server/auth/guards'
import { NotFoundError, ForbiddenError, UnauthorizedError } from '@/server/util/errors'
import type { SessionUser } from '@/server/auth/session'
import type { ContractRow } from '@/server/db/schema'

/**
 * Route authorization specification table.
 * Every route under src/app/api/v1 must be declared here.
 */
export interface RouteSpec {
  path: string
  methods: ('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH')[]
  auth: 'none' | 'user' | 'webhook'
  allowedRoles?: ('buyer' | 'seller' | 'admin')[]
  requireParty?: boolean
  forbidAgent?: boolean
  description: string
}

export const ROUTES: RouteSpec[] = [
  {
    path: 'health',
    methods: ['GET'],
    auth: 'none',
    description: 'System health check and feature flags',
  },
  {
    path: 'auth/demo-login',
    methods: ['POST'],
    auth: 'none',
    description: 'Demo persona login (DEMO_MODE only)',
  },
  {
    path: 'auth/logout',
    methods: ['POST'],
    auth: 'none',
    description: 'Clear session cookie',
  },
  {
    path: 'me',
    methods: ['GET'],
    auth: 'user',
    description: 'Get active session user profile',
  },
  {
    path: 'me/api-keys',
    methods: ['GET', 'POST'],
    auth: 'user',
    description: 'List and create user API keys',
  },
  {
    path: 'me/api-keys/[id]',
    methods: ['DELETE'],
    auth: 'user',
    description: 'Revoke user API key',
  },
  {
    path: 'contracts',
    methods: ['GET', 'POST'],
    auth: 'user',
    description: 'List contracts or create new draft contract',
  },
  {
    path: 'contracts/compile',
    methods: ['POST'],
    auth: 'user',
    description: 'Natural language contract compilation',
  },
  {
    path: 'contracts/[id]',
    methods: ['GET'],
    auth: 'user',
    requireParty: true,
    description: 'Get contract details (stranger gets 404)',
  },
  {
    path: 'contracts/[id]/events',
    methods: ['GET'],
    auth: 'user',
    requireParty: true,
    description: 'SSE stream for contract ledger events',
  },
  {
    path: 'contracts/[id]/ledger',
    methods: ['GET'],
    auth: 'user',
    requireParty: true,
    description: 'Get contract ledger audit events',
  },
  {
    path: 'contracts/[id]/ledger/verify',
    methods: ['GET'],
    auth: 'user',
    requireParty: true,
    description: 'Verify cryptographic hash chain integrity',
  },
  {
    path: 'contracts/[id]/lint',
    methods: ['GET'],
    auth: 'user',
    requireParty: true,
    allowedRoles: ['buyer', 'admin'],
    description: 'Get lint issues for draft contract',
  },
  {
    path: 'contracts/[id]/lint/apply',
    methods: ['POST'],
    auth: 'user',
    requireParty: true,
    allowedRoles: ['buyer', 'admin'],
    description: 'Apply JSON patch fix to contract',
  },
  {
    path: 'contracts/[id]/propose',
    methods: ['POST'],
    auth: 'user',
    requireParty: true,
    allowedRoles: ['buyer', 'admin'],
    description: 'Propose contract to seller',
  },
  {
    path: 'contracts/[id]/accept',
    methods: ['POST'],
    auth: 'user',
    requireParty: true,
    allowedRoles: ['seller', 'admin'],
    description: 'Seller accepts proposed contract',
  },
  {
    path: 'contracts/[id]/fund',
    methods: ['POST'],
    auth: 'user',
    requireParty: true,
    allowedRoles: ['buyer', 'admin'],
    description: 'Initiate PayPal funding order',
  },
  {
    path: 'contracts/[id]/funding-status',
    methods: ['GET'],
    auth: 'user',
    requireParty: true,
    description: 'Check PayPal authorization hold status',
  },
  {
    path: 'contracts/[id]/cancel',
    methods: ['POST'],
    auth: 'user',
    requireParty: true,
    allowedRoles: ['buyer', 'admin'],
    forbidAgent: true,
    description: 'Cancel contract (human buyer only)',
  },
  {
    path: 'contracts/[id]/chaos',
    methods: ['POST'],
    auth: 'user',
    requireParty: true,
    allowedRoles: ['buyer', 'admin'],
    description: 'Inject PayPal chaos mock code (CHAOS_MODE only)',
  },
  {
    path: 'contracts/[id]/milestones/[mid]',
    methods: ['GET'],
    auth: 'user',
    requireParty: true,
    description: 'Get milestone status and verification summary',
  },
  {
    path: 'contracts/[id]/milestones/[mid]/submissions',
    methods: ['GET', 'POST'],
    auth: 'user',
    requireParty: true,
    description: 'Submit milestone artifact or get history',
  },
  {
    path: 'contracts/[id]/milestones/[mid]/decision',
    methods: ['POST'],
    auth: 'user',
    requireParty: true,
    allowedRoles: ['buyer', 'admin'],
    forbidAgent: true,
    description: 'Escalated milestone decision (human buyer only)',
  },
  {
    path: 'contracts/[id]/milestones/[mid]/retry-release',
    methods: ['POST'],
    auth: 'user',
    requireParty: true,
    allowedRoles: ['buyer', 'admin'],
    forbidAgent: true,
    description: 'Retry failed milestone release (human buyer only)',
  },
  {
    path: 'contracts/[id]/proof-pack',
    methods: ['GET'],
    auth: 'user',
    requireParty: true,
    description: 'Download Proof Pack PDF or JSON',
  },
  {
    path: 'paypal/return',
    methods: ['GET'],
    auth: 'none',
    description: 'PayPal approval return redirect URL',
  },
  {
    path: 'paypal/cancel',
    methods: ['GET'],
    auth: 'none',
    description: 'PayPal approval cancel redirect URL',
  },
  {
    path: 'webhooks/paypal',
    methods: ['POST'],
    auth: 'webhook',
    description: 'PayPal webhook ingestion with signature verification',
  },
  {
    path: 'admin/reconcile',
    methods: ['POST'],
    auth: 'user',
    allowedRoles: ['admin'],
    description: 'Admin manual reconciliation trigger',
  },
  {
    path: 'demo/scenarios/[name]/run',
    methods: ['POST'],
    auth: 'user',
    allowedRoles: ['buyer', 'admin'],
    description: 'Start judge mode scenario run (DEMO_MODE only)',
  },
  {
    path: 'demo/runs/[id]',
    methods: ['GET'],
    auth: 'user',
    description: 'Get scenario run status',
  },
  {
    path: 'demo/runs/[id]/events',
    methods: ['GET'],
    auth: 'user',
    description: 'SSE stream for scenario run events',
  },
  {
    path: 'demo/express',
    methods: ['GET', 'POST'],
    auth: 'none',
    description: 'AIP-13 Express Judge Lane pool claim and status',
  },
  {
    path: 'demo/mcp',
    methods: ['GET', 'POST'],
    auth: 'none',
    description: 'Model Context Protocol (MCP) in-browser demo API',
  },
  {
    path: 'demo/tribunal',
    methods: ['GET', 'POST'],
    auth: 'none',
    description: 'Multi-Agent AI Dispute Tribunal arbitration endpoint',
  },
  {
    path: 'demo/agent-wallet',
    methods: ['GET', 'POST'],
    auth: 'none',
    description: 'PayPal Autonomous Agent Spend Policy and Wallet Guardrail',
  },
  {
    path: 'verifications/[vid]',
    methods: ['GET'],
    auth: 'user',
    requireParty: true,
    description: 'Get verification detail report',
  },
  {
    path: 'abuse-reports',
    methods: ['POST'],
    auth: 'none',
    description: 'Submit an abuse / phishing / spam report',
  },
  {
    path: 'auth/step-up',
    methods: ['POST'],
    auth: 'none',
    description: 'Verify step-up MFA challenge',
  },
  {
    path: 'csp-report',
    methods: ['POST'],
    auth: 'none',
    description: 'Content Security Policy violation reporting endpoint',
  },
  {
    path: 'orgs/current/risk-events',
    methods: ['GET'],
    auth: 'none',
    description: 'Get recent org risk events',
  },
  {
    path: 'orgs/current/security',
    methods: ['GET'],
    auth: 'none',
    description: 'Get org security posture score and breakdown',
  },
    {
      path: 'auth/login',
      methods: ['POST'],
      auth: 'none',
      description: 'User login with email/password',
    },
    {
      path: 'auth/register',
      methods: ['POST'],
      auth: 'none',
      description: 'User registration',
    },
    {
      path: 'contracts/[id]/comments',
      methods: ['GET', 'POST'],
      auth: 'user',
      requireParty: true,
      description: 'Contract collaboration comments',
    },
    {
      path: 'contracts/[id]/dispute-evidence',
      methods: ['GET', 'POST'],
      auth: 'user',
      requireParty: true,
      description: 'Dispute evidence uploads',
    },
    {
      path: 'contracts/[id]/funding-approvals',
      methods: ['GET', 'POST'],
      auth: 'user',
      requireParty: true,
      description: 'Contract funding approvals',
    },
    {
      path: 'contracts/[id]/invitations',
      methods: ['GET', 'POST'],
      auth: 'user',
      requireParty: true,
      description: 'Invite counterparties to contract',
    },
    {
      path: 'contracts/[id]/milestones/[mid]/preflight',
      methods: ['POST'],
      auth: 'user',
      requireParty: true,
      description: 'Milestone submission preflight check',
    },
    {
      path: 'counterparties',
      methods: ['GET', 'POST'],
      auth: 'user',
      description: 'Counterparty directory',
    },
    {
      path: 'funding-approvals/[id]/decision',
      methods: ['POST'],
      auth: 'user',
      forbidAgent: true,
      description: 'Approve or reject funding request',
    },
    {
      path: 'invitations/[token]',
      methods: ['GET', 'POST'],
      auth: 'none',
      description: 'Accept contract invitation by token',
    },
    {
      path: 'ledger',
      methods: ['GET'],
      auth: 'user',
      description: 'Global audit ledger',
    },
    {
      path: 'ledger/elastic',
      methods: ['GET'],
      auth: 'user',
      description: 'Elastic ledger queries',
    },
    {
      path: 'notifications',
      methods: ['GET', 'POST'],
      auth: 'user',
      description: 'User notifications',
    },
    {
      path: 'openapi',
      methods: ['GET'],
      auth: 'none',
      description: 'OpenAPI 3.1 specification',
    },
    {
      path: 'organizations',
      methods: ['GET', 'POST'],
      auth: 'user',
      description: 'Organization workspace management',
    },
    {
      path: 'organizations/[id]/members',
      methods: ['GET', 'POST'],
      auth: 'user',
      description: 'Organization members list and invite',
    },
    {
      path: 'organizations/[id]/members/[memberId]',
      methods: ['DELETE', 'PATCH'],
      auth: 'user',
      description: 'Manage organization member',
    },
    {
      path: 'payments',
      methods: ['GET'],
      auth: 'user',
      description: 'User payment ledger',
    },
    {
      path: 'payments/summary',
      methods: ['GET'],
      auth: 'user',
      description: 'User payments summary',
    },
    {
      path: 'service-accounts',
      methods: ['GET', 'POST'],
      auth: 'user',
      description: 'Service accounts for AI agents',
    },
    {
      path: 'support/tickets',
      methods: ['POST'],
      auth: 'none',
      description: 'Submit support ticket',
    },
    {
      path: 'templates',
      methods: ['GET', 'POST'],
      auth: 'user',
      description: 'Contract template library',
    },
    {
      path: 'webhooks/outbound',
      methods: ['GET', 'POST'],
      auth: 'user',
      description: 'Outbound webhook subscriptions',
    },
    {
      path: 'transparency/checkpoints',
      methods: ['GET'],
      auth: 'none',
      description: 'Public Merkle transparency checkpoints',
    },

]

/**
 * Recursively find all route.ts files under src/app/api/v1.
 */
function findApiRoutes(dir: string, baseDir: string = dir): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  let routes: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      routes = routes.concat(findApiRoutes(fullPath, baseDir))
    } else if (entry.isFile() && entry.name === 'route.ts') {
      const relPath = path
        .relative(baseDir, dir)
        .replace(/\\/g, '/')
      routes.push(relPath)
    }
  }

  return routes
}

describe('IDOR & Security Matrix Tests (§8.4)', () => {
  const dummyContract = {
    id: '11111111-1111-1111-1111-111111111111',
    buyer_id: 'buyer-uuid',
    seller_id: 'seller-uuid',
    title: 'Private Contract',
    status: 'DRAFT',
    contract_json: {},
    contract_hash: null,
    lint_json: { issues: [] },
    version: 1,
    currency: 'USD',
    total_minor: 10000,
    paypal_order_id: null,
    authorization_id: null,
    auth_created_at: null,
    honor_until: null,
    auth_expires_at: null,
    funded_at: null,
    funding_at_risk: false,
    chaos_mock_code: null,
    demo_run_id: null,
    accepted_at: null,
    completed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  } as ContractRow

  const fakeDb: any = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => [dummyContract],
        }),
      }),
    }),
  }

  it('route table covers every route file under src/app/api/v1', () => {
    const apiDir = path.resolve(process.cwd(), 'src/app/api/v1')
    const filesystemRoutes = findApiRoutes(apiDir).sort()
    const tableRoutes = ROUTES.map((r) => r.path).sort()

    expect(filesystemRoutes.length).toBeGreaterThan(0)

    for (const fsRoute of filesystemRoutes) {
      expect(
        tableRoutes,
        `Route file 'src/app/api/v1/${fsRoute}/route.ts' is missing from ROUTES security table!`
      ).toContain(fsRoute)
    }

    expect(tableRoutes.length).toBe(filesystemRoutes.length)
  })

  it('RULE 1: Strangers receive 404 NOT_FOUND instead of 403 to prevent contract enumeration', async () => {
    const strangerUser: SessionUser = {
      sub: 'stranger-uuid',
      email: 'stranger@proofpay.test',
      role: 'buyer',
      is_agent: false,
    }

    await expect(requireParty(fakeDb, dummyContract.id, strangerUser)).rejects.toThrow(NotFoundError)
  })

  it('RULE 2: Buyer and seller are recognized as legitimate parties', async () => {
    const buyerUser: SessionUser = {
      sub: 'buyer-uuid',
      email: 'buyer@proofpay.test',
      role: 'buyer',
      is_agent: false,
    }
    const sellerUser: SessionUser = {
      sub: 'seller-uuid',
      email: 'seller@proofpay.test',
      role: 'seller',
      is_agent: false,
    }

    const buyerRes = await requireParty(fakeDb, dummyContract.id, buyerUser)
    expect(buyerRes.partyRole).toBe('buyer')

    const sellerRes = await requireParty(fakeDb, dummyContract.id, sellerUser)
    expect(sellerRes.partyRole).toBe('seller')
  })

  it('RULE 3: Admin role has global contract access', async () => {
    const adminUser: SessionUser = {
      sub: 'admin-uuid',
      email: 'admin@proofpay.test',
      role: 'admin',
      is_agent: false,
    }

    const adminRes = await requireParty(fakeDb, dummyContract.id, adminUser)
    expect(adminRes.partyRole).toBe('admin')
  })

  it('RULE 4: forbidAgent rejects automated agents for human actions', () => {
    const agentUser: SessionUser = {
      sub: 'agent-1',
      email: 'bot@proofpay.test',
      role: 'buyer',
      is_agent: true,
    }
    const humanUser: SessionUser = {
      sub: 'human-1',
      email: 'human@proofpay.test',
      role: 'buyer',
      is_agent: false,
    }

    expect(() => forbidAgent(agentUser)).toThrow(ForbiddenError)
    expect(() => forbidAgent(humanUser)).not.toThrow()
  })

  it('RULE 5: forbidAgent is declared on all money-altering and decision routes', () => {
    const forbiddenRoutes = ROUTES.filter((r) => r.forbidAgent)
    const forbiddenPaths = forbiddenRoutes.map((r) => r.path)

    expect(forbiddenPaths).toContain('contracts/[id]/cancel')
    expect(forbiddenPaths).toContain('contracts/[id]/milestones/[mid]/decision')
    expect(forbiddenPaths).toContain('contracts/[id]/milestones/[mid]/retry-release')
  })

  it('RULE 6: requireRole rejects non-matching user roles', () => {
    const sellerUser: SessionUser = {
      sub: 'seller-1',
      email: 'seller@proofpay.test',
      role: 'seller',
      is_agent: false,
    }

    expect(() => requireRole(sellerUser, 'buyer')).toThrow(ForbiddenError)
    expect(() => requireRole(sellerUser, 'seller')).not.toThrow()
  })

  it('RULE 7: admin-only routes reject standard buyers and sellers', () => {
    const adminRoutes = ROUTES.filter(
      (r) => r.allowedRoles && r.allowedRoles.length === 1 && r.allowedRoles[0] === 'admin'
    )
    expect(adminRoutes.map((r) => r.path)).toContain('admin/reconcile')

    const buyerUser: SessionUser = {
      sub: 'buyer-1',
      email: 'buyer@proofpay.test',
      role: 'buyer',
      is_agent: false,
    }
    expect(() => requireRole(buyerUser, 'admin')).toThrow(ForbiddenError)
  })
})
