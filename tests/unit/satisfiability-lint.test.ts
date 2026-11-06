import { describe, it, expect } from 'vitest'
import { runDeterministicLint } from '@/server/contracts/lint/rules'

describe('AIP-11 Satisfiability Linter (src/server/contracts/lint/rules.ts)', () => {
  it('flags LINT_UNSATISFIABLE_RANGE when min > max for row_count', () => {
    const contract = {
      total_minor: 1000,
      milestones: [
        {
          amount_minor: 1000,
          due_in_days: 7,
          deliverable: { description: 'Scraped data' },
          criteria: [
            {
              type: 'deterministic',
              check: 'row_count',
              required: true,
              statement: 'Minimum 50 rows and maximum 20 rows',
              spec: { min: 50, max: 20 },
            },
          ],
        },
      ],
    }

    const issues = runDeterministicLint(contract)
    const rangeIssue = issues.find((i) => i.code === 'LINT_UNSATISFIABLE_RANGE')
    expect(rangeIssue).toBeDefined()
    expect(rangeIssue?.severity).toBe('error')
    expect(rangeIssue?.message).toContain('min (50) cannot be greater than max (20)')
  })

  it('flags LINT_SCHEMA_COUNT_CONFLICT when schema minItems exceeds row_count max', () => {
    const contract = {
      total_minor: 1000,
      milestones: [
        {
          amount_minor: 1000,
          due_in_days: 7,
          deliverable: { description: 'User JSON' },
          criteria: [
            {
              type: 'deterministic',
              check: 'row_count',
              required: true,
              statement: 'Max 10 rows',
              spec: { max: 10 },
            },
            {
              type: 'deterministic',
              check: 'json_schema',
              required: true,
              statement: 'Must have at least 15 items',
              spec: {
                schema: { minItems: 15 },
              },
            },
          ],
        },
      ],
    }

    const issues = runDeterministicLint(contract)
    const conflict = issues.find((i) => i.code === 'LINT_SCHEMA_COUNT_CONFLICT')
    expect(conflict).toBeDefined()
    expect(conflict?.severity).toBe('error')
  })

  it('flags LINT_UNIQUE_CARDINALITY when unique enum values are fewer than row_count.min', () => {
    const contract = {
      total_minor: 1000,
      milestones: [
        {
          amount_minor: 1000,
          due_in_days: 7,
          deliverable: { description: 'Products' },
          criteria: [
            {
              type: 'deterministic',
              check: 'row_count',
              required: true,
              statement: 'At least 10 rows',
              spec: { min: 10 },
            },
            {
              type: 'deterministic',
              check: 'unique_field',
              required: true,
              statement: 'Category must be unique',
              spec: { field: 'category' },
            },
            {
              type: 'deterministic',
              check: 'json_schema',
              required: true,
              statement: 'JSON schema with 3 categories',
              spec: {
                schema: {
                  items: {
                    properties: {
                      category: { enum: ['tech', 'fashion', 'books'] },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    }

    const issues = runDeterministicLint(contract)
    const cardIssue = issues.find((i) => i.code === 'LINT_UNIQUE_CARDINALITY')
    expect(cardIssue).toBeDefined()
    expect(cardIssue?.message).toContain('only 3 enum values but row_count requires at least 10 rows')
  })

  it('accepts junk_free as a valid deterministic check', () => {
    const contract = {
      total_minor: 1000,
      milestones: [
        {
          amount_minor: 1000,
          due_in_days: 7,
          deliverable: { description: 'Articles' },
          criteria: [
            {
              type: 'deterministic',
              check: 'junk_free',
              required: true,
              statement: 'No placeholder text',
              spec: { max_placeholder_ratio: 0.05 },
            },
          ],
        },
      ],
    }

    const issues = runDeterministicLint(contract)
    expect(issues.some((i) => i.code === 'LINT_UNKNOWN_CHECK')).toBe(false)
  })
})

