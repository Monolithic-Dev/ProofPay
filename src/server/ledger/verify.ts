/**
 * Ledger chain verification — walk all events and re-compute hashes.
 */
import { eq, asc } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { ledger_events } from '@/server/db/schema'
import { hashLedgerEvent, ZERO_HASH } from '@/server/contracts/canonical'
import { isoMs } from '@/server/util/time'

export type VerifyResult =
  | { valid: true }
  | { valid: false; broken_at_seq: number; expected: string; got: string }

/**
 * Verify the entire hash chain for a contract's ledger.
 * O(n) in events — fine for hackathon scale.
 */
export async function verifyLedger(contractId: string): Promise<VerifyResult> {
  const db = getDb()
  const events = await db
    .select()
    .from(ledger_events)
    .where(eq(ledger_events.contract_id, contractId))
    .orderBy(asc(ledger_events.seq))

  let prevHash = ZERO_HASH

  for (const event of events) {
    const createdAt = isoMs(new Date(event.created_at))
    const expected = hashLedgerEvent({
      prevHash,
      contractId: event.contract_id,
      seq: event.seq,
      type: event.type,
      payload: event.payload as Record<string, unknown>,
      createdAt,
    })

    if (expected !== event.hash) {
      return {
        valid: false,
        broken_at_seq: event.seq,
        expected,
        got: event.hash,
      }
    }

    prevHash = event.hash
  }

  return { valid: true }
}
