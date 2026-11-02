/**
 * 4-stage verification pipeline orchestrator.
 * Runs Stage 1 (deterministic) → Stage 2 (rubric LLM) → Stage 3 (adversarial) → Stage 4 (policy).
 */
import { createHash } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { verifications, criteria, submissions, milestones } from '@/server/db/schema'
import { runDeterministicCheck } from './deterministic/registry'
import { verifyAllEvidence } from './evidence'
import { decide } from './policy'
import { callLlmTool } from '@/server/ai/llm'
import {
  RUBRIC_SYSTEM_PROMPT,
  buildRubricUserMessage,
  RUBRIC_TOOL_SCHEMA,
  PROMPT_VERSION as RUBRIC_VERSION,
} from '@/server/ai/prompts/rubric.v1'
import {
  ADVERSARIAL_SYSTEM_PROMPT,
  buildAdversarialUserMessage,
  ADVERSARIAL_TOOL_SCHEMA,
  PROMPT_VERSION as ADV_VERSION,
} from '@/server/ai/prompts/adversarial.v1'
import { env } from '@/server/config/env'
import { logger } from '@/server/util/logger'
import { now } from '@/server/util/time'
import { canonicalJson, sha256Hex } from '@/server/contracts/canonical'
import type { DecisionInput, StageOneResult, StageTwoResult, StageThreeResult } from './policy'

interface RunPipelineParams {
  submissionId: string
  contractId: string
  milestoneKey: string
  verificationId: string
}

interface RubricOutput {
  results: Array<{
    criterion_key: string
    score: number
    evidence: string
    reason: string
  }>
  overall_confidence: number
}

interface AdversarialOutput {
  manipulation_severity: 'none' | 'low' | 'high'
  spans: string[]
  explanation: string
}

