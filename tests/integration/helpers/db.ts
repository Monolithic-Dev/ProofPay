/**
 * Integration test database helpers.
 * Implements phase-2-data-layer.md §2.4.
 */
import fs from 'fs'
import path from 'path'
import { getDb } from '@/server/db/client'
import { users, contracts, milestones, criteria } from '@/server/db/schema'
import { sql } from 'drizzle-orm'
import type { UserRole, ContractStatus } from '@/shared/types'

export async function resetDb(): Promise<void> {
  const db = getDb()
  // Clean all application tables in reverse dependency order
  await db.execute(sql`
    TRUNCATE TABLE
      llm_calls,
      demo_runs,
      disputes,
      paypal_events,
      jobs,
      idempotency_keys,
      kv,
      criteria,
      submissions,
      verifications,
      ledger_events,
      milestones,
      contracts,
      api_keys,
      users
    RESTART IDENTITY CASCADE;
  `)
}

export async function makeUser(
  role: UserRole = 'buyer',
  overrides?: Partial<typeof users.$inferInsert>
): Promise<typeof users.$inferSelect> {
  const db = getDb()
  const rand = Math.random().toString(36).substring(2, 8)
  const [user] = await db
    .insert(users)
    .values({
      email: `${role}_${rand}@test.proofpay`,
      display_name: `Test ${role} ${rand}`,
      role,
      is_agent: false,
      ...overrides,
    })
    .returning()

  if (!user) throw new Error('Failed to create test user')
  return user
}

export async function makeContractFixture(
  status: ContractStatus = 'DRAFT',
  buyerId?: string,
  sellerId?: string
): Promise<typeof contracts.$inferSelect> {
  const db = getDb()
  const buyer = buyerId ? { id: buyerId } : await makeUser('buyer')
  const seller = sellerId ? { id: sellerId } : await makeUser('seller')

  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/demo-contract.json')
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

  const [contract] = await db
    .insert(contracts)
    .values({
      buyer_id: buyer.id,
      seller_id: seller.id,
      title: fixture.title,
      status,
      contract_json: fixture,
      lint_json: { issues: [] },
      total_minor: fixture.total_minor,
      currency: 'USD',
    })
    .returning()

  if (!contract) throw new Error('Failed to create test contract fixture')
  return contract
}
