/**
 * Database State vs. Cryptographic Ledger Parity Verifier (N2)
 *
 * Reconstructs the deterministic contract state purely from the append-only
 * SHA-256 ledger event stream and asserts zero divergence against live
 * relational DB rows (`contracts`, `milestones`).
 */
import { eq, asc } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { contracts, milestones, ledger_events } from '@/server/db/schema'
import { verifyLedger } from '@/server/ledger/verify'
import { ZERO_HASH } from '@/server/contracts/canonical'
import {
  reduceLedger,
  type ContractReplayState,
  type LedgerEventInput,
} from '@/shared/ledger-reducer'
import { NotFoundError } from '@/server/util/errors'

export interface StateMismatch {
  scope: string
  field: string
  db_value: unknown
  ledger_value: unknown
}

export interface DbMilestoneSummary {
  milestone_key: string
  status: string
  amount_minor: number
  capture_id?: string | null
}

export interface DbContractSummary {
  id: string
  status: string
  total_minor: number
  authorization_id?: string | null
  funding_at_risk?: boolean
  captured_minor?: number
  milestones: DbMilestoneSummary[]
}

export interface StateCheckResult {
  contract_id: string
  chain_valid: boolean
  checked_events: number
  broken_at_seq: number | null
  head_hash: string
  state_matches_ledger: boolean
  mismatches: StateMismatch[]
  db_summary: DbContractSummary
  ledger_state: ContractReplayState
}

/**
 * Pure comparator comparing a DB snapshot against a reduced ledger state.
 * Safe to invoke cleanly in unit tests without touching PostgreSQL.
 */
export function compareDbToLedgerState(
  dbSummary: DbContractSummary,
  ledgerState: ContractReplayState
): StateMismatch[] {
  const mismatches: StateMismatch[] = []

  if (dbSummary.status !== ledgerState.status) {
    mismatches.push({
      scope: 'contract',
      field: 'status',
      db_value: dbSummary.status,
      ledger_value: ledgerState.status,
    })
  }

  if (ledgerState.total_minor > 0 && dbSummary.total_minor !== ledgerState.total_minor) {
    mismatches.push({
      scope: 'contract',
      field: 'total_minor',
      db_value: dbSummary.total_minor,
      ledger_value: ledgerState.total_minor,
    })
  }

  const dbCapturedMinor =
    dbSummary.captured_minor ??
    dbSummary.milestones
      .filter((m) => m.status === 'RELEASED')
      .reduce((sum, m) => sum + m.amount_minor, 0)

  if (dbCapturedMinor !== ledgerState.captured_minor) {
    mismatches.push({
      scope: 'contract',
      field: 'captured_minor',
      db_value: dbCapturedMinor,
      ledger_value: ledgerState.captured_minor,
    })
  }

  const dbAuth = dbSummary.authorization_id ?? null
  const ledgerAuth = ledgerState.authorization_id ?? null
  if (dbAuth !== ledgerAuth) {
    mismatches.push({
      scope: 'contract',
      field: 'authorization_id',
      db_value: dbAuth,
      ledger_value: ledgerAuth,
    })
  }

  const seenKeys = new Set<string>()

  for (const dbM of dbSummary.milestones) {
    seenKeys.add(dbM.milestone_key)
    const lm = ledgerState.milestones[dbM.milestone_key]

    if (!lm) {
      const terminalVoided =
        ['CANCELLED', 'FAILED', 'EXPIRED'].includes(ledgerState.status) &&
        ledgerState.voided_minor > 0
      const expectedUntouched = terminalVoided ? 'VOIDED' : 'PENDING'

      if (dbM.status !== expectedUntouched) {
        mismatches.push({
          scope: `milestone:${dbM.milestone_key}`,
          field: 'status',
          db_value: dbM.status,
          ledger_value: expectedUntouched,
        })
      }
      continue
    }

    // Worker enters VERIFYING transiently right after SUBMISSION_RECEIVED without emitting a separate ledger row
    const isTransientVerifying =
      dbM.status === 'VERIFYING' && lm.status === 'SUBMITTED'

    if (!isTransientVerifying && dbM.status !== lm.status) {
      mismatches.push({
        scope: `milestone:${dbM.milestone_key}`,
        field: 'status',
        db_value: dbM.status,
        ledger_value: lm.status,
      })
    }

    if (
      (dbM.capture_id ?? null) !== (lm.paypal_capture_id ?? null) &&
      (dbM.capture_id || lm.paypal_capture_id)
    ) {
      mismatches.push({
        scope: `milestone:${dbM.milestone_key}`,
        field: 'capture_id',
        db_value: dbM.capture_id ?? null,
        ledger_value: lm.paypal_capture_id ?? null,
      })
    }
  }

  if (dbSummary.milestones.length > 0) {
    for (const [mKey, lm] of Object.entries(ledgerState.milestones)) {
      if (!seenKeys.has(mKey)) {
        mismatches.push({
          scope: `milestone:${mKey}`,
          field: 'presence',
          db_value: 'missing',
          ledger_value: lm.status,
        })
      }
    }
  }

  return mismatches
}

/**
 * Queries live DB state + SHA-256 ledger events and returns both hash-chain
 * verification and relational-state parity status.
 */
export async function verifyStateAgainstLedger(
  contractId: string
): Promise<StateCheckResult> {
  const db = getDb()

  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))

  if (!contract) {
    throw new NotFoundError('Contract', { id: contractId })
  }

  const milestoneRows = await db
    .select()
    .from(milestones)
    .where(eq(milestones.contract_id, contractId))
    .orderBy(asc(milestones.idx))

  const ledgerRows = await db
    .select()
    .from(ledger_events)
    .where(eq(ledger_events.contract_id, contractId))
    .orderBy(asc(ledger_events.seq))

  const chainResult = await verifyLedger(contractId)

  const inputs: LedgerEventInput[] = ledgerRows.map((e) => ({
    seq: e.seq,
    type: e.type,
    actor_type: e.actor_type,
    actor_id: e.actor_id,
    payload: (e.payload as Record<string, any>) || {},
    created_at: new Date(e.created_at).toISOString(),
    hash: e.hash,
    prev_hash: e.prev_hash,
  }))

  const ledgerState = reduceLedger(inputs, contractId)
  const headHash =
    ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1]!.hash : ZERO_HASH

  const dbSummary: DbContractSummary = {
    id: contract.id,
    status: contract.status,
    total_minor: contract.total_minor,
    authorization_id: contract.authorization_id ?? null,
    funding_at_risk: contract.funding_at_risk,
    milestones: milestoneRows.map((m) => ({
      milestone_key: m.milestone_key,
      status: m.status,
      amount_minor: m.amount_minor,
      capture_id: m.capture_id ?? null,
    })),
  }

  const mismatches = compareDbToLedgerState(dbSummary, ledgerState)

  return {
    contract_id: contractId,
    chain_valid: chainResult.valid,
    checked_events: ledgerRows.length,
    broken_at_seq: chainResult.valid ? null : chainResult.broken_at_seq,
    head_hash: headHash,
    state_matches_ledger: chainResult.valid && mismatches.length === 0,
    mismatches,
    db_summary: dbSummary,
    ledger_state: ledgerState,
  }
}

