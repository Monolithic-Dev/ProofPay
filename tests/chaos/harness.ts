/**
 * PayPal Chaos Test Harness
 * Implements phase-8-testing-and-hardening.md §8.3 & testing.md §5.
 */
import { getDb, withTx } from '@/server/db/client'
import { contracts, milestones, criteria, ledger_events, users } from '@/server/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { now } from '@/server/util/time'
import { releaseMilestone } from '@/server/release/service'

export interface ChaosMilestoneHandle {
  key: string
  id: string
  amount_minor: number
}

export interface ChaosContractContext {
  contractId: string
  authorizationId: string
  milestones: ChaosMilestoneHandle[]
}

/**
 * Creates a chaos testing contract with 5 milestones ($1.00 each, $5.00 total)
 * using cheap deterministic word_count criteria.
 */
export async function createChaosContract(opts?: {
  authorizationId?: string
  authExpiresAt?: Date
  initialStatus?: 'ACCEPTED' | 'FUNDING' | 'FUNDED'
}): Promise<ChaosContractContext> {
  const db = getDb()
  const contractId = randomUUID()
  const authorizationId = opts?.authorizationId ?? `AUTH-CHAOS-${randomUUID().slice(0, 8)}`

  // Ensure valid buyer and seller users exist in DB
  const existingUsers = await db.select().from(users).limit(5)
  let buyerId: string
  let sellerId: string

  if (existingUsers.length >= 2) {
    buyerId = existingUsers[0]!.id
    sellerId = existingUsers[1]!.id
  } else {
    buyerId = randomUUID()
    sellerId = randomUUID()
    await db.insert(users).values([
      {
        id: buyerId,
        email: 'chaos-buyer@test.proofpay',
        display_name: 'Chaos Buyer',
        role: 'buyer' as const,
        is_agent: false,
        created_at: now(),
      },
      {
        id: sellerId,
        email: 'chaos-seller@test.proofpay',
        display_name: 'Chaos Seller',
        role: 'seller' as const,
        is_agent: false,
        created_at: now(),
      },
    ])
  }

  const msList: ChaosMilestoneHandle[] = []
  const msKeys = ['m1', 'm2', 'm3', 'm4', 'm5']

  await withTx(async (tx) => {
    // 1. Insert contract
    await tx.insert(contracts).values({
      id: contractId,
      buyer_id: buyerId,
      seller_id: sellerId,
      title: 'PayPal Chaos Hardening Contract ($5.00)',
      status: opts?.initialStatus ?? 'FUNDED',
      currency: 'USD',
      total_minor: 500, // 5 x $1.00
      version: 1,
      contract_json: {
        schema_version: 1,
        title: 'PayPal Chaos Hardening Contract',
        total_minor: 500,
        milestones: msKeys.map((key) => ({
          key,
          title: `Milestone ${key.toUpperCase()}`,
          amount_minor: 100,
        })),
      },
      authorization_id: authorizationId,
      auth_created_at: now(),
      auth_expires_at: opts?.authExpiresAt ?? new Date(Date.now() + 29 * 86400000),
      honor_until: new Date(Date.now() + 3 * 86400000),
      funded_at: now(),
      funding_at_risk: false,
      created_at: now(),
      updated_at: now(),
    })

    // 2. Insert milestones and criteria
    for (let idx = 0; idx < msKeys.length; idx++) {
      const key = msKeys[idx]!
      const milestoneId = randomUUID()

      await tx.insert(milestones).values({
        id: milestoneId,
        contract_id: contractId,
        idx,
        milestone_key: key,
        title: `Chaos Step ${key}`,
        amount_minor: 100,
        due_in_days: idx + 1,
        deliverable_json: {
          content_type: 'text',
          max_bytes: 10000,
          description: `Chaos step deliverable ${key}`,
        },
        status: 'PASSED', // Ready for release testing
        due_at: new Date(Date.now() + (idx + 1) * 86400000),
        release_attempts: 0,
      })

      await tx.insert(criteria).values({
        id: randomUUID(),
        milestone_id: milestoneId,
        criterion_key: `c_${key}`,
        type: 'deterministic',
        check_name: 'word_count',
        spec_json: { min: 5, max: 100 },
        required: true,
      })

      msList.push({
        key,
        id: milestoneId,
        amount_minor: 100,
      })
    }
  })

  return {
    contractId,
    authorizationId,
    milestones: msList,
  }
}

/**
 * Wait for a condition function to return true or truthy, polling periodically.
 */
export async function waitFor<T>(
  conditionFn: () => Promise<T | null | false | undefined>,
  options: { timeoutMs?: number; intervalMs?: number; label?: string } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 10000
  const intervalMs = options.intervalMs ?? 150
  const label = options.label ?? 'operation'
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const res = await conditionFn()
    if (res) {
      return res
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error(`Timeout waiting for ${label} after ${timeoutMs}ms`)
}

/**
 * Counts the number of COMPLETED captures recorded for a contract in the ledger.
 */
export async function countCaptures(contractId: string): Promise<number> {
  const db = getDb()
  const rows = await db
    .select()
    .from(ledger_events)
    .where(
      and(
        eq(ledger_events.contract_id, contractId),
        eq(ledger_events.type, 'CAPTURE_COMPLETED')
      )
    )

  return rows.length
}

/**
 * Fetches current milestone record by contract id and milestone key.
 */
export async function getMilestoneRecord(contractId: string, milestoneKey: string) {
  const db = getDb()
  const [row] = await db
    .select()
    .from(milestones)
    .where(
      and(
        eq(milestones.contract_id, contractId),
        eq(milestones.milestone_key, milestoneKey)
      )
    )
  return row
}

/**
 * Sets chaos mock code on contract for next release attempt.
 */
export async function setChaosMockCode(contractId: string, mockCode: string | null) {
  const db = getDb()
  await db
    .update(contracts)
    .set({ chaos_mock_code: mockCode, updated_at: now() })
    .where(eq(contracts.id, contractId))
}
