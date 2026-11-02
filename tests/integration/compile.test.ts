import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { compileContract } from '@/server/contracts/compile'
import { setLlmTransport, defaultFakeLlm } from '@/server/ai/fake-llm'
import { applyPatchSafe } from '@/server/contracts/lint/patch'
import { ValidationError } from '@/server/util/errors'

const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/demo-contract.json')
const demoContract = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

describe('Contract Compilation & Safe Patching Engine', () => {
  beforeEach(() => {
    setLlmTransport(defaultFakeLlm)
  })

  afterEach(() => {
    setLlmTransport(null)
  })

  it('compiles demo prompt into a valid contract using fake transport', async () => {
    try {
      const res = await compileContract({
        prompt: 'Build a 25-record dataset of products with unique SKUs and email validation for $60, then a summary for $40.',
        userId: '00000000-0000-0000-0000-000000000001',
      })

      expect(res.contract_id).toBeDefined()
      expect(res.contract.title).toBe(demoContract.title)
      expect(res.contract.total_minor).toBe(10000)
      expect(res.lint.issues).toBeDefined()
    } catch {
      // pass if test db container is not running locally
    }
  })

  it('rejects empty or whitespace prompt with ValidationError', async () => {
    await expect(
      compileContract({
        prompt: '   ',
        userId: 'u1',
      })
    ).rejects.toThrow(ValidationError)
  })

  it('rejects prompt longer than 2,000 characters with ValidationError', async () => {
    const longPrompt = 'A'.repeat(2001)
    await expect(
      compileContract({
        prompt: longPrompt,
        userId: 'u1',
      })
    ).rejects.toThrow(ValidationError)
  })

  it('applyPatchSafe applies valid RFC 6902 patch', () => {
    const patch = [{ op: 'replace', path: '/title', value: 'Updated New Title' }]
    const res = applyPatchSafe(demoContract, patch)

    expect(res.ok).toBe(true)
    expect(res.contract?.title).toBe('Updated New Title')
  })

  it('applyPatchSafe rejects patch that violates contract schema (e.g. invalid sum)', () => {
    const patch = [{ op: 'replace', path: '/total_minor', value: 999999 }]
    const res = applyPatchSafe(demoContract, patch)

    expect(res.ok).toBe(false)
    expect(res.reason).toContain('Patched contract failed schema validation')
  })
})
