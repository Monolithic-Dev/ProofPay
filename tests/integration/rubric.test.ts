/**
 * Integration tests for Rubric Stage (FakeLLM).
 * Implements phase-4-verification-engine.md §4.4 & task 4.4 tests.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { runRubricStage } from '@/server/verify/rubric'
import { setLlmTransport, type FakeLlmResponse } from '@/server/ai/fake-llm'
import { parseArtifact } from '@/server/verify/artifact'
import { buildRubricPrompt } from '@/server/ai/prompts/rubric.v1'

describe('runRubricStage Integration (FakeLLM)', () => {
  beforeEach(() => {
    setLlmTransport(null)
  })

  afterEach(() => {
    setLlmTransport(null)
  })

  const validText = `ProofPay is a cryptographic smart contract engine.
It uses deterministic checks and semantic rubric evaluation to prove delivery.
Release funds safely and automatically.`

  it('pass with verified quote stays pass', async () => {
    setLlmTransport(async <T>() => ({
      data: {
        results: [
          {
            criterion_key: 'c1',
            verdict: 'pass',
            score: 0.95,
            confidence: 0.9,
            evidence: [{ quote: 'ProofPay is a cryptographic smart contract engine.' }],
            reasoning: 'Found exact sentence in text',
          },
        ],
      } as unknown as T,
      usage: { promptTokens: 50, completionTokens: 50, costMicroUsd: 100 },
    }))

    const artifact = parseArtifact('text', validText)
    const out = await runRubricStage({
      contractId: 'c1',
      criteria: [{ key: 'c1', statement: 'Mentions engine', pass_threshold: 0.7 }],
      artifact,
    })

    expect(out.unavailable).toBe(false)
    expect(out.results.length).toBe(1)
    expect(out.results[0]!.verdict).toBe('pass')
    expect(out.results[0]!.evidence_verified).toBe(true)
  })

  it('pass without verified quote becomes cannot_verify', async () => {
    setLlmTransport(async <T>() => ({
      data: {
        results: [
          {
            criterion_key: 'c1',
            verdict: 'pass',
            score: 0.95,
            confidence: 0.9,
            evidence: [{ quote: 'This quote was hallucinated and never written in deliverable' }],
            reasoning: 'Fake pass with hallucinated quote',
          },
        ],
      } as unknown as T,
      usage: { promptTokens: 50, completionTokens: 50, costMicroUsd: 100 },
    }))

    const artifact = parseArtifact('text', validText)
    const out = await runRubricStage({
      contractId: 'c1',
      criteria: [{ key: 'c1', statement: 'Mentions hallucination', pass_threshold: 0.7 }],
      artifact,
    })

    expect(out.results[0]!.verdict).toBe('cannot_verify')
    expect(out.results[0]!.evidence_verified).toBe(false)
  })

  it('score below threshold becomes fail', async () => {
    setLlmTransport(async <T>() => ({
      data: {
        results: [
          {
            criterion_key: 'c1',
            verdict: 'pass', // LLM claims pass, but score 0.5 < threshold 0.8
            score: 0.5,
            confidence: 0.85,
            evidence: [{ quote: 'Release funds safely and automatically.' }],
            reasoning: 'Mediocre quality',
          },
        ],
      } as unknown as T,
      usage: { promptTokens: 50, completionTokens: 50, costMicroUsd: 100 },
    }))

    const artifact = parseArtifact('text', validText)
    const out = await runRubricStage({
      contractId: 'c1',
      criteria: [{ key: 'c1', statement: 'High quality threshold', pass_threshold: 0.8 }],
      artifact,
    })

    expect(out.results[0]!.verdict).toBe('fail')
  })

  it('fail keeps verdict and marks evidence_unverified when quote missing', async () => {
    setLlmTransport(async <T>() => ({
      data: {
        results: [
          {
            criterion_key: 'c1',
            verdict: 'fail',
            score: 0.2,
            confidence: 0.9,
            evidence: [{ quote: 'Nonexistent quote used to explain failure' }],
            reasoning: 'Missing required sections',
          },
        ],
      } as unknown as T,
      usage: { promptTokens: 50, completionTokens: 50, costMicroUsd: 100 },
    }))

    const artifact = parseArtifact('text', validText)
    const out = await runRubricStage({
      contractId: 'c1',
      criteria: [{ key: 'c1', statement: 'Required sections', pass_threshold: 0.7 }],
      artifact,
    })

    expect(out.results[0]!.verdict).toBe('fail')
    expect(out.results[0]!.evidence_verified).toBe(false)
  })

  it('truncated artifact caps verdict at cannot_verify when quote cannot be verified', async () => {
    // Generate text > 60k chars
    const largeText = 'A'.repeat(65_000)
    const artifact = parseArtifact('text', largeText)

    setLlmTransport(async <T>() => ({
      data: {
        results: [
          {
            criterion_key: 'c1',
            verdict: 'pass',
            score: 0.9,
            confidence: 0.9,
            evidence: [{ quote: 'Quote that cannot be verified in deliverable' }],
            reasoning: 'Passed',
          },
        ],
      } as unknown as T,
      usage: { promptTokens: 50, completionTokens: 50, costMicroUsd: 100 },
    }))

    const out = await runRubricStage({
      contractId: 'c1',
      criteria: [{ key: 'c1', statement: 'Ending check', pass_threshold: 0.7 }],
      artifact,
    })

    expect(out.truncated).toBe(true)
    expect(out.results[0]!.verdict).toBe('cannot_verify')
  })

  it('unavailable LLM returns unavailable flag in degraded mode', async () => {
    setLlmTransport(async () => {
      throw new Error('LLM Service Unavailable')
    })

    const artifact = parseArtifact('text', validText)
    const out = await runRubricStage({
      contractId: 'c1',
      criteria: [{ key: 'c1', statement: 'Any check', pass_threshold: 0.7 }],
      artifact,
    })

    expect(out.unavailable).toBe(true)
    expect(out.results.length).toBe(0)
  })

  it('prompt wraps submission in nonce delimiters and includes context artifacts correctly', () => {
    const prompt = buildRubricPrompt({
      criteria: [
        { key: 'c1', statement: 'Independent criteria' },
        { key: 'c2', statement: 'Dependent on m1', context_milestones: ['m1'] },
      ],
      contextArtifacts: { m1: 'Accepted milestone 1 deliverable' },
      artifactText: 'Test submission artifact',
      contentType: 'text',
      nonce: 'abcd12',
    })

    expect(prompt.user).toContain('<<<SUBMISSION-abcd12 content_type=text>>>')
    expect(prompt.user).toContain('<<<END-SUBMISSION-abcd12>>>')
    expect(prompt.user).toContain('Accepted milestone 1 deliverable')
    expect(prompt.user).toContain('Dependent on m1')
  })
})
