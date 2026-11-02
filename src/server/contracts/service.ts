/**
 * Contract domain service — manages lifecycle operations, permissions, and mutations.
 * Implements phase-3-auth-and-contracts.md §3.10.
 */
import { eq } from 'drizzle-orm'
import { getDb, withTx, lockContract } from '@/server/db/client'
import { contracts, milestones, users, type ContractRow } from '@/server/db/schema'
import { enqueueJob } from '@/server/jobs/queue'
import {
  getContractById,
  transitionContractStatus,
} from '@/server/db/repos/contracts.repo'
import { materializeMilestonesAndCriteria } from '@/server/db/repos/milestones.repo'
import { appendLedgerEvent } from '@/server/ledger/append'
import { parseContract, type Contract } from '@/server/contracts/schema'
import { buildContractView } from '@/server/contracts/view'
import { runDeterministicLint } from '@/server/contracts/lint/rules'
import { runAiLint } from '@/server/contracts/lint/ai-lint'
import { applyPatchSafe } from '@/server/contracts/lint/patch'
import { contractHash } from '@/server/contracts/canonical'
import { requireParty, requireRole, forbidAgent, type SessionUser } from '@/server/auth/guards'
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
} from '@/server/util/errors'
import type { ContractView, LintIssue } from '@/shared/types'
import type { Operation } from 'fast-json-patch'

export async function getContractView(id: string, user: SessionUser): Promise<ContractView> {
  // Stranger check: requires user to be buyer, seller, or admin (throws 404 for strangers)
  const { contract } = await requireParty(getDb(), id, user)
  return buildContractView(getDb(), contract)
}

