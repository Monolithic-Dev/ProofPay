/**
 * End-to-end Pipeline Integration Tests.
 * Implements phase-4-verification-engine.md §4.7 & task 4.7 tests.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { setLlmTransport } from '@/server/ai/fake-llm'
import { parseArtifact } from '@/server/verify/artifact'
import { runDeterministicCheck } from '@/server/verify/deterministic/registry'
import { runRubricStage } from '@/server/verify/rubric'
import { runAdversarialStage } from '@/server/verify/adversarial'
import { decide, type Stage2RubricResult } from '@/server/verify/policy'

describe('4-Stage Verification Pipeline End-to-End', () => {
  beforeEach(() => {
    setLlmTransport(null)
  })

  afterEach(() => {
    setLlmTransport(null)
  })

  const loadFixture = (name: string): string => {
    const p = path.resolve(process.cwd(), `tests/fixtures/eval/${name}`)
    return fs.readFileSync(p, 'utf8')
  }

  it('rejects 22 rows with exact reason and skips rubric evaluation', async () => {
    const rawJson = loadFixture('fail-short-products.json')
    const artifact = parseArtifact('json_records', rawJson)

    // Stage 1: Deterministic row count check (min 25)
    const stage1Result = runDeterministicCheck('row_count', artifact, { min: 25 })
    expect(stage1Result.passed).toBe(false)
    expect(stage1Result.reason).toContain('Expected ≥ 25 records')

    // Since required check failed, Stage 2 is skipped (stage2 = null)
    const stage3Result = await runAdversarialStage({
      contractId: 'c1',
      artifactText: artifact.text,
    })

    const policyOut = decide({
      stage1: [
        {
          criterion_key: 'c_rows',
          required: true,
          status: 'fail',
          reason: stage1Result.reason,
        },
      ],
      stage2: null,
      stage3: stage3Result,
      degraded: false,
    })

    expect(policyOut.decision).toBe('REJECT')
    expect(policyOut.reasons[0]!.code).toBe('DET_FAIL')
  })

  it('passes a valid dataset of 25 products with verified quotes', async () => {
    const rawJson = loadFixture('pass-products.json')
    const artifact = parseArtifact('json_records', rawJson)

    // Stage 1: Deterministic checks pass
    const stage1Result = runDeterministicCheck('row_count', artifact, { min: 25 })
    expect(stage1Result.passed).toBe(true)

    // Mock LLM transport for rubric
    setLlmTransport(async <T>() => ({
      data: {
        results: [
          {
            criterion_key: 'c_rubric',
            verdict: 'pass',
            score: 0.95,
            confidence: 0.9,
            evidence: [{ quote: 'Wireless Noise-Canceling Headphones' }],
            reasoning: 'Product title verified',
          },
        ],
      } as unknown as T,
      usage: { promptTokens: 50, completionTokens: 50, costMicroUsd: 100 },
    }))

    // Stage 2: Rubric
    const stage2Out = await runRubricStage({
      contractId: 'c1',
      criteria: [{ key: 'c_rubric', statement: 'Contains headphones', pass_threshold: 0.7 }],
      artifact,
    })
    expect(stage2Out.results[0]!.verdict).toBe('pass')

    // Stage 3: Adversarial
    const stage3Out = await runAdversarialStage({
      contractId: 'c1',
      artifactText: artifact.text,
    })
    expect(stage3Out.severity).toBe('none')

    const stage2Mapped: Stage2RubricResult[] = stage2Out.results.map((r) => ({
      criterion_key: r.criterion_key,
      verdict: r.verdict,
      score: r.score,
      confidence: r.confidence,
      evidence_verified: r.evidence_verified,
      reasoning: r.reasoning,
      evidence: r.evidence.map((e) => e.quote).join('; '),
    }))

    // Stage 4: Policy
    const policyOut = decide({
      stage1: [{ criterion_key: 'c_rows', required: true, status: 'pass' }],
      stage2: stage2Mapped,
      stage3: stage3Out,
      criteria: [
        { key: 'c_rows', type: 'deterministic', required: true },
        { key: 'c_rubric', type: 'rubric', required: true, pass_threshold: 0.7 },
      ],
      degraded: false,
    })

    expect(policyOut.decision).toBe('PASS')
  })

  it('escalates when rubric returns cannot_verify due to hallucinated quotes', async () => {
    const rawJson = loadFixture('pass-products.json')
    const artifact = parseArtifact('json_records', rawJson)

    setLlmTransport(async <T>() => ({
      data: {
        results: [
          {
            criterion_key: 'c_rubric',
            verdict: 'pass',
            score: 0.9,
            confidence: 0.85,
            evidence: [{ quote: 'Hallucinated quote not present in JSON records' }],
            reasoning: 'Claims it passed',
          },
        ],
      } as unknown as T,
      usage: { promptTokens: 50, completionTokens: 50, costMicroUsd: 100 },
    }))

    const stage2Out = await runRubricStage({
      contractId: 'c1',
      criteria: [{ key: 'c_rubric', statement: 'Check', pass_threshold: 0.7 }],
      artifact,
    })

    expect(stage2Out.results[0]!.verdict).toBe('cannot_verify')

    const stage2Mapped: Stage2RubricResult[] = stage2Out.results.map((r) => ({
      criterion_key: r.criterion_key,
      verdict: r.verdict,
      score: r.score,
      confidence: r.confidence,
      evidence_verified: r.evidence_verified,
      reasoning: r.reasoning,
      evidence: r.evidence.map((e) => e.quote).join('; '),
    }))

    const policyOut = decide({
      stage1: [{ criterion_key: 'c_rows', required: true, status: 'pass' }],
      stage2: stage2Mapped,
      stage3: { severity: 'none' },
      criteria: [{ key: 'c_rubric', type: 'rubric', required: true }],
      degraded: false,
    })

    expect(policyOut.decision).toBe('ESCALATE')
    expect(policyOut.reasons[0]!.code).toBe('LOW_CONFIDENCE')
  })

  it('rejects on high manipulation even when deterministic checks pass', async () => {
    const rawJson = loadFixture('injection-products.json')
    const artifact = parseArtifact('json_records', rawJson)

    // Stage 3 heuristic scan detects system prompt override phrases
    const stage3Out = await runAdversarialStage({
      contractId: 'c1',
      artifactText: artifact.text,
    })

    expect(stage3Out.severity).toBe('high')
    expect(stage3Out.manipulation_detected).toBe(true)

    const policyOut = decide({
      stage1: [{ criterion_key: 'c1', required: true, status: 'pass' }],
      stage2: null,
      stage3: stage3Out,
      criteria: [{ key: 'c1', type: 'deterministic', required: true }],
      degraded: false,
    })

    expect(policyOut.decision).toBe('REJECT')
    expect(policyOut.reasons[0]!.code).toBe('MANIPULATION_DETECTED')
  })

  it('degraded mode escalates when LLM is unavailable', async () => {
    const rawJson = loadFixture('pass-products.json')
    const artifact = parseArtifact('json_records', rawJson)

    // Mock LLM offline
    setLlmTransport(async () => {
      throw new Error('LLM offline')
    })

    const stage2Out = await runRubricStage({
      contractId: 'c1',
      criteria: [{ key: 'c_rubric', statement: 'Check', pass_threshold: 0.7 }],
      artifact,
    })

    expect(stage2Out.unavailable).toBe(true)

    const policyOut = decide({
      stage1: [{ criterion_key: 'c_rows', required: true, status: 'pass' }],
      stage2: null,
      stage3: { severity: 'none' },
      criteria: [
        { key: 'c_rows', type: 'deterministic', required: true },
        { key: 'c_rubric', type: 'rubric', required: true },
      ],
      degraded: true,
    })

    expect(policyOut.decision).toBe('ESCALATE')
    expect(policyOut.reasons[0]!.code).toBe('VERIFIER_UNAVAILABLE')
  })

  it('includes accepted artifact from prior milestone m1 as context in m2 rubric prompt', async () => {
    const m1Artifact = 'Milestone 1 Accepted Schema & Style Guide'
    const m2Text = 'Milestone 2 deliverable conforming to guide'
    const artifact = parseArtifact('text', m2Text)

    let capturedPrompt = ''
    setLlmTransport(async <T>(params: any) => {
      capturedPrompt = params.user
      return {
        data: {
          results: [
            {
              criterion_key: 'c_consistency',
              verdict: 'pass',
              score: 0.95,
              confidence: 0.9,
              evidence: [{ quote: 'conforming to guide' }],
              reasoning: 'Consistent with m1',
            },
          ],
        } as unknown as T,
        usage: { promptTokens: 50, completionTokens: 50, costMicroUsd: 100 },
      }
    })

    await runRubricStage({
      contractId: 'c1',
      criteria: [
        {
          key: 'c_consistency',
          statement: 'Conforms to m1 guide',
          pass_threshold: 0.7,
          context_milestones: ['m1'],
        },
      ],
      artifact,
      contextArtifacts: { m1: m1Artifact },
    })

    expect(capturedPrompt).toContain('Milestone 1 Accepted Schema & Style Guide')
    expect(capturedPrompt).toContain('conforming to guide')
  })
})
