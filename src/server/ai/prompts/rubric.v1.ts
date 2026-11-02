/**
 * Rubric verification prompt — Stage 2 of the verification pipeline.
 * Uses forced tool-use with temperature=0 for deterministic scoring.
 */

export const PROMPT_VERSION = 'rubric.v1'

export const RUBRIC_SYSTEM_PROMPT = `You are a precise, evidence-based artifact verifier for ProofPay.
Your job is to evaluate whether a submitted artifact meets each rubric criterion.

Critical rules:
1. For each criterion, find a VERBATIM quote from the artifact that supports your score.
2. The quote must be an EXACT substring of the artifact (whitespace may vary slightly but content must match).
3. Score from 0.0 to 1.0. Be strict — 0.7 means the criterion is reasonably met, 1.0 means perfectly met.
4. Never invent evidence. If you cannot find supporting text, score 0.0 and say "No evidence found."
5. Temperature is 0 — be consistent and deterministic.
6. You are evaluating DELIVERABLE QUALITY, not the submitter's effort.`

export function buildRubricUserMessage(params: {
  artifactContentType: 'json_records' | 'text'
  artifactContent: string
  criteria: Array<{
    key: string
    statement: string
    pass_threshold: number
    context?: string  // prior milestone artifact content (if context_milestones set)
  }>
}): string {
  const { artifactContentType, artifactContent, criteria } = params
  const criteriaText = criteria
    .map((c) => `Criterion ${c.key}: "${c.statement}" (pass threshold: ${c.pass_threshold})\n${c.context ? `Context from prior milestone:\n${c.context.slice(0, 2000)}\n` : ''}`)
    .join('\n')

  return `ARTIFACT (${artifactContentType}):\n\`\`\`\n${artifactContent.slice(0, 8000)}\n\`\`\`\n\nCRITERIA TO EVALUATE:\n${criteriaText}`
}

export const RUBRIC_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          criterion_key: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 1 },
          evidence: { type: 'string', description: 'Verbatim quote from artifact supporting the score' },
          reason: { type: 'string' },
        },
        required: ['criterion_key', 'score', 'evidence', 'reason'],
      },
    },
    overall_confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Overall confidence in this evaluation (0=very uncertain, 1=very certain)',
    },
  },
  required: ['results', 'overall_confidence'],
}
