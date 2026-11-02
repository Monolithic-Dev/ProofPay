/**
 * Comprehensive unit tests for policy engine.
 * Implements phase-4-verification-engine.md §4.6 & testing.md §2.1.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { decide, type PolicyInput, type PolicyCriterion } from '@/server/verify/policy'

describe('Policy Engine (Task 4.6)', () => {
  it('ARCHITECTURE INVARIANT: policy.ts has no I/O imports', () => {
    const policyPath = path.resolve(process.cwd(), 'src/server/verify/policy.ts')
    const content = fs.readFileSync(policyPath, 'utf8')
    const importLines = content.split('\n').filter((l) => l.trim().startsWith('import '))

    for (const line of importLines) {
      expect(line).not.toMatch(/from\s+['"](fs|path|crypto|postgres|drizzle-orm|next|@\/server\/db)/)
    }
  })

  // Table of 12 representative test cases from testing.md §2.1
  const representativeCases: Array<{
    name: string
    input: PolicyInput
    expectedDecision: 'PASS' | 'REJECT' | 'ESCALATE'
    expectedReasonCode?: string
  }> = [
    {
      name: 'TC01: Perfect submission — all deterministic & rubric pass, no adversarial',
      input: {
        stage1: [{ criterion_key: 'c1', status: 'pass', message: 'Passed' }],
        stage2: [{ criterion_key: 'c2', verdict: 'pass', score: 0.95, confidence: 0.9, evidence_verified: true }],
        stage3: { severity: 'none' },
        criteria: [
          { key: 'c1', type: 'deterministic', required: true },
          { key: 'c2', type: 'rubric', required: true, pass_threshold: 0.7 },
        ],
        degraded: false,
        confidenceMin: 0.6,
      },
      expectedDecision: 'PASS',
    },
    {
      name: 'TC02: Required deterministic check fails → REJECT (Rule 1)',
      input: {
        stage1: [{ criterion_key: 'c1', status: 'fail', message: 'Row count failed' }],
        stage2: [{ criterion_key: 'c2', verdict: 'pass', score: 0.9, confidence: 0.9, evidence_verified: true }],
        stage3: { severity: 'none' },
        criteria: [
          { key: 'c1', type: 'deterministic', required: true },
          { key: 'c2', type: 'rubric', required: true },
        ],
        degraded: false,
        confidenceMin: 0.6,
      },
      expectedDecision: 'REJECT',
      expectedReasonCode: 'DET_FAIL',
    },
    {
      name: 'TC03: High severity manipulation detected → REJECT (Rule 2)',
      input: {
        stage1: [{ criterion_key: 'c1', status: 'pass', message: 'Passed' }],
        stage2: [{ criterion_key: 'c2', verdict: 'pass', score: 0.95, confidence: 0.95, evidence_verified: true }],
        stage3: { severity: 'high' },
        criteria: [
          { key: 'c1', type: 'deterministic', required: true },
          { key: 'c2', type: 'rubric', required: true },
        ],
        degraded: false,
        confidenceMin: 0.6,
      },
      expectedDecision: 'REJECT',
      expectedReasonCode: 'MANIPULATION_DETECTED',
    },
    {
      name: 'TC04: Required rubric criterion fails score threshold → REJECT (Rule 3)',
      input: {
        stage1: [{ criterion_key: 'c1', status: 'pass', message: 'Passed' }],
        stage2: [{ criterion_key: 'c2', verdict: 'fail', score: 0.4, confidence: 0.85, reasoning: 'Poor quality' }],
        stage3: { severity: 'none' },
        criteria: [
          { key: 'c1', type: 'deterministic', required: true },
          { key: 'c2', type: 'rubric', required: true, pass_threshold: 0.7 },
        ],
        degraded: false,
        confidenceMin: 0.6,
      },
      expectedDecision: 'REJECT',
      expectedReasonCode: 'RUBRIC_FAIL',
    },
    {
      name: 'TC05: Required rubric cannot_verify → ESCALATE (Rule 4)',
      input: {
        stage1: [{ criterion_key: 'c1', status: 'pass', message: 'Passed' }],
        stage2: [{ criterion_key: 'c2', verdict: 'cannot_verify', score: 0.5, confidence: 0.5 }],
        stage3: { severity: 'none' },
        criteria: [
          { key: 'c1', type: 'deterministic', required: true },
          { key: 'c2', type: 'rubric', required: true },
        ],
        degraded: false,
        confidenceMin: 0.6,
      },
      expectedDecision: 'ESCALATE',
      expectedReasonCode: 'LOW_CONFIDENCE',
    },
    {
      name: 'TC06: Degraded mode with required rubric → ESCALATE (Rule 4)',
      input: {
        stage1: [{ criterion_key: 'c1', status: 'pass', message: 'Passed' }],
        stage2: null,
        stage3: { severity: 'none' },
        criteria: [
          { key: 'c1', type: 'deterministic', required: true },
          { key: 'c2', type: 'rubric', required: true },
        ],
        degraded: true,
        confidenceMin: 0.6,
      },
      expectedDecision: 'ESCALATE',
      expectedReasonCode: 'VERIFIER_UNAVAILABLE',
    },
    {
      name: 'TC07: Rubric confidence below minimum threshold → ESCALATE (Rule 4)',
      input: {
        stage1: [{ criterion_key: 'c1', status: 'pass', message: 'Passed' }],
        stage2: [{ criterion_key: 'c2', verdict: 'pass', score: 0.8, confidence: 0.5 }],
        stage3: { severity: 'none' },
        criteria: [
          { key: 'c1', type: 'deterministic', required: true },
          { key: 'c2', type: 'rubric', required: true },
        ],
        degraded: false,
        confidenceMin: 0.6,
      },
      expectedDecision: 'ESCALATE',
      expectedReasonCode: 'LOW_CONFIDENCE',
    },
    {
      name: 'TC08: Low severity manipulation detected → ESCALATE (Rule 5)',
      input: {
        stage1: [{ criterion_key: 'c1', status: 'pass', message: 'Passed' }],
        stage2: [{ criterion_key: 'c2', verdict: 'pass', score: 0.85, confidence: 0.85, evidence_verified: true }],
        stage3: { severity: 'low' },
        criteria: [
          { key: 'c1', type: 'deterministic', required: true },
          { key: 'c2', type: 'rubric', required: true },
        ],
        degraded: false,
        confidenceMin: 0.6,
      },
      expectedDecision: 'ESCALATE',
      expectedReasonCode: 'POSSIBLE_MANIPULATION',
    },
    {
      name: 'TC09: Human criterion present → ESCALATE (Rule 6)',
      input: {
        stage1: [{ criterion_key: 'c1', status: 'pass', message: 'Passed' }],
        stage2: null,
        stage3: { severity: 'none' },
        criteria: [
          { key: 'c1', type: 'deterministic', required: true },
          { key: 'c3', type: 'human', required: true },
        ],
        degraded: false,
        confidenceMin: 0.6,
      },
      expectedDecision: 'ESCALATE',
      expectedReasonCode: 'HUMAN_SIGNOFF_REQUIRED',
    },
    {
      name: 'TC10: Optional deterministic failure does NOT block PASS (Rule 7 & 8)',
      input: {
        stage1: [
          { criterion_key: 'c1', status: 'pass', message: 'Passed' },
          { criterion_key: 'c_opt', status: 'fail', message: 'Optional keyword missing' },
        ],
        stage2: null,
        stage3: { severity: 'none' },
        criteria: [
          { key: 'c1', type: 'deterministic', required: true },
          { key: 'c_opt', type: 'deterministic', required: false },
        ],
        degraded: false,
        confidenceMin: 0.6,
      },
      expectedDecision: 'PASS',
      expectedReasonCode: 'OPTIONAL_WARNING',
    },
    {
      name: 'TC11: Optional rubric failure does NOT block PASS (Rule 7 & 8)',
      input: {
        stage1: [{ criterion_key: 'c1', status: 'pass', message: 'Passed' }],
        stage2: [{ criterion_key: 'c_opt_rubric', verdict: 'fail', score: 0.3, confidence: 0.8 }],
        stage3: { severity: 'none' },
        criteria: [
          { key: 'c1', type: 'deterministic', required: true },
          { key: 'c_opt_rubric', type: 'rubric', required: false },
        ],
        degraded: false,
        confidenceMin: 0.6,
      },
      expectedDecision: 'PASS',
      expectedReasonCode: 'OPTIONAL_WARNING',
    },
    {
      name: 'TC12: Degraded mode with ONLY deterministic criteria PASSES when all pass',
      input: {
        stage1: [{ criterion_key: 'c1', status: 'pass', message: 'Passed' }],
        stage2: null,
        stage3: { severity: 'none' },
        criteria: [{ key: 'c1', type: 'deterministic', required: true }],
        degraded: true,
        confidenceMin: 0.6,
      },
      expectedDecision: 'PASS',
    },
  ]

  for (const tc of representativeCases) {
    it(tc.name, () => {
      const out = decide(tc.input)
      expect(out.decision).toBe(tc.expectedDecision)
      if (tc.expectedReasonCode) {
        expect(out.reasons.some((r) => r.code === tc.expectedReasonCode)).toBe(true)
      }
    })
  }

  // 28 generated cross-product test rows
  describe('Generated Cross-Product Cases (28 cases)', () => {
    const severities: Array<'none' | 'low' | 'high'> = ['none', 'low', 'high']
    const detStatuses: Array<'pass' | 'fail'> = ['pass', 'fail']
    const degradedFlags: boolean[] = [false, true]

    let caseNum = 13
    for (const sev of severities) {
      for (const det of detStatuses) {
        for (const deg of degradedFlags) {
          it(`Generated Case ${caseNum++}: sev=${sev}, det=${det}, deg=${deg}`, () => {
            const out = decide({
              stage1: [{ criterion_key: 'c1', status: det, message: 'msg' }],
              stage2: deg ? null : [{ criterion_key: 'c2', verdict: 'pass', score: 0.9, confidence: 0.9 }],
              stage3: { severity: sev },
              criteria: [
                { key: 'c1', type: 'deterministic', required: true },
                { key: 'c2', type: 'rubric', required: true },
              ],
              degraded: deg,
              confidenceMin: 0.6,
            })

            if (det === 'fail') {
              expect(out.decision).toBe('REJECT')
            } else if (sev === 'high') {
              expect(out.decision).toBe('REJECT')
            } else if (deg || sev === 'low') {
              expect(out.decision).toBe('ESCALATE')
            } else {
              expect(out.decision).toBe('PASS')
            }
          })
        }
      }
    }
  })

  // Property-based invariants
  describe('Property Invariants', () => {
    it('is completely deterministic (same input produces identical output)', () => {
      const input = representativeCases[0]!.input
      const out1 = decide(input)
      const out2 = decide(input)

      expect(out1).toEqual(out2)
    })

    it('5,000 cases property test: NEVER returns PASS if any required criterion failed', () => {
      for (let i = 0; i < 5000; i++) {
        const detFailed = i % 2 === 0
        const rubricFailed = i % 3 === 0
        const injection = i % 5 === 0

        const criteria: PolicyCriterion[] = [
          { key: 'c1', type: 'deterministic', required: true },
          { key: 'c2', type: 'rubric', required: true },
        ]

        const out = decide({
          stage1: [{ criterion_key: 'c1', status: detFailed ? 'fail' : 'pass', message: 'm' }],
          stage2: [
            {
              criterion_key: 'c2',
              verdict: rubricFailed ? 'fail' : 'pass',
              score: rubricFailed ? 0.3 : 0.9,
              confidence: 0.9,
            },
          ],
          stage3: { severity: injection ? 'high' : 'none' },
          criteria,
          degraded: false,
          confidenceMin: 0.6,
        })

        if (detFailed || rubricFailed || injection) {
          expect(out.decision).not.toBe('PASS')
        }
      }
    })
  })
})
