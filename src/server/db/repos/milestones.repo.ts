/**
 * Milestones repository — data access for milestones & criteria tables.
 * Implements phase-2-data-layer.md §2.10.
 */
import { eq, and, sql } from 'drizzle-orm'
import type { Tx, Db } from '@/server/db/client'
import {
  milestones,
  criteria,
  type MilestoneRow,
  type CriterionRow,
  type NewMilestone,
} from '@/server/db/schema'
import { assertMilestoneTransition } from '@/server/contracts/transitions'
import { InvalidTransitionError, NotFoundError } from '@/server/util/errors'
import type { MilestoneStatus, CriterionType } from '@/shared/types'

interface ContractJsonMilestone {
  key: string
  title: string
  amount_minor: number
  due_in_days: number
  deliverable: {
    content_type: 'json_records' | 'text'
    max_bytes: number
    description: string
  }
  criteria: Array<{
    key: string
    type: CriterionType
    required: boolean
    description?: string
    statement?: string
    check?: string
    spec?: Record<string, unknown>
    pass_threshold?: number
  }>
}

interface ContractJsonPayload {
  milestones: ContractJsonMilestone[]
}

export async function materializeMilestonesAndCriteria(
  tx: Tx,
  contractId: string,
  contractJson: unknown
): Promise<MilestoneRow[]> {
  const payload = contractJson as ContractJsonPayload
  if (!payload?.milestones || !Array.isArray(payload.milestones)) {
    throw new Error('Invalid contract JSON: milestones array missing')
  }

  const createdMilestones: MilestoneRow[] = []

  for (let idx = 0; idx < payload.milestones.length; idx++) {
    const m = payload.milestones[idx]!
    const [row] = await tx
      .insert(milestones)
      .values({
        contract_id: contractId,
        milestone_key: m.key,
        idx,
        title: m.title,
        amount_minor: m.amount_minor,
        due_in_days: m.due_in_days,
        status: 'PENDING',
        deliverable_json: m.deliverable,
        revisions_used: 0,
        max_revisions: 2,
      })
      .returning()

    if (!row) throw new Error(`Failed to insert milestone ${m.key}`)
    createdMilestones.push(row)

    // Insert criteria for this milestone
    for (const c of m.criteria) {
      await tx.insert(criteria).values({
        milestone_id: row.id,
        criterion_key: c.key,
        type: c.type,
        required: c.required,
        check_name: c.check ?? null,
        spec_json: c.spec ?? {},
        statement: c.statement ?? c.description ?? null,
        pass_threshold: c.pass_threshold ? String(c.pass_threshold) : '0.70',
      })
    }
  }

  return createdMilestones
}

export async function getMilestoneByKey(
  tx: Tx | Db,
  contractId: string,
  key: string
): Promise<MilestoneRow | null> {
  const rows = await tx
    .select()
    .from(milestones)
    .where(and(eq(milestones.contract_id, contractId), eq(milestones.milestone_key, key)))
    .limit(1)

  return rows[0] ?? null
}

export async function listMilestones(
  tx: Tx | Db,
  contractId: string
): Promise<MilestoneRow[]> {
  return tx
    .select()
    .from(milestones)
    .where(eq(milestones.contract_id, contractId))
    .orderBy(milestones.idx)
}

export async function transitionMilestone(
  tx: Tx,
  id: string,
  from: MilestoneStatus,
  to: MilestoneStatus,
  patch?: Partial<NewMilestone>
): Promise<MilestoneRow> {
  assertMilestoneTransition(from, to)

  const [updated] = await tx
    .update(milestones)
    .set({
      ...patch,
      status: to,
    })
    .where(and(eq(milestones.id, id), eq(milestones.status, from)))
    .returning()

  if (!updated) {
    throw new InvalidTransitionError(from, to, 'milestone (concurrent state change or not found)')
  }
  return updated
}

export async function sumCapturedMinor(
  tx: Tx | Db,
  contractId: string
): Promise<number> {
  const rows = await tx
    .select({
      total: sql<number>`coalesce(sum(${milestones.amount_minor}), 0)`,
    })
    .from(milestones)
    .where(and(eq(milestones.contract_id, contractId), eq(milestones.status, 'RELEASED')))

  return rows[0]?.total ?? 0
}
