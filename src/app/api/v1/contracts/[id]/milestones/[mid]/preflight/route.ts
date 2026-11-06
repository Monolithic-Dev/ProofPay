/**
 * Pre-Flight Verification Route — POST /api/v1/contracts/[id]/milestones/[mid]/preflight
 * Implements docs/v2/01-NEXT-LEVEL-STRATEGY.md F2-lite & Judge Simulation.
 *
 * Runs deterministic checks, PII guards, and adversarial injection detection
 * without consuming an attempt or altering contract state.
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
import { requireParty } from '@/server/auth/guards'
import { AppError } from '@/server/util/errors'
import { HEURISTIC_PATTERNS } from '@/server/verify/adversarial'

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

    // 1. Verify contract & ensure user is party or admin (Zero-Trust IDOR guard)
    const { contract } = await requireParty(db, contractId, user!)

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

    // 6. Adversarial injection scan (Threat Defense)
    const matchedPatterns: string[] = []
    for (const pat of HEURISTIC_PATTERNS) {
      if (pat.regex.test(parsed.text)) {
        matchedPatterns.push(pat.name)
      }
    }
    const hasAdversarial = matchedPatterns.length > 0

    const reasons = failedRequired.map((f) => `Required check ${f.criterion_key} failed: ${f.result.message}`)
    if (hasAdversarial) {
      reasons.push(`Prompt injection detected: ${matchedPatterns.join(', ')}`)
    }

    const ready = failedRequired.length === 0 && !hasAdversarial

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
      adversarial: {
        detected: hasAdversarial,
        patterns: matchedPatterns,
      },
      pii: {
        redactions_detected: piiScan.redactionCount,
        breakdown: piiScan.redactionsByType,
      },
    })
  }
)
