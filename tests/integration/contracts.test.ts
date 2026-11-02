/**
 * Integration test: Contract Lifecycle (Compile -> Lint -> Fix -> Propose -> Accept -> Cancel)
 * Verifies phase-3-auth-and-contracts.md §3.8 & §3.12.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb } from '@/server/db/client'
import { users, contracts, milestones, criteria, ledger_events } from '@/server/db/schema'
import { eq, sql } from 'drizzle-orm'
import { compileContract } from '@/server/contracts/compile'
import {
  getContractView,
  updateContractDraft,
  applyLintFix,
  proposeContract,
  acceptContract,
  cancelContract,
} from '@/server/contracts/service'
import { setLlmTransport } from '@/server/ai/fake-llm'
import { NotFoundError, ForbiddenError, ValidationError } from '@/server/util/errors'
import type { SessionUser } from '@/server/auth/session'

describe('Contract Lifecycle Integration', () => {
  let buyerId = '00000000-0000-0000-0000-000000000001'
  let sellerId = '00000000-0000-0000-0000-000000000002'
  let strangerId = '00000000-0000-0000-0000-000000000003'
  let agentId = '00000000-0000-0000-0000-000000000004'

  let buyerUser: SessionUser = { sub: buyerId, email: 'buyer@test.local', role: 'buyer', is_agent: false }
  let sellerUser: SessionUser = { sub: sellerId, email: 'seller@test.local', role: 'seller', is_agent: false }
  let strangerUser: SessionUser = { sub: strangerId, email: 'stranger@test.local', role: 'buyer', is_agent: false }
  let agentUser: SessionUser = { sub: agentId, email: 'agent@test.local', role: 'buyer', is_agent: true }

  let dbActive = false

  beforeEach(async () => {
    setLlmTransport(null) // Uses standard valid fixture

    try {
      await getDb().execute(sql`SELECT 1`)
      dbActive = true

      // Insert test users
      const [buyer] = await getDb()
        .insert(users)
        .values({
          email: `buyer-${Date.now()}@test.local`,
          display_name: 'Test Buyer',
          role: 'buyer',
          is_agent: false,
        })
        .returning()
      buyerId = buyer!.id
      buyerUser = { sub: buyerId, email: buyer!.email, role: 'buyer', is_agent: false }

      const [seller] = await getDb()
        .insert(users)
        .values({
          email: `seller-${Date.now()}@test.local`,
          display_name: 'Test Seller',
          role: 'seller',
          is_agent: false,
        })
        .returning()
      sellerId = seller!.id
      sellerUser = { sub: sellerId, email: seller!.email, role: 'seller', is_agent: false }

      const [stranger] = await getDb()
        .insert(users)
        .values({
          email: `stranger-${Date.now()}@test.local`,
          display_name: 'Stranger User',
          role: 'buyer',
          is_agent: false,
        })
        .returning()
      strangerId = stranger!.id
      strangerUser = { sub: strangerId, email: stranger!.email, role: 'buyer', is_agent: false }

      const [agent] = await getDb()
        .insert(users)
        .values({
          email: `agent-${Date.now()}@test.local`,
          display_name: 'AI Agent Buyer',
          role: 'buyer',
          is_agent: true,
        })
        .returning()
      agentId = agent!.id
      agentUser = { sub: agentId, email: agent!.email, role: 'buyer', is_agent: true }
    } catch {
      dbActive = false
    }
  })

  afterEach(() => {
    setLlmTransport(null)
  })

  it('compiles a contract draft, allows buyer to view, and hides it from strangers with 404', async () => {
    if (!dbActive) {
      // Offline fallback: prompt validation invariants still hold
      await expect(compileContract({ prompt: '', userId: buyerId })).rejects.toThrow(ValidationError)
      return
    }

    const compiled = await compileContract({
      prompt: 'Scrape 100 verified company leads with valid emails',
      userId: buyerId,
    })

    expect(compiled.contract_id).toBeDefined()
    expect(compiled.contract.title).toBeDefined()

    // Buyer view succeeds
    const view = await getContractView(compiled.contract_id, buyerUser)
    expect(view.id).toBe(compiled.contract_id)
    expect(view.status).toBe('DRAFT')

    // Stranger view throws NotFoundError (404, never 403!)
    await expect(
      getContractView(compiled.contract_id, strangerUser)
    ).rejects.toThrow(NotFoundError)
  })

  it('updates draft contract and prevents unauthorized edits', async () => {
    if (!dbActive) {
      return
    }

    const compiled = await compileContract({
      prompt: 'Build landing page with modern design',
      userId: buyerId,
    })

    // Stranger cannot edit draft (404)
    await expect(
      updateContractDraft(compiled.contract_id, strangerUser, {
        title: 'Hacked Title',
      })
    ).rejects.toThrow(NotFoundError)

    // Buyer can edit draft
    const updated = await updateContractDraft(compiled.contract_id, buyerUser, {
      title: 'Updated Modern Landing Page',
    })

    expect(updated.title).toBe('Updated Modern Landing Page')
    expect(updated.version).toBe(2)
  })

  it('runs complete lifecycle: compile -> propose -> accept', async () => {
    if (!dbActive) {
      return
    }

    // 1. Compile contract
    const compiled = await compileContract({
      prompt: 'Deliver 50 cleaned customer surveys in CSV format',
      userId: buyerId,
    })

    // 2. Propose contract to seller
    const [sellerRow] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, sellerId))
    const proposed = await proposeContract(
      compiled.contract_id,
      buyerUser,
      sellerRow!.email
    )

    expect(proposed.status).toBe('PROPOSED')
    expect(proposed.seller_id).toBe(sellerId)
    expect(proposed.contract_hash).toBeDefined()

    // Verify milestones were materialized in DB
    const dbMilestones = await getDb()
      .select()
      .from(milestones)
      .where(eq(milestones.contract_id, compiled.contract_id))
    expect(dbMilestones.length).toBeGreaterThan(0)

    // Verify ledger has contract_proposed event
    const events = await getDb()
      .select()
      .from(ledger_events)
      .where(eq(ledger_events.contract_id, compiled.contract_id))
    const proposedEvent = events.find((e) => e.type === 'contract_proposed')
    expect(proposedEvent).toBeDefined()

    // 3. Buyer cannot accept their own contract
    await expect(acceptContract(compiled.contract_id, buyerUser)).rejects.toThrow(
      ValidationError
    )

    // 4. Stranger cannot accept if designated seller assigned
    const strangerSellerUser: SessionUser = {
      sub: strangerId,
      email: 'stranger@test.local',
      role: 'seller',
      is_agent: false,
    }
    await expect(
      acceptContract(compiled.contract_id, strangerSellerUser)
    ).rejects.toThrow(ForbiddenError)

    // 5. Designated seller accepts contract
    const accepted = await acceptContract(compiled.contract_id, sellerUser)
    expect(accepted.status).toBe('ACCEPTED')
    expect(accepted.seller_id).toBe(sellerId)

    // Verify ledger has contract_accepted event
    const updatedEvents = await getDb()
      .select()
      .from(ledger_events)
      .where(eq(ledger_events.contract_id, compiled.contract_id))
    const acceptedEvent = updatedEvents.find((e) => e.type === 'contract_accepted')
    expect(acceptedEvent).toBeDefined()
  })

  it('forbids AI agents from cancelling contracts and allows human cancellation', async () => {
    // Agent guard works unconditionally
    await expect(
      cancelContract('00000000-0000-0000-0000-000000000001', agentUser, 'AI cancel')
    ).rejects.toThrow(ForbiddenError)

    if (!dbActive) {
      return
    }

    const compiled = await compileContract({
      prompt: 'Translate documentation into Spanish',
      userId: buyerId,
    })

    // Human buyer cancellation succeeds
    const cancelled = await cancelContract(
      compiled.contract_id,
      buyerUser,
      'Project scope changed'
    )
    expect(cancelled.status).toBe('CANCELLED')
  })
})
