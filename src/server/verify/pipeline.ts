/**
 * 4-Stage Verification Pipeline Orchestrator.
 * Implements phase-4-verification-engine.md §4.7 & ai-pipeline.md §3.
 *
 * Sequence:
 * Stage 1: Deterministic checks (local, <50ms)
 *          If any REQUIRED fails → skip Stage 2 (saves LLM cost/tokens).
 * Stage 2: Rubric criteria via LLM (forced tool call, verbatim quote substring verification)
 *          Pass downgraded to cannot_verify if quotes missing.
 * Stage 3: Adversarial / injection scan (heuristics + fast model audit)
 * Stage 4: Policy engine (pure function, rules 1–8 strictly ordered)
 */
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { verifications, criteria, submissions, milestones, contracts } from '@/server/db/schema'
import { parseArtifact } from './artifact'
import { runDeterministicCheck } from './deterministic/registry'
import { runRubricStage } from './rubric'
import { runAdversarialStage } from './adversarial'
import {
  decide,
  type PolicyCriterion,
  type Stage1CheckResult,
  type Stage2RubricResult,
  type PolicyInput,
} from './policy'
import { computeInputHash, findCachedVerification } from './cache'
import { PROMPT_VERSION as RUBRIC_PROMPT_VERSION } from '@/server/ai/prompts/rubric.v1'
import { env } from '@/server/config/env'
import { logger } from '@/server/util/logger'
import { now } from '@/server/util/time'
import { AppError } from '@/server/util/errors'

export interface RunVerificationPipelineParams {
  verificationId: string
  submissionId: string
  contractId: string
  milestoneId?: string
  milestoneKey?: string
  attemptNumber?: number
}

