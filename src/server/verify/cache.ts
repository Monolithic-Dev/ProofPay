/**
 * Verification caching — saves cost and latency by reusing prior Stage 2 and Stage 3 evaluations.
 * Implements phase-4-verification-engine.md §4.7 & data-model.md §3.7.
 */
import { eq, and, desc } from 'drizzle-orm'
import type { Tx, Db } from '@/server/db/client'
import { getDb } from '@/server/db/client'
import { verifications, type VerificationRow } from '@/server/db/schema'
import { canonicalize, sha256Hex } from '@/server/contracts/canonical'

export interface ComputeInputHashParams {
  artifactSha256: string
  criteria: unknown
  promptVersion: string
  model: string
}

/**
 * Compute the deterministic input hash for a verification.
 * input_hash = sha256(artifactSha256 + canonicalize(criteria) + promptVersion + model)
 */
export function computeInputHash(params: ComputeInputHashParams): string {
  const { artifactSha256, criteria, promptVersion, model } = params
  const payload = `${artifactSha256}:${canonicalize(criteria)}:${promptVersion}:${model}`
  return sha256Hex(payload)
}

/**
 * Find the most recent COMPLETE verification with a matching input_hash.
 */
export async function findCachedVerification(
  txOrDb: Tx | Db | null,
  inputHash: string
): Promise<VerificationRow | null> {
  const db = txOrDb ?? getDb()

  const [row] = await db
    .select()
    .from(verifications)
    .where(and(eq(verifications.input_hash, inputHash), eq(verifications.status, 'COMPLETE')))
    .orderBy(desc(verifications.completed_at))
    .limit(1)

  return row ?? null
}
