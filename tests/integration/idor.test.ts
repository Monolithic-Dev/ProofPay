/**
 * Integration Test: IDOR Protection & Authorization Matrix
 * Implements phase-3-auth-and-contracts.md §3.12 (Task 10.3).
 */
import { describe, it, expect } from 'vitest'
import { requireParty, requireRole, forbidAgent } from '@/server/auth/guards'
import { NotFoundError, ForbiddenError } from '@/server/util/errors'
import type { SessionUser } from '@/server/auth/session'
import type { ContractRow } from '@/server/db/schema'

describe('IDOR & Security Matrix Tests', () => {
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

  // Mock DB for requireParty test
  const fakeDb: any = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => [dummyContract],
        }),
      }),
    }),
  }

  it('RULE 1: Strangers receive 404 NOT_FOUND instead of 403 to prevent contract enumeration', async () => {
    const strangerUser: SessionUser = {
      sub: 'stranger-uuid',
      email: 'stranger@proofpay.test',
      role: 'buyer',
      is_agent: false,
    }

    await expect(
      requireParty(fakeDb, dummyContract.id, strangerUser)
    ).rejects.toThrow(NotFoundError)
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

  it('RULE 5: requireRole rejects non-matching user roles', () => {
    const sellerUser: SessionUser = {
      sub: 'seller-1',
      email: 'seller@proofpay.test',
      role: 'seller',
      is_agent: false,
    }

    expect(() => requireRole(sellerUser, 'buyer')).toThrow(ForbiddenError)
    expect(() => requireRole(sellerUser, 'seller')).not.toThrow()
  })
})
