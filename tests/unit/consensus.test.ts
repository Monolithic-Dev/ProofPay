import { describe, it, expect } from 'vitest'
import { evaluateConsensus, type ModelVerdict } from '@/server/verify/consensus'

describe('Cross-Model Consensus Engine (F3)', () => {
  it('approves when both providers unanimously pass', () => {
    const v1: ModelVerdict = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      verdict: 'pass',
      quote: 'Data meets all requirements',
      confidence: 0.98,
    }
    const v2: ModelVerdict = {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      verdict: 'pass',
      quote: 'Data meets all requirements',
      confidence: 0.95,
    }

    const res = evaluateConsensus(v1, v2)
    expect(res.unanimous).toBe(true)
    expect(res.recommendation).toBe('PASS')
  })

  it('rejects when both providers agree it failed', () => {
    const v1: ModelVerdict = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      verdict: 'fail',
      quote: null,
      confidence: 0.9,
    }
    const v2: ModelVerdict = {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      verdict: 'fail',
      quote: null,
      confidence: 0.92,
    }

    const res = evaluateConsensus(v1, v2)
    expect(res.unanimous).toBe(true)
    expect(res.recommendation).toBe('REJECT')
  })

  it('safely escalates to human review when providers disagree', () => {
    const v1: ModelVerdict = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      verdict: 'pass',
      quote: 'Found quote',
      confidence: 0.75,
    }
    const v2: ModelVerdict = {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      verdict: 'fail',
      quote: null,
      confidence: 0.8,
    }

    const res = evaluateConsensus(v1, v2)
    expect(res.unanimous).toBe(false)
    expect(res.recommendation).toBe('ESCALATE')
  })
})
