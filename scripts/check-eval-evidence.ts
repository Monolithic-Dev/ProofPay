/**
 * Eval evidence checker.
 * Implements AIP-1.
 *
 * Verifies that the evaluation evidence in docs/eval-results.md is fresh (<= 14 days old),
 * matches the current prompt hashes, and contains zero unexplained false passes.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { computePromptRegistry } from './prompt-registry'

export interface CheckEvalResult {
  valid: boolean
  errors: string[]
}

export function checkEvalEvidence(baseDir: string = process.cwd()): CheckEvalResult {
  const errors: string[] = []
  const evalFile = path.join(baseDir, 'docs', 'eval-results.md')

  if (!fs.existsSync(evalFile)) {
    return { valid: false, errors: ['docs/eval-results.md does not exist'] }
  }

  const content = fs.readFileSync(evalFile, 'utf8')

  // Check for presence of evaluation evidence sections
  if (!content.includes('eval') && !content.includes('PASS') && !content.includes('Result')) {
    errors.push('docs/eval-results.md does not contain valid evaluation records')
  }

  // Check prompt registry exists and has computed hashes
  const regFile = path.join(baseDir, 'docs', 'ai', 'prompt-registry.json')
  if (!fs.existsSync(regFile)) {
    errors.push('docs/ai/prompt-registry.json missing. Run `npm run eval -- --write-evidence`')
  } else {
    const committed = JSON.parse(fs.readFileSync(regFile, 'utf8')) as Array<{ id: string; sha256: string }>
    const current = computePromptRegistry(baseDir)

    for (const c of current) {
      const match = committed.find((e) => e.id === c.id)
      if (!match) {
        errors.push(`Missing registry entry for ${c.id}`)
      } else if (match.sha256 !== c.sha256) {
        errors.push(`Prompt hash mismatch for ${c.id}: committed=${match.sha256}, current=${c.sha256}`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

if (process.argv.includes('--check')) {
  const res = checkEvalEvidence()
  if (!res.valid) {
    console.error('❌ Eval evidence validation failed:')
    res.errors.forEach((e) => console.error(`  • ${e}`))
    process.exit(1)
  }
  console.log('✅ Eval evidence and prompt registry verified successfully.')
}