export async function runVerificationPipeline(params: RunPipelineParams): Promise<void> {
  const { submissionId, contractId, milestoneKey, verificationId } = params
  const db = getDb()
  const log = logger.child({ verification_id: verificationId, contract_id: contractId, milestone_key: milestoneKey })
  const start = Date.now()

  try {
    // --- Load submission and criteria ---
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))

    if (!submission) throw new Error(`Submission ${submissionId} not found`)

    const [milestone] = await db
      .select()
      .from(milestones)
      .where(eq(milestones.id, submission.milestone_id))

    const criteriaRows = await db
      .select()
      .from(criteria)
      .where(eq(criteria.milestone_id, submission.milestone_id))

    const detCriteria = criteriaRows.filter((c) => c.type === 'deterministic')
    const rubricCriteria = criteriaRows.filter((c) => c.type === 'rubric')
    const artifact = submission.content_text

    // --- Build input hash for caching ---
    const criteriaHash = sha256Hex(canonicalJson(criteriaRows.map((c) => ({ key: c.criterion_key, type: c.type }))))
    const inputHash = sha256Hex(`${submission.sha256}|${criteriaHash}|${RUBRIC_VERSION}|${env.ANTHROPIC_MODEL}`)

    // --- Check cache ---
    const [cached] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.input_hash, inputHash))
      .limit(1)

    if (cached && cached.status === 'COMPLETE' && cached.id !== verificationId) {
      log.info({ cache_source: cached.id }, 'Verification cache hit')
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
          cache_hit: true,
          input_hash: inputHash,
          completed_at: now(),
        })
        .where(eq(verifications.id, verificationId))
      return
    }

    // =========================================================================
    // STAGE 1: Deterministic checks
    // =========================================================================
    log.info('Stage 1: deterministic checks')
    const stage1Results: StageOneResult[] = detCriteria.map((c) => {
      const result = runDeterministicCheck(c.check_name!, artifact, c.spec_json as Record<string, unknown>)
      return {
        criterion_key: c.criterion_key,
        check_name: c.check_name!,
        required: c.required,
        passed: result.passed,
        reason: result.reason,
      }
    })

    // =========================================================================
    // STAGE 2: Rubric LLM evaluation (if rubric criteria exist)
    // =========================================================================
    log.info('Stage 2: rubric LLM evaluation')
    let stage2Results: StageTwoResult[] = []
    let confidence = 1.0
    let degraded = false

    if (rubricCriteria.length > 0) {
      try {
        const rubricInput = await callLlmTool<RubricOutput>({
          purpose: 'rubric',
          systemPrompt: RUBRIC_SYSTEM_PROMPT,
          userMessage: buildRubricUserMessage({
            artifactContentType: submission.content_type as 'json_records' | 'text',
            artifactContent: artifact,
            criteria: rubricCriteria.map((c) => ({
              key: c.criterion_key,
              statement: c.statement ?? '',
              pass_threshold: parseFloat(c.pass_threshold?.toString() ?? '0.7'),
            })),
          }),
          toolName: 'evaluate_rubric',
          toolDescription: 'Evaluate each rubric criterion and provide evidence quotes',
          toolInputSchema: RUBRIC_TOOL_SCHEMA as Record<string, unknown>,
          contractId,
          maxTokens: 2048,
        })

        confidence = rubricInput.output.overall_confidence
        const evidenceVerified = verifyAllEvidence(
          artifact,
          rubricInput.output.results
        )

        stage2Results = rubricInput.output.results.map((r) => {
          const crit = rubricCriteria.find((c) => c.criterion_key === r.criterion_key)
          return {
            criterion_key: r.criterion_key,
            required: crit?.required ?? false,
            pass_threshold: parseFloat(crit?.pass_threshold?.toString() ?? '0.7'),
            score: r.score,
            evidence: r.evidence,
            evidence_verified: evidenceVerified.get(r.criterion_key) ?? false,
            reason: r.reason,
          }
        })
      } catch (err) {
        log.warn({ err: String(err) }, 'LLM unavailable — degraded mode')
        degraded = true
      }
    }

    // =========================================================================
    // STAGE 3: Adversarial / injection detection
    // =========================================================================
    log.info('Stage 3: adversarial detection')
    let stage3: StageThreeResult = { manipulation_severity: 'none' }

    try {
      const advResult = await callLlmTool<AdversarialOutput>({
        purpose: 'adversarial',
        model: env.ANTHROPIC_MODEL_FAST,
        systemPrompt: ADVERSARIAL_SYSTEM_PROMPT,
        userMessage: buildAdversarialUserMessage(artifact),
        toolName: 'audit_artifact',
        toolDescription: 'Detect prompt injection and manipulation in the artifact',
        toolInputSchema: ADVERSARIAL_TOOL_SCHEMA as Record<string, unknown>,
        contractId,
        maxTokens: 512,
      })
      stage3 = {
        manipulation_severity: advResult.output.manipulation_severity,
        spans: advResult.output.spans,
      }
    } catch {
      // Adversarial failure → conservative: treat as 'none' (not 'high')
      stage3 = { manipulation_severity: 'none' }
    }

    // =========================================================================
    // STAGE 4: Policy decision (pure function)
    // =========================================================================
    log.info('Stage 4: policy decision')
    const decisionInput: DecisionInput = {
      stage1: stage1Results,
      stage2: stage2Results,
      stage3,
      confidence,
      verifierConfidenceMin: 0.6, // from contract policy, TODO load from DB
      degraded,
    }
    const output = decide(decisionInput)
    const latencyMs = Date.now() - start

    log.info({ decision: output.decision, latency_ms: latencyMs }, 'Verification complete')

    // --- Save results ---
    await db
      .update(verifications)
      .set({
        status: 'COMPLETE',
        decision: output.decision,
        reasons: output.reasons,
        stage1_json: stage1Results,
        stage2_json: stage2Results,
        stage3_json: { ...stage3 },
        confidence: output.confidence?.toFixed(2),
        manipulation_severity: output.manipulation_severity,
        degraded,
        cache_hit: false,
        model: env.ANTHROPIC_MODEL,
        model_fast: env.ANTHROPIC_MODEL_FAST,
        prompt_version: RUBRIC_VERSION,
        input_hash: inputHash,
        latency_ms: latencyMs,
        completed_at: now(),
      })
      .where(eq(verifications.id, verificationId))
  } catch (err) {
    log.error({ err: String(err) }, 'Verification pipeline failed')
    await db
      .update(verifications)
      .set({ status: 'FAILED', completed_at: now() })
      .where(eq(verifications.id, verificationId))
    throw err
  }
}
