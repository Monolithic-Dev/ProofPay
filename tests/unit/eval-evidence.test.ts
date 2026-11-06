import { describe, it, expect } from 'vitest'
import { computePromptRegistry } from '@/../scripts/prompt-registry'
import { checkEvalEvidence } from '@/../scripts/check-eval-evidence'

describe('AIP-1 Prompt Registry & Eval Evidence Gate', () => {
  it('computes deterministic SHA-256 hashes for all prompts and policies', () => {
    const registry = computePromptRegistry()
    expect(registry.length).toBeGreaterThanOrEqual(4)

    const rubric = registry.find((r) => r.id === 'rubric')
    expect(rubric).toBeDefined()
    expect(rubric?.sha256).toMatch(/^[0-9a-f]{64}$/)

    const policy = registry.find((r) => r.id === 'policy')
    expect(policy).toBeDefined()
    expect(policy?.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('validates committed prompt registry and evidence file', () => {
    const result = checkEvalEvidence()
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

