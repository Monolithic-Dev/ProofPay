import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { runDeterministicLint } from '@/server/contracts/lint/rules'

const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/demo-contract.json')
const demoContract = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

describe('Deterministic Contract Lint Rules Engine', () => {
  it('flags sum mismatch and offers JSON patch fix', () => {
    const broken = {
      ...demoContract,
      total_minor: 12000, // sum is 10000
    }

    const issues = runDeterministicLint(broken)
    const sumIssue = issues.find((i) => i.code === 'LINT_SUM_MISMATCH')

    expect(sumIssue).toBeDefined()
    expect(sumIssue?.severity).toBe('error')
    expect(sumIssue?.fix).toBeDefined()

    const fixPatch = JSON.parse(sumIssue!.fix!)
    expect(fixPatch).toEqual([{ op: 'replace', path: '/total_minor', value: 10000 }])
  })

  it('flags duration over 28 days and offers fix to cap at 28 days', () => {
    const broken = {
      ...demoContract,
      milestones: [
        { ...demoContract.milestones[0], due_in_days: 35 },
        demoContract.milestones[1],
      ],
    }

    const issues = runDeterministicLint(broken)
    const durationIssue = issues.find((i) => i.code === 'LINT_DURATION')

    expect(durationIssue).toBeDefined()
    expect(durationIssue?.severity).toBe('error')
    expect(durationIssue?.fix).toBeDefined()

    const fixPatch = JSON.parse(durationIssue!.fix!)
    expect(fixPatch).toEqual([{ op: 'replace', path: '/milestones/0/due_in_days', value: 28 }])
  })

  it('flags "high quality" in a rubric statement as an error', () => {
    const broken = {
      ...demoContract,
      milestones: [
        {
          ...demoContract.milestones[0],
          criteria: [
            {
              key: 'c1',
              type: 'rubric',
              required: true,
              statement: 'The output must be of high quality and look nice.',
            },
          ],
        },
        demoContract.milestones[1],
      ],
    }

    const issues = runDeterministicLint(broken)
    const vagueIssues = issues.filter((i) => i.code === 'LINT_VAGUE_TERM' && i.severity === 'error')

    expect(vagueIssues.length).toBeGreaterThanOrEqual(2) // high quality, nice
  })

  it('does not flag vague words outside criteria as errors (summary is warn only)', () => {
    const contractWithVagueSummary = {
      ...demoContract,
      summary: 'A very nice and good summary.',
    }

    const issues = runDeterministicLint(contractWithVagueSummary)
    const summaryIssues = issues.filter((i) => i.path === '/summary')

    expect(summaryIssues.every((i) => i.severity === 'warn')).toBe(true)
  })

  it('reports info issue for human review criterion', () => {
    const contractWithHuman = {
      ...demoContract,
      milestones: [
        {
          ...demoContract.milestones[0],
          criteria: [
            ...demoContract.milestones[0].criteria,
            {
              key: 'c9',
              type: 'human',
              required: true,
              statement: 'Buyer manual sign-off',
            },
          ],
        },
        demoContract.milestones[1],
      ],
    }

    const issues = runDeterministicLint(contractWithHuman)
    const humanIssue = issues.find((i) => i.code === 'LINT_HUMAN_BLOCKS_AUTORELEASE')

    expect(humanIssue).toBeDefined()
    expect(humanIssue?.severity).toBe('info')
  })

  it('clean demo contract has zero error lint issues', () => {
    const issues = runDeterministicLint(demoContract)
    const errors = issues.filter((i) => i.severity === 'error')
    expect(errors).toHaveLength(0)
  })
})