export async function updateContractDraft(
  id: string,
  user: SessionUser,
  patchOrUpdates: Partial<Contract> | Operation[]
): Promise<ContractView> {
  requireRole(user, 'buyer', 'admin')

  const { contract: existing } = await requireParty(getDb(), id, user)

  if (existing.buyer_id !== user.sub && user.role !== 'admin') {
    throw new ForbiddenError('Only the contract creator can edit this draft')
  }

  if (existing.status !== 'DRAFT') {
    throw new ConflictError('Contract is no longer a draft and cannot be edited')
  }

  let nextJson: unknown
  if (Array.isArray(patchOrUpdates)) {
    nextJson = applyPatchSafe(existing.contract_json, patchOrUpdates)
  } else {
    nextJson = {
      ...(existing.contract_json as Record<string, unknown>),
      ...patchOrUpdates,
    }
  }

  const validated = parseContract(nextJson)
  const detIssues = runDeterministicLint(validated)
  const aiIssues = await runAiLint(validated, detIssues)
  const allIssues = [...detIssues, ...aiIssues]

  const updatedRow = await withTx(async (tx) => {
    await lockContract(tx, id)

    const [row] = await tx
      .update(contracts)
      .set({
        title: validated.title,
        contract_json: validated,
        lint_json: { issues: allIssues },
        total_minor: validated.total_minor,
        currency: validated.currency,
        version: existing.version + 1,
        updated_at: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning()

    if (!row) throw new NotFoundError('Contract', { id })

    await appendLedgerEvent(tx, {
      contractId: id,
      type: 'contract_draft_edited',
      actorType: 'buyer',
      actorId: user.sub,
      payload: {
        version: row.version,
        diff: patchOrUpdates as unknown as Record<string, unknown>,
      },
    })

    return row
  })

  return buildContractView(getDb(), updatedRow)
}

export async function lintContract(
  id: string,
  user: SessionUser
): Promise<{ issues: LintIssue[] }> {
  const { contract: existing } = await requireParty(getDb(), id, user)

  const validated = parseContract(existing.contract_json)
  const detIssues = runDeterministicLint(validated)
  const aiIssues = await runAiLint(validated, detIssues)
  const allIssues = [...detIssues, ...aiIssues]

  await withTx(async (tx) => {
    await lockContract(tx, id)
    await tx
      .update(contracts)
      .set({
        lint_json: { issues: allIssues },
        updated_at: new Date(),
      })
      .where(eq(contracts.id, id))
  })

  return { issues: allIssues }
}

export async function applyLintFix(
  id: string,
  user: SessionUser,
  issueCode: string
): Promise<ContractView> {
  requireRole(user, 'buyer', 'admin')

  const { contract: existing } = await requireParty(getDb(), id, user)

  if (existing.buyer_id !== user.sub && user.role !== 'admin') {
    throw new ForbiddenError('Only the buyer can apply fixes to this contract')
  }

  if (existing.status !== 'DRAFT') {
    throw new ConflictError('Contract is no longer a draft')
  }

  const lintData = existing.lint_json as { issues?: LintIssue[] }
  const issues = Array.isArray(lintData?.issues) ? lintData.issues : []
  const targetIssue = issues.find((i) => i.code === issueCode || (i as any).id === issueCode)

  if (!targetIssue || !targetIssue.fix) {
    throw new ValidationError(`Lint issue '${issueCode}' does not have an automated fix`)
  }

  let patchOps: Operation[] = []
  try {
    const parsed = typeof targetIssue.fix === 'string' ? JSON.parse(targetIssue.fix) : targetIssue.fix
    patchOps = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    throw new ValidationError(`Fix payload for issue '${issueCode}' is not a valid JSON patch`)
  }

  const updatedJson = applyPatchSafe(existing.contract_json, patchOps)

  const validated = parseContract(updatedJson)
  const detIssues = runDeterministicLint(validated)
  const aiIssues = await runAiLint(validated, detIssues)
  const allIssues = [...detIssues, ...aiIssues]

  const updatedRow = await withTx(async (tx) => {
    await lockContract(tx, id)

    const [row] = await tx
      .update(contracts)
      .set({
        title: validated.title,
        contract_json: validated,
        lint_json: { issues: allIssues },
        total_minor: validated.total_minor,
        currency: validated.currency,
        version: existing.version + 1,
        updated_at: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning()

    if (!row) throw new NotFoundError('Contract', { id })

    await appendLedgerEvent(tx, {
      contractId: id,
      type: 'contract_draft_edited',
      actorType: 'buyer',
      actorId: user.sub,
      payload: {
        issue_code: issueCode,
        fix: targetIssue.fix,
      },
    })

    return row
  })

  return buildContractView(getDb(), updatedRow)
}

export async function proposeContract(
  id: string,
  user: SessionUser,
  sellerEmail?: string
): Promise<ContractView> {
  requireRole(user, 'buyer', 'admin')

  const { contract: existing } = await requireParty(getDb(), id, user)

  if (existing.buyer_id !== user.sub && user.role !== 'admin') {
    throw new ForbiddenError('Only the buyer can propose this contract')
  }

  if (existing.status !== 'DRAFT') {
    throw new ConflictError(`Cannot propose contract in status '${existing.status}'`)
  }

  // Check for blocking errors in lint
  const lintData = existing.lint_json as { issues?: LintIssue[] }
  const issues = Array.isArray(lintData?.issues) ? lintData.issues : []
  const hasErrors = issues.some((i) => i.severity === 'error')
  if (hasErrors) {
    throw new ValidationError(
      'Cannot propose contract with unresolved error-level lint issues'
    )
  }

  // Resolve seller if email provided
  let sellerId = existing.seller_id
  if (sellerEmail) {
    const normalizedEmail = sellerEmail.trim().toLowerCase()
    const [found] = await getDb()
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    if (found) {
      if (found.id === user.sub) {
        throw new ValidationError('Buyer cannot assign themselves as the seller')
      }
      sellerId = found.id
    } else {
      const [created] = await getDb()
        .insert(users)
        .values({
          email: normalizedEmail,
          display_name: normalizedEmail.split('@')[0] ?? 'Seller',
          role: 'seller',
        })
        .returning()
      if (created) sellerId = created.id
    }
  }

  const hash = contractHash(existing.contract_json)

  const updatedRow = await withTx(async (tx) => {
    await lockContract(tx, id)

    // Materialize milestones and criteria rows in DB
    await materializeMilestonesAndCriteria(tx, id, existing.contract_json)

    const updated = await transitionContractStatus(tx, id, 'DRAFT', 'PROPOSED', {
      contract_hash: hash,
      seller_id: sellerId,
    })

    await appendLedgerEvent(tx, {
      contractId: id,
      type: 'contract_proposed',
      actorType: 'buyer',
      actorId: user.sub,
      payload: {
        contract_hash: hash,
        seller_id: sellerId ?? '',
      },
    })

    return updated
  })

  return buildContractView(getDb(), updatedRow)
}

export async function acceptContract(
  id: string,
  user: SessionUser
): Promise<ContractView> {
  const existing = await getContractById(getDb(), id)
  if (!existing) {
    throw new NotFoundError('Contract', { id })
  }

  if (existing.status !== 'PROPOSED') {
    throw new ConflictError(`Cannot accept contract in status '${existing.status}'`)
  }

  // Buyer cannot accept their own contract
  if (existing.buyer_id === user.sub) {
    throw new ValidationError('Buyer cannot accept their own contract')
  }

  // If designated seller was assigned, only that seller (or admin) can accept
  if (existing.seller_id && existing.seller_id !== user.sub && user.role !== 'admin') {
    throw new ForbiddenError('Only the designated seller can accept this contract')
  }

  const assignedSellerId = existing.seller_id ?? user.sub

  const updatedRow = await withTx(async (tx) => {
    await lockContract(tx, id)

    const updated = await transitionContractStatus(tx, id, 'PROPOSED', 'ACCEPTED', {
      seller_id: assignedSellerId,
    })

    await appendLedgerEvent(tx, {
      contractId: id,
      type: 'contract_accepted',
      actorType: 'seller',
      actorId: user.sub,
      payload: {
        seller_id: assignedSellerId,
      },
    })

    return updated
  })

  return buildContractView(getDb(), updatedRow)
}

export async function cancelContract(
  id: string,
  user: SessionUser,
  reason?: string
): Promise<ContractView> {
  // CRITICAL SECURITY RULE: AI agents cannot cancel contracts
  forbidAgent(user)

  const { contract: existing } = await requireParty(getDb(), id, user)

  const allowedStatuses = ['DRAFT', 'PROPOSED', 'ACCEPTED', 'FUNDED', 'IN_PROGRESS']
  if (!allowedStatuses.includes(existing.status)) {
    throw new ConflictError(
      `Cannot cancel contract in status '${existing.status}'.`
    )
  }

  // If funded or in progress, only buyer may cancel, and no milestone can be VERIFYING
  const isFundedOrProgress = existing.status === 'FUNDED' || existing.status === 'IN_PROGRESS'
  if (isFundedOrProgress) {
    if (user.sub !== existing.buyer_id && user.role !== 'admin') {
      throw new ForbiddenError('Only the buyer can cancel an active or funded contract')
    }

    const db = getDb()
    const activeMilestones = await db
      .select({ status: milestones.status })
      .from(milestones)
      .where(eq(milestones.contract_id, id))

    if (activeMilestones.some((m) => m.status === 'VERIFYING')) {
      throw new ConflictError('Cannot cancel contract while milestone verification is active')
    }
  }

  const updatedRow = await withTx(async (tx) => {
    await lockContract(tx, id)

    const updated = await transitionContractStatus(
      tx,
      id,
      existing.status as any,
      'CANCELLED'
    )

    await appendLedgerEvent(tx, {
      contractId: id,
      type: 'CONTRACT_CANCELLED',
      actorType: user.sub === existing.buyer_id ? 'buyer' : 'seller',
      actorId: user.sub,
      payload: {
        reason: reason ?? 'User initiated cancellation',
      },
    })

    if (isFundedOrProgress) {
      await enqueueJob(
        tx,
        'VOID_REMAINING',
        {
          contract_id: id,
          reason: 'buyer_cancel',
        },
        {
          dedupeKey: `void:${id}`,
        }
      )
    }

    return updated
  })

  return buildContractView(getDb(), updatedRow)
}
