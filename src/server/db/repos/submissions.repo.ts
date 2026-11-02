/**
 * Submissions repository — data access for submissions table.
 * Implements phase-2-data-layer.md §2.10.
 */
import { eq, and, desc, sql } from 'drizzle-orm'
import type { Tx, Db } from '@/server/db/client'
import { submissions, verifications, type SubmissionRow } from '@/server/db/schema'

export async function insertSubmission(
  tx: Tx,
  params: {
    milestoneId: string
    submittedBy: string
    contentType: string
    contentText: string
    sizeBytes: number
    sha256: string
  }
): Promise<SubmissionRow> {
  // Compute attempt number = existing count + 1
  const countRows = await tx
    .select({
      count: sql<number>`count(*)`,
    })
    .from(submissions)
    .where(eq(submissions.milestone_id, params.milestoneId))

  const attempt = Number(countRows[0]?.count ?? 0) + 1

  const [row] = await tx
    .insert(submissions)
    .values({
      milestone_id: params.milestoneId,
      submitted_by: params.submittedBy,
      attempt,
      content_type: params.contentType,
      content_text: params.contentText,
      size_bytes: params.sizeBytes,
      sha256: params.sha256,
    })
    .returning()

  if (!row) throw new Error('Failed to insert submission')
  return row
}

export async function getSubmission(tx: Tx | Db, id: string): Promise<SubmissionRow | null> {
  const rows = await tx.select().from(submissions).where(eq(submissions.id, id)).limit(1)
  return rows[0] ?? null
}

export async function getLatestSubmission(
  tx: Tx | Db,
  milestoneId: string
): Promise<SubmissionRow | null> {
  const rows = await tx
    .select()
    .from(submissions)
    .where(eq(submissions.milestone_id, milestoneId))
    .orderBy(desc(submissions.attempt))
    .limit(1)

  return rows[0] ?? null
}

export async function getAcceptedSubmission(
  tx: Tx | Db,
  milestoneId: string
): Promise<SubmissionRow | null> {
  // Finds the submission whose verification decision was 'PASS'
  const rows = await tx
    .select({ submission: submissions })
    .from(submissions)
    .innerJoin(verifications, eq(verifications.submission_id, submissions.id))
    .where(and(eq(submissions.milestone_id, milestoneId), eq(verifications.decision, 'PASS')))
    .orderBy(desc(submissions.attempt))
    .limit(1)

  return rows[0]?.submission ?? null
}
