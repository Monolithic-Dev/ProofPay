/**
 * Anthropic tool schemas for contract compilation and linting.
 * Implements phase-3-auth-and-contracts.md §3.6.
 */

export const contractTool = {
  name: 'compile_contract',
  description: 'Compile a natural language job description into a structured ProofPay contract.',
  input_schema: {
    type: 'object',
    required: ['schema_version', 'title', 'summary', 'currency', 'total_minor', 'milestones'],
    properties: {
      schema_version: { type: 'integer', enum: [1] },
      title: { type: 'string', minLength: 5, maxLength: 120 },
      summary: { type: 'string', maxLength: 500 },
      currency: { type: 'string', enum: ['USD'] },
      total_minor: { type: 'integer', minimum: 1, maximum: 50000 },
      milestones: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: {
          type: 'object',
          required: ['key', 'title', 'amount_minor', 'due_in_days', 'deliverable', 'criteria'],
          properties: {
            key: { type: 'string', pattern: '^m[1-5]$' },
            title: { type: 'string', minLength: 1, maxLength: 120 },
            amount_minor: { type: 'integer', minimum: 1 },
            due_in_days: { type: 'integer', minimum: 1, maximum: 28 },
            deliverable: {
              type: 'object',
              required: ['content_type', 'max_bytes', 'description'],
              properties: {
                content_type: { type: 'string', enum: ['json_records', 'text'] },
                max_bytes: { type: 'integer', maximum: 1048576 },
                description: { type: 'string', maxLength: 300 },
              },
            },
            criteria: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['key', 'type', 'required'],
                properties: {
                  key: { type: 'string', pattern: '^c[1-9]\\d*$' },
                  type: { type: 'string', enum: ['deterministic', 'rubric', 'human'] },
                  required: { type: 'boolean' },
                  description: { type: 'string', maxLength: 300 },
                  check: {
                    type: 'string',
                    enum: [
                      'json_schema',
                      'row_count',
                      'unique_field',
                      'regex_field',
                      'word_count',
                      'required_keywords',
                      'junk_detector',
                      'csv_schema',
                      'forbidden_terms',
                      'link_check',
                    ],
                  },
                  spec: { type: 'object' },
                  statement: { type: 'string', maxLength: 300 },
                  pass_threshold: { type: 'number', minimum: 0.5, maximum: 1.0 },
                  context_milestones: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      policy: {
        type: 'object',
        properties: {
          max_revisions: { type: 'integer', minimum: 0, maximum: 3 },
          auto_release_hours: { type: 'integer', minimum: 1, maximum: 168 },
          on_final_failure: { type: 'string', enum: ['void_remaining'] },
          verifier_confidence_min: { type: 'number', minimum: 0.5, maximum: 0.95 },
        },
      },
    },
  },
}

export const lintTool = {
  name: 'provide_lint_review',
  description: 'Provide lint review issues and suggested fixes for a draft contract.',
  input_schema: {
    type: 'object',
    required: ['issues'],
    properties: {
      issues: {
        type: 'array',
        items: {
          type: 'object',
          required: ['code', 'severity', 'path', 'message'],
          properties: {
            code: { type: 'string' },
            severity: { type: 'string', enum: ['error', 'warn', 'info'] },
            path: { type: 'string' },
            message: { type: 'string' },
            suggested_fix: {
              type: 'object',
              description: 'JSON Patch operations to resolve the issue',
              properties: {
                patch: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['op', 'path'],
                    properties: {
                      op: { type: 'string', enum: ['add', 'remove', 'replace', 'move', 'copy', 'test'] },
                      path: { type: 'string' },
                      value: {},
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}