export async function runVerificationPipeline(params: RunVerificationPipelineParams): Promise<void> {
  const { verificationId, submissionId, contractId } = params
  const db = getDb()
  const log = logger.child({
    verification_id: verificationId,
    submission_id: submissionId,
    contract_id: contractId,
  })
  const start = Date.now()

  try {
    // -------------------------------------------------------------------------
    // 1. Load submission, milestone, contract, and criteria
    // -------------------------------------------------------------------------
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))

    if (!submission) {
      throw new AppError('NOT_FOUND', `Submission ${submissionId} not found`, 404)
    }

    const resolvedMilestoneId = params.milestoneId ?? submission.milestone_id

    const [milestone] = await db
      .select()
      .from(milestones)
      .where(eq(milestones.id, resolvedMilestoneId))

    if (!milestone) {
      throw new AppError('NOT_FOUND', `Milestone ${resolvedMilestoneId} not found`, 404)
    }

    const [contractRow] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))

    if (!contractRow) {
      throw new AppError('NOT_FOUND', `Contract ${contractId} not found`, 404)
    }

    const criteriaRows = await db
      .select()
      .from(criteria)
      .where(eq(criteria.milestone_id, resolvedMilestoneId))

    // -------------------------------------------------------------------------
    // 2. Parse & sanitize artifact
    // -------------------------------------------------------------------------
    const parsedArtifact = parseArtifact(
      submission.content_type as 'json_records' | 'text',
      submission.content_text
    )

    // -------------------------------------------------------------------------
    // 3. Compute Input Hash & check cache
    // -------------------------------------------------------------------------
    const criteriaForHash = criteriaRows.map((c) => ({
      key: c.criterion_key,
      type: c.type,
      spec_json: c.spec_json,
      statement: c.statement ?? undefined,
      pass_threshold: c.pass_threshold ? parseFloat(c.pass_threshold) : undefined,
      required: c.required,
    }))

    const inputHash = computeInputHash({
      artifactSha256: submission.sha256,
      criteria: criteriaForHash,
      promptVersion: RUBRIC_PROMPT_VERSION,
      model: env.ANTHROPIC_MODEL,
    })

    const cached = await findCachedVerification(db, inputHash)
    if (cached && cached.id !== verificationId && cached.status === 'COMPLETE') {
      log.info({ cache_source: cached.id }, 'Verification cache hit: reusing results')
      await db
        .update(verifications)
        .set({
          status: 'COMPLETE',
          decision: cached.decision,
          reasons: cached.reasons,
          stage1_json: cached.stage1_json,
          stage2_json: cached.stage2_json,
          stage3_json: cached.stage3_json,
          confidence: cached.confidence,
          manipulation_severity: cached.manipulation_severity,
          degraded: cached.degraded,
          cache_hit: true,
          model: cached.model,
          model_fast: cached.model_fast,
          prompt_version: cached.prompt_version,
          input_hash: inputHash,
          latency_ms: Date.now() - start,
          completed_at: now(),
        })
        .where(eq(verifications.id, verificationId))
      return
    }

    // -------------------------------------------------------------------------
    // 4. Stage 1: Deterministic checks
    // -------------------------------------------------------------------------
    const detCriteria = criteriaRows.filter((c) => c.type === 'deterministic')
    const stage1Results: Stage1CheckResult[] = []

    for (const c of detCriteria) {
      if (!c.check_name) continue
      const res = runDeterministicCheck(
        c.check_name,
        parsedArtifact,
        c.spec_json as Record<string, unknown>
      )
      stage1Results.push({
        criterion_key: c.criterion_key,
        check_name: c.check_name,
        required: c.required,
        passed: res.passed,
        status: res.passed ? 'pass' : 'fail',
        message: res.reason,
        reason: res.reason,
      })
    }

    const anyRequiredDetFailed = stage1Results.some(
      (r) => r.required && (r.passed === false || r.status === 'fail')
    )

    // -------------------------------------------------------------------------
    // 5. Stage 2: Rubric LLM evaluation (conditional on det checks passing)
    // -------------------------------------------------------------------------
    const rubricCriteria = criteriaRows.filter((c) => c.type === 'rubric')
    let stage2Results: Stage2RubricResult[] | null = null
    let rubricDegraded = false

    if (rubricCriteria.length > 0) {
      if (anyRequiredDetFailed) {
        log.info('Skipping Stage 2 rubric evaluation because required deterministic check failed')
      } else {
        // Collect context artifacts from accepted prior milestones if requested
        const contextArtifacts: Record<string, string> = {}
        const requiredContextKeys = new Set<string>()

        for (const rc of rubricCriteria) {
          if (rc.context_milestones && rc.context_milestones.length > 0) {
            for (const cmKey of rc.context_milestones) {
              requiredContextKeys.add(cmKey)
            }
          }
        }

        if (requiredContextKeys.size > 0) {
          const priorMilestones = await db
            .select({
              id: milestones.id,
              milestone_key: milestones.milestone_key,
              status: milestones.status,
            })
            .from(milestones)
            .where(eq(milestones.contract_id, contractId))

          for (const pm of priorMilestones) {
            if (requiredContextKeys.has(pm.milestone_key)) {
              // Find latest successful submission
              const [priorSub] = await db
                .select({ content_text: submissions.content_text })
                .from(submissions)
                .where(eq(submissions.milestone_id, pm.id))
                .orderBy(submissions.attempt)
                .limit(1)

              if (priorSub) {
                contextArtifacts[pm.milestone_key] = priorSub.content_text
              }
            }
          }
        }

        const rubricOut = await runRubricStage({
          contractId,
          criteria: rubricCriteria.map((c) => ({
            key: c.criterion_key,
            statement: c.statement ?? '',
            pass_threshold: c.pass_threshold ? parseFloat(c.pass_threshold) : 0.7,
            context_milestones: c.context_milestones ?? undefined,
          })),
          artifact: parsedArtifact,
          contextArtifacts,
        })

        stage2Results = rubricOut.results.map((r) => ({
          criterion_key: r.criterion_key,
          verdict: r.verdict,
          score: r.score,
          confidence: r.confidence,
          evidence_verified: r.evidence_verified,
          reasoning: r.reasoning,
          evidence: r.evidence.map((e) => e.quote).join('; '),
        }))
        rubricDegraded = rubricOut.unavailable
      }
    }

    // -------------------------------------------------------------------------
    // 6. Stage 3: Adversarial / injection scan
    // -------------------------------------------------------------------------
    const stage3Result = await runAdversarialStage({
      contractId,
      artifactText: parsedArtifact.text,
    })

    // -------------------------------------------------------------------------
    // 7. Stage 4: Policy decision
    // -------------------------------------------------------------------------
    const contractJson = contractRow.contract_json as { policy?: { verifier_confidence_min?: number } } | null
    const confidenceMin = contractJson?.policy?.verifier_confidence_min ?? 0.6

    const policyCriteria: PolicyCriterion[] = criteriaRows.map((c) => ({
      key: c.criterion_key,
      type: c.type,
      required: c.required,
      pass_threshold: c.pass_threshold ? parseFloat(c.pass_threshold) : undefined,
    }))

    const policyInput: PolicyInput = {
      stage1: stage1Results,
      stage2: stage2Results,
      stage3: stage3Result,
      criteria: policyCriteria,
      degraded: rubricDegraded || stage3Result.degraded,
      confidenceMin,
    }

    const decisionOutput = decide(policyInput)
    const latencyMs = Date.now() - start

    // -------------------------------------------------------------------------
    // 8. Persist verification result
    // -------------------------------------------------------------------------
    await db
      .update(verifications)
      .set({
        status: 'COMPLETE',
        decision: decisionOutput.decision,
        reasons: decisionOutput.reasons,
        stage1_json: stage1Results,
        stage2_json: stage2Results,
        stage3_json: stage3Result,
        confidence: decisionOutput.confidence !== undefined ? decisionOutput.confidence.toFixed(2) : null,
        manipulation_severity: decisionOutput.manipulation_severity,
        degraded: rubricDegraded || stage3Result.degraded,
        cache_hit: false,
        model: env.ANTHROPIC_MODEL,
        model_fast: env.ANTHROPIC_MODEL_FAST,
        prompt_version: RUBRIC_PROMPT_VERSION,
        input_hash: inputHash,
        latency_ms: latencyMs,
        completed_at: now(),
      })
      .where(eq(verifications.id, verificationId))

    log.info(
      {
        decision: decisionOutput.decision,
        reasons_count: decisionOutput.reasons.length,
        latency_ms: latencyMs,
      },
      'Verification pipeline completed'
    )
  } catch (err) {
    log.error({ err: String(err) }, 'Verification pipeline failed with unhandled error')
    await db
      .update(verifications)
      .set({
        status: 'FAILED',
        reasons: [{ code: 'PIPELINE_ERROR', message: (err as Error).message }],
        completed_at: now(),
      })
      .where(eq(verifications.id, verificationId))
    throw err
  }
}
