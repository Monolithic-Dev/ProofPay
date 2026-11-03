/**
 * Contracts repository — data access for contracts table.
 * Implements phase-2-data-layer.md §2.10.
 */
import { eq, and, desc, sql } from 'drizzle-orm'
import type { Tx, Db } from '@/server/db/client'
import { contracts, type ContractRow, type NewContract } from '@/server/db/schema'
import { assertContractTransition } from '@/server/contracts/transitions'
import { InvalidTransitionError, NotFoundError } from '@/server/util/errors'
import type { ContractStatus } from '@/shared/types'

export async function insertDraftContract(
  tx: Tx,
  params: {
    buyerId: string
    title: string
    contract: Record<string, unknown>
    lint: Record<string, unknown>
    totalMinor?: number
  }
): Promise<ContractRow> {
  const [created] = await tx
    .insert(contracts)
    .values({
      buyer_id: params.buyerId,
      title: params.title,
      contract_json: params.contract,
      lint_json: params.lint,
      status: 'DRAFT',
      total_minor: params.totalMinor ?? 0,
      currency: 'USD',
    })
    .returning()

  if (!created) throw new Error('Failed to create contract')
  return created
}

export async function getContractById(tx: Tx | Db, id: string): Promise<ContractRow | null> {
  const rows = await tx.select().from(contracts).where(eq(contracts.id, id)).limit(1)
  return rows[0] ?? null
}

export async function getContractForParty(
  tx: Tx | Db,
  id: string,
  userId: string
): Promise<ContractRow | null> {
  const contract = await getContractById(tx, id)
  if (!contract) return null

  const isParty = contract.buyer_id === userId || contract.seller_id === userId
  if (!isParty) return null

  return contract
}

export async function listContractsForUser(
  db: Db | Tx,
  userId: string,
  options?: { status?: ContractStatus; limit?: number; orgId?: string; isAdmin?: boolean }
): Promise<ContractRow[]> {
  const limit = options?.limit ?? 50
  const conditions = []

  if (!options?.isAdmin) {
    if (options?.orgId) {
      conditions.push(
        sql`(${contracts.buyer_id} = ${userId} OR ${contracts.seller_id} = ${userId} OR ${contracts.buyer_org_id} = ${options.orgId} OR ${contracts.seller_org_id} = ${options.orgId})`
      )
    } else {
      conditions.push(
        sql`(${contracts.buyer_id} = ${userId} OR ${contracts.seller_id} = ${userId})`
      )
    }
  }

  if (options?.status) {
    conditions.push(eq(contracts.status, options.status))
  }

  return db
    .select()
    .from(contracts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contracts.created_at))
    .limit(limit)
}

export async function updateDraftJson(
  tx: Tx,
  id: string,
  contractJson: Record<string, unknown>,
  lintJson: Record<string, unknown>,
  totalMinor?: number
): Promise<ContractRow> {
  const updates: Partial<NewContract> = {
    contract_json: contractJson,
    lint_json: lintJson,
    updated_at: new Date(),
  }
  if (totalMinor !== undefined) {
    updates.total_minor = totalMinor
  }

  const [updated] = await tx
    .update(contracts)
    .set(updates)
    .where(and(eq(contracts.id, id), eq(contracts.status, 'DRAFT')))
    .returning()

  if (!updated) {
    throw new InvalidTransitionError('UNKNOWN', 'DRAFT', 'contract (cannot update non-draft)')
  }
  return updated
}

export async function transitionContractStatus(
  tx: Tx,
  id: string,
  from: ContractStatus,
  to: ContractStatus,
  patch?: Partial<NewContract>
): Promise<ContractRow> {
  assertContractTransition(from, to)

  const [updated] = await tx
    .update(contracts)
    .set({
      ...patch,
      status: to,
      updated_at: new Date(),
    })
    .where(and(eq(contracts.id, id), eq(contracts.status, from)))
    .returning()

  if (!updated) {
    throw new InvalidTransitionError(from, to, 'contract (concurrent state change or not found)')
  }
  return updated
}

export async function setFundingFields(
  tx: Tx,
  id: string,
  fields: {
    authorizationId: string
    paypalOrderId: string
    honorUntil?: string
    authExpiresAt?: string
  }
): Promise<ContractRow> {
  const [updated] = await tx
    .update(contracts)
    .set({
      authorization_id: fields.authorizationId,
      paypal_order_id: fields.paypalOrderId,
      honor_until: fields.honorUntil ? new Date(fields.honorUntil) : null,
      auth_expires_at: fields.authExpiresAt ? new Date(fields.authExpiresAt) : null,
      funded_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(contracts.id, id))
    .returning()

  if (!updated) throw new NotFoundError('Contract', { id })
  return updated
}
