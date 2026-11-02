import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ContractSchema, parseContract } from '@/server/contracts/schema'

const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/demo-contract.json')
const demoContract = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

describe('ContractSchema validation (≥15 named tests)', () => {
  it('1. accepts the demo contract fixture', () => {
    const parsed = ContractSchema.safeParse(demoContract)
    expect(parsed.success).toBe(true)
  })

  it('2. rejects 6 milestones (max 5)', () => {
    const invalid = {
      ...demoContract,
      milestones: [
        ...demoContract.milestones,
        { ...demoContract.milestones[0], key: 'm3' },
        { ...demoContract.milestones[0], key: 'm4' },
        { ...demoContract.milestones[0], key: 'm5' },
        { ...demoContract.milestones[0], key: 'm6' },
      ],
    }
    const parsed = ContractSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('3. rejects sum mismatch between total_minor and milestone amounts', () => {
    const invalid = {
      ...demoContract,
      total_minor: 9999, // sum is 10000
    }
    const parsed = ContractSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('4. rejects total over $500.00 (50,000 minor units)', () => {
    const invalid = {
      ...demoContract,
      total_minor: 50001,
    }
    const parsed = ContractSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('5. rejects due_in_days 29 (max 28 days)', () => {
    const invalid = {
      ...demoContract,
      milestones: [
        { ...demoContract.milestones[0], due_in_days: 29 },
        demoContract.milestones[1],
      ],
    }
    const parsed = ContractSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('6. rejects unknown check name', () => {
    const invalid = {
      ...demoContract,
      milestones: [
        {
          ...demoContract.milestones[0],
          criteria: [
            {
              key: 'c1',
              type: 'deterministic',
              required: true,
              description: 'Check',
              check: 'unknown_unsupported_check',
              spec: {},
            },
          ],
        },
      ],
    }
    const parsed = ContractSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('7. rejects regex_field with a custom pattern (only email|url|sku allowed)', () => {
    const invalid = {
      ...demoContract,
      milestones: [
        {
          ...demoContract.milestones[0],
          criteria: [
            {
              key: 'c1',
              type: 'deterministic',
              required: true,
              description: 'Check',
              check: 'regex_field',
              spec: { field: 'test', pattern: 'custom_regex_injection' },
            },
          ],
        },
      ],
    }
    const parsed = ContractSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('8. rejects context_milestones pointing forward or to self', () => {
    // m1 referencing m2 (forward reference)
    const invalid = {
      ...demoContract,
      milestones: [
        {
          ...demoContract.milestones[0],
          criteria: [
            {
              key: 'c1',
              type: 'rubric',
              required: true,
              statement: 'Compare to future',
              context_milestones: ['m2'],
            },
          ],
        },
        demoContract.milestones[1],
      ],
    }
    const parsed = ContractSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('9. rejects duplicate criterion keys in the same milestone', () => {
    const invalid = {
      ...demoContract,
      milestones: [
        {
          ...demoContract.milestones[0],
          criteria: [
            demoContract.milestones[0].criteria[0],
            { ...demoContract.milestones[0].criteria[0] }, // duplicate key c1
          ],
        },
      ],
    }
    const parsed = ContractSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('10. rejects milestone with no required criterion', () => {
    const invalid = {
      ...demoContract,
      milestones: [
        {
          ...demoContract.milestones[0],
          criteria: [
            {
              key: 'c1',
              type: 'rubric',
              required: false, // only 1 criterion and it's optional
              statement: 'Optional statement',
            },
          ],
        },
        demoContract.milestones[1],
      ],
    }
    const parsed = ContractSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('11. rejects rubric statement over 300 chars', () => {
    const invalid = {
      ...demoContract,
      milestones: [
        {
          ...demoContract.milestones[0],
          criteria: [
            {
              key: 'c1',
              type: 'rubric',
              required: true,
              statement: 'A'.repeat(301),
            },
          ],
        },
      ],
    }
    const parsed = ContractSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('12. applies default policy when policy is omitted', () => {
    const withoutPolicy = { ...demoContract }
    delete withoutPolicy.policy

    const parsed = parseContract(withoutPolicy)
    expect(parsed.policy.max_revisions).toBe(2)
    expect(parsed.policy.auto_release_hours).toBe(48)
    expect(parsed.policy.on_final_failure).toBe('void_remaining')
  })

  it('13. rejects human criterion with required=false', () => {
    const invalid = {
      ...demoContract,
      milestones: [
        {
          ...demoContract.milestones[0],
          criteria: [
            {
              key: 'c1',
              type: 'human',
              required: false,
              statement: 'Human review',
            },
          ],
        },
      ],
    }
    const parsed = ContractSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('14. rejects negative milestone amount', () => {
    const invalid = {
      ...demoContract,
      milestones: [
        { ...demoContract.milestones[0], amount_minor: -100 },
        demoContract.milestones[1],
      ],
    }
    const parsed = ContractSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })

  it('15. rejects currency EUR (only USD supported)', () => {
    const invalid = {
      ...demoContract,
      currency: 'EUR',
    }
    const parsed = ContractSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })
})
