/**
 * Prompt Registry & SHA-256 Hasher.
 * Implements AIP-1.
 *
 * Computes deterministic hashes of all prompts and policy files to guarantee
 * that any change in prompt instructions or decision logic requires fresh eval evidence.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'

export interface PromptRegistryEntry {
  id: string
  version: string
  file: string
  sha256: string
}

export const REGISTRY_TARGET_FILES: Array<{ id: string; version: string; file: string }> = [
  { id: 'compile', version: 'v1', file: 'src/server/ai/prompts/compile.v1.ts' },
  { id: 'rubric', version: 'v1', file: 'src/server/ai/prompts/rubric.v1.ts' },
  { id: 'adversarial', version: 'v1', file: 'src/server/verify/adversarial.ts' },
  { id: 'policy', version: 'v1', file: 'src/server/verify/policy.ts' },
]

export function computePromptRegistry(baseDir: string = process.cwd()): PromptRegistryEntry[] {
  const registry: PromptRegistryEntry[] = []

  for (const item of REGISTRY_TARGET_FILES) {
    const fullPath = path.join(baseDir, item.file)
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8')
      const normalized = content.replace(/\r\n/g, '\n')
      const hash = crypto.createHash('sha256').update(normalized).digest('hex')
      registry.push({
        id: item.id,
        version: item.version,
        file: item.file.replace(/\\/g, '/'),
        sha256: hash,
      })
    }
  }

  return registry
}

export function writePromptRegistry(baseDir: string = process.cwd()): string {
  const entries = computePromptRegistry(baseDir)
  const outDir = path.join(baseDir, 'docs', 'ai')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }
  const outFile = path.join(outDir, 'prompt-registry.json')
  fs.writeFileSync(outFile, JSON.stringify(entries, null, 2), 'utf8')
  return outFile
}

if (process.argv.includes('--write')) {
  const file = writePromptRegistry()
  console.log(`✓ Prompt registry written to ${file}`)
}

