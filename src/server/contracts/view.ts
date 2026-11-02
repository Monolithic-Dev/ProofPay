/**
 * Contract view builder — formats DB contracts into the ContractView shape.
 * Implements phase-3-auth-and-contracts.md §3.10 & api-spec.md §3.
 */
import type { Tx, Db } from '@/server/db/client'
import type { ContractRow, MilestoneRow } from '@/server/db/schema'
import type { ContractView, MilestoneView, LintIssue } from '@/shared/types'
import { listMilestones } from '@/server/db/repos/milestones.repo'

export async function buildContractView(
  txOrDb: Tx | Db,
  contract: ContractRow
): Promise<ContractView> {
  const milestoneRows = await listMilestones(txOrDb, contract.id)

  const contractJson = contract.contract_json as any
  const lintJson = contract.lint_json as { issues: LintIssue[] }

  let milestones: MilestoneView[] = []

  if (milestoneRows.length > 0) {
    milestones = milestoneRows.map((m: MilestoneRow) => {
      const del = m.deliverable_json as any
      return {
        id: m.id,
        contract_id: m.contract_id,
        milestone_key: m.milestone_key,
        idx: m.idx,
        title: m.title,
        amount_minor: m.amount_minor,
        due_in_days: m.due_in_days,
        due_at: m.due_at ? m.due_at.toISOString() : undefined,
        status: m.status as any,
        revisions_used: m.revisions_used,
        max_revisions: m.max_revisions,
        deliverable: {
          content_type: del?.content_type ?? 'json_records',
          max_bytes: del?.max_bytes ?? 1048576,
          description: del?.description ?? '',
        },
        capture_id: m.capture_id ?? undefined,
        captured_at: m.captured_at ? m.captured_at.toISOString() : undefined,
        escalated_at: m.escalated_at ? m.escalated_at.toISOString() : undefined,
        auto_release_at: m.auto_release_at ? m.auto_release_at.toISOString() : undefined,
      }
    })
  } else if (contractJson?.milestones && Array.isArray(contractJson.milestones)) {
    // Derived from JSON for pre-accepted contracts
    milestones = contractJson.milestones.map((m: any, idx: number) => ({
      id: `00000000-0000-0000-0000-00000000000${idx + 1}`,
      contract_id: contract.id,
      milestone_key: m.key,
      idx: idx + 1,
      title: m.title,
      amount_minor: m.amount_minor,
      due_in_days: m.due_in_days,
      status: 'PENDING',
      revisions_used: 0,
      max_revisions: 2,
      deliverable: {
        content_type: m.deliverable?.content_type ?? 'json_records',
        max_bytes: m.deliverable?.max_bytes ?? 1048576,
        description: m.deliverable?.description ?? '',
      },
    }))
  }

  // Calculate if authorization hold is at risk (e.g. past honor period or nearing expiration)
  const nowMs = Date.now()
  let fundingAtRisk = false
  if (contract.honor_until) {
    const honorUntilMs = new Date(contract.honor_until).getTime()
    if (nowMs > honorUntilMs && contract.status === 'IN_PROGRESS') {
      fundingAtRisk = true
    }
  }

  return {
    id: contract.id,
    buyer_id: contract.buyer_id,
    seller_id: contract.seller_id ?? undefined,
    title: contract.title,
    status: contract.status as any,
    contract_json: contract.contract_json as Record<string, unknown>,
    contract_hash: contract.contract_hash ?? undefined,
    lint_json: {
      issues: lintJson?.issues ?? [],
    },
    version: contract.version,
    currency: 'USD',
    total_minor: contract.total_minor,
    paypal_order_id: contract.paypal_order_id ?? undefined,
    authorization_id: contract.authorization_id ?? undefined,
    honor_until: contract.honor_until ? contract.honor_until.toISOString() : undefined,
    auth_expires_at: contract.auth_expires_at ? contract.auth_expires_at.toISOString() : undefined,
    funded_at: contract.funded_at ? contract.funded_at.toISOString() : undefined,
    funding_at_risk: fundingAtRisk,
    milestones,
    created_at: contract.created_at.toISOString(),
    updated_at: contract.updated_at.toISOString(),
    accepted_at: contract.accepted_at ? contract.accepted_at.toISOString() : undefined,
    completed_at: contract.completed_at ? contract.completed_at.toISOString() : undefined,
  }
}
