/**
 * Pre-Flight Verification Route — POST /api/v1/contracts/[id]/milestones/[mid]/preflight
 * Implements docs/v2/01-NEXT-LEVEL-STRATEGY.md F2-lite.
 *
 * Runs deterministic checks and PII guards without consuming an attempt or altering state.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { apiHandler } from '@/server/http/handler'
import { getDb } from '@/server/db/client'
import { contracts, milestones, criteria } from '@/server/db/schema'
import { parseArtifact } from '@/server/verify/artifact'
import { runDeterministicCheck } from '@/server/verify/deterministic/registry'
import { maskPii } from '@/lib/pii'
import { AppError } from '@/server/util/errors'

const PreflightBodySchema = z.object({
  content_type: z.enum(['json_records', 'text']),
  content: z.union([z.string(), z.array(z.record(z.unknown()))]),
})

export const POST = apiHandler(
  {
    auth: 'user',
    body: PreflightBodySchema,
    maxBytes: 1.2 * 1024 * 1024,
  },
  async ({ user, params, body }) => {
    const contractId = params['id']!
    const milestoneKey = params['mid']!
    const db = getDb()

    // 1. Verify contract & milestone exist
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId))
    if (!contract) {
      throw new AppError('NOT_FOUND', `Contract ${contractId} not found`, 404)
    }

    const [milestone] = await db
      .select()
      .from(milestones)
      .where(and(eq(milestones.contract_id, contractId), eq(milestones.milestone_key, milestoneKey)))

    if (!milestone) {
      throw new AppError('NOT_FOUND', `Milestone ${milestoneKey} not found`, 404)
    }

    // 2. Fetch milestone criteria
    const milestoneCriteria = await db
      .select()
      .from(criteria)
      .where(eq(criteria.milestone_id, milestone.id))

    // 3. Parse artifact
    const parsed = parseArtifact(body!.content_type, body!.content)

    // 4. Run deterministic checks
    const detCriteria = milestoneCriteria.filter((c) => c.type === 'deterministic')
    const checkResults = detCriteria.map((c) => {
      const spec = (c.spec_json || {}) as Record<string, unknown>
      return {
        criterion_id: c.id,
        criterion_key: c.criterion_key,
        required: c.required,
        statement: c.statement,
        result: runDeterministicCheck(
          {
            criterion_key: c.criterion_key,
            check: c.check_name || '',
            spec,
          },
          parsed
        ),
      }
    })

    const failedRequired = checkResults.filter((r) => r.required && !r.result.passed)

    // 5. PII scan
    const piiScan = maskPii(parsed.text)

    const ready = failedRequired.length === 0
    const reasons = failedRequired.map((f) => `Required check ${f.criterion_key} failed: ${f.result.message}`)

    return NextResponse.json({
      ready,
      milestone_key: milestoneKey,
      deterministic_checks_count: checkResults.length,
      passed_count: checkResults.filter((r) => r.result.passed).length,
      failed_count: checkResults.filter((r) => !r.result.passed).length,
      checks: checkResults.map((cr) => ({
        key: cr.criterion_key,
        required: cr.required,
        status: cr.result.passed ? 'pass' : 'fail',
        message: cr.result.message,
      })),
      reasons,
      pii: {
        redactions_detected: piiScan.redactionCount,
        breakdown: piiScan.redactionsByType,
      },
    })
  }
)
