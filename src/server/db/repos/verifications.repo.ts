/**
 * Verifications repository — data access for verifications table.
 * Implements phase-2-data-layer.md §2.10.
 */
import { eq, desc } from 'drizzle-orm'
import type { Tx, Db } from '@/server/db/client'
import { verifications, type VerificationRow, type NewVerification } from '@/server/db/schema'

export async function insertVerification(
  tx: Tx,
  data: NewVerification
): Promise<VerificationRow> {
  const [row] = await tx.insert(verifications).values(data).returning()
  if (!row) throw new Error('Failed to insert verification')
  return row
}

export async function getVerificationById(
  tx: Tx | Db,
  id: string
): Promise<VerificationRow | null> {
  const rows = await tx.select().from(verifications).where(eq(verifications.id, id)).limit(1)
  return rows[0] ?? null
}

export async function getLatestVerificationForSubmission(
  tx: Tx | Db,
  submissionId: string
): Promise<VerificationRow | null> {
  const rows = await tx
    .select()
    .from(verifications)
    .where(eq(verifications.submission_id, submissionId))
    .orderBy(desc(verifications.created_at))
    .limit(1)

  return rows[0] ?? null
}
