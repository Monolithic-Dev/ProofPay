/**
 * Contract compilation prompt — converts natural language into a structured Contract JSON.
 */

export const PROMPT_VERSION = 'compile.v1'

export const COMPILE_SYSTEM_PROMPT = `You are a contract compiler for ProofPay, a milestone payment verification platform.
Your job is to convert a natural language description of a work contract into a precise, machine-verifiable Contract JSON.

Rules:
1. Every milestone MUST have at least one deterministic criterion (json_schema, row_count, unique_field, regex_field, word_count, or required_keywords).
2. Total payment amount is specified in USD cents (minor units). E.g., $100 = 10000 minor units.
3. Milestone keys must be m1, m2, m3, m4, or m5 (max 5 milestones).
4. Criterion keys must be c1, c2, c3, etc. (unique per milestone).
5. due_in_days is relative to when the contract is funded (1-28 days).
6. If you detect ambiguity, use the "issues" field to flag it.
7. All rubric statements must be ≤ 300 characters.
8. The total_minor MUST equal the exact sum of all milestone amount_minor values.

Output the contract using the provided tool.`

export const COMPILE_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    contract: {
      type: 'object',
      description: 'The compiled ProofPay contract',
      properties: {
        schema_version: { type: 'number', enum: [1] },
        title: { type: 'string', minLength: 5, maxLength: 120 },
        summary: { type: 'string', maxLength: 500 },
        currency: { type: 'string', enum: ['USD'] },
        total_minor: { type: 'number', minimum: 1, maximum: 50000 },
        milestones: {
          type: 'array',
          minItems: 1,
          maxItems: 5,
          items: { type: 'object' },
        },
        policy: { type: 'object' },
      },
      required: ['schema_version', 'title', 'summary', 'currency', 'total_minor', 'milestones', 'policy'],
    },
    issues: {
      type: 'array',
      description: 'Ambiguities or potential problems found in the input',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['error', 'warn', 'info'] },
          path: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['severity', 'path', 'message'],
      },
    },
  },
  required: ['contract', 'issues'],
}
