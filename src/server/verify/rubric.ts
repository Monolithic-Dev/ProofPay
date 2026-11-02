/**
 * Rubric verifier stage — Stage 2 of the ProofPay verification pipeline.
 * Evaluates semantic acceptance criteria with forced tool choice and evidence substring verification.
 * Implements phase-4-verification-engine.md §4.4 & ai-pipeline.md §3 Stage 2.
 */
import { randomBytes } from 'crypto'
import { callTool } from '@/server/ai/llm'
import { env } from '@/server/config/env'
import { buildRubricPrompt, PROMPT_VERSION } from '@/server/ai/prompts/rubric.v1'
import { verifyQuote } from './evidence'
import type { ParsedArtifact } from './artifact'

export const MAX_RUBRIC_CHARS = 60_000

export const rubricTool = {
  name: 'report_rubric',
  description: 'Report rubric criteria evaluation results with verbatim evidence quotes.',
  input_schema: {
    type: 'object',
    required: ['results'],
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          required: ['criterion_key', 'verdict', 'score', 'confidence', 'evidence', 'reasoning'],
          properties: {
            criterion_key: { type: 'string' },
            verdict: { type: 'string', enum: ['pass', 'fail', 'cannot_verify'] },
            score: { type: 'number', minimum: 0, maximum: 1 },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            evidence: {
              type: 'array',
              maxItems: 3,
              items: {
                type: 'object',
                required: ['quote'],
                properties: {
                  quote: { type: 'string', maxLength: 200 },
                  hint: { type: 'string', maxLength: 80 },
                },
              },
            },
            reasoning: { type: 'string', maxLength: 300 },
          },
        },
      },
    },
  },
}

export interface RubricCriterionInput {
  key: string
  statement: string
  pass_threshold?: number
  context_milestones?: string[]
}

export interface RubricEvidenceQuote {
  quote: string
  hint?: string
}

export interface ProcessedRubricResult {
  criterion_key: string
  verdict: 'pass' | 'fail' | 'cannot_verify'
  score: number
  confidence: number
  evidence: RubricEvidenceQuote[]
  evidence_verified: boolean
  reasoning: string
}

export interface RubricStageOutput {
  results: ProcessedRubricResult[]
  truncated: boolean
  unavailable: boolean
  model?: string
  prompt_version?: string
  raw_quote_hallucination_rate?: number
}

export async function runRubricStage(params: {
  contractId: string
  criteria: RubricCriterionInput[]
  artifact: ParsedArtifact
  contextArtifacts?: Record<string, string>
}): Promise<RubricStageOutput> {
  const { contractId, criteria, artifact, contextArtifacts } = params

  if (!criteria || criteria.length === 0) {
    return {
      results: [],
      truncated: false,
      unavailable: false,
      prompt_version: PROMPT_VERSION,
    }
  }

  // 1. Truncate artifact to 60,000 chars if necessary
  let textToSend = artifact.text
  let truncated = false
  if (textToSend.length > MAX_RUBRIC_CHARS) {
    textToSend = textToSend.slice(0, MAX_RUBRIC_CHARS) + '\n[TRUNCATED]\n'
    truncated = true
  }

  // 2. Generate nonce and user prompt
  const nonce = randomBytes(6).toString('hex')
  const { system, user } = buildRubricPrompt({
    criteria,
    contextArtifacts,
    artifactText: textToSend,
    contentType: artifact.rows ? 'json_records' : 'text',
    nonce,
  })

  // 3. Call LLM with forced tool choice
  let rawResults: any[] = []
  const model = env.ANTHROPIC_MODEL

  try {
    const res = await callTool<{ results: any[] }>({
      purpose: 'verify_rubric',
      model,
      system,
      user,
      tool: rubricTool,
      contractId,
      temperature: 0,
    })
    rawResults = Array.isArray(res.data?.results) ? res.data.results : []
  } catch {
    // If budget exhausted or upstream LLM unavailable, return unavailable flag
    return {
      results: [],
      truncated,
      unavailable: true,
      prompt_version: PROMPT_VERSION,
    }
  }

  // 4. Post-process each result with strict code invariants
  let totalQuotes = 0
  let unverifiedQuotes = 0
  const processedResults: ProcessedRubricResult[] = []

  const critThresholdMap = new Map<string, number>()
  for (const c of criteria) {
    critThresholdMap.set(c.key, c.pass_threshold ?? 0.7)
  }

  for (const r of rawResults) {
    const key = String(r.criterion_key)
    const threshold = critThresholdMap.get(key) ?? 0.7
    const evidenceList: RubricEvidenceQuote[] = Array.isArray(r.evidence) ? r.evidence : []

    let anyQuoteVerified = false
    let hasQuotes = false

    for (const ev of evidenceList) {
      if (typeof ev?.quote === 'string') {
        hasQuotes = true
        totalQuotes++
        const isVerbatim = verifyQuote(artifact.text, ev.quote)
        if (isVerbatim) {
          anyQuoteVerified = true
        } else {
          unverifiedQuotes++
        }
      }
    }

    let finalVerdict: 'pass' | 'fail' | 'cannot_verify' = r.verdict ?? 'cannot_verify'
    const score = typeof r.score === 'number' ? Math.max(0, Math.min(1, r.score)) : 0
    const confidence = typeof r.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : 0

    // INVARIANT 1: pass requires score >= pass_threshold
    if (finalVerdict === 'pass' && score < threshold) {
      finalVerdict = 'fail'
    }

    // INVARIANT 2: pass requires at least one verified verbatim quote
    if (finalVerdict === 'pass' && (!hasQuotes || !anyQuoteVerified)) {
      finalVerdict = 'cannot_verify'
    }

    // INVARIANT 3: if artifact was truncated, cap verdict at cannot_verify if evidence unverified
    if (truncated && finalVerdict === 'pass' && !anyQuoteVerified) {
      finalVerdict = 'cannot_verify'
    }

    processedResults.push({
      criterion_key: key,
      verdict: finalVerdict,
      score,
      confidence,
      evidence: evidenceList,
      evidence_verified: anyQuoteVerified,
      reasoning: String(r.reasoning ?? '').slice(0, 300),
    })
  }

  const hallucinationRate =
    totalQuotes > 0 ? Number((unverifiedQuotes / totalQuotes).toFixed(4)) : 0

  return {
    results: processedResults,
    truncated,
    unavailable: false,
    model,
    prompt_version: PROMPT_VERSION,
    raw_quote_hallucination_rate: hallucinationRate,
  }
}
