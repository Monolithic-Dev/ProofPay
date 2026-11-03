/**
 * Automated copy & honesty policy checker.
 * Enforces docs/v2/01-product-vision-and-scope.md §8 and docs/v2/08-current-build-review.md §B.
 * Run with: node scripts/check-copy.mjs
 */
import fs from 'fs'
import path from 'path'

const FORBIDDEN_PATTERNS = [
  {
    name: 'Escrow claim (forbidden unless explicitly clarifying "not escrow")',
    regex: /\bescrow\b/i,
    allowedCheck: (line) =>
      /not\s+(an?\s+|a\s+traditional\s+)?escrow/i.test(line) ||
      /no\s+escrow/i.test(line) ||
      /\bnon-escrow\b/i.test(line) ||
      /\bhold\s+vs\s+escrow\b/i.test(line) ||
      /\bis\s+this\s+escrow/i.test(line) ||
      /\bauthorization\s+hold,\s+not\s+escrow\b/i.test(line) ||
      /\bnot\s+an\s+escrow\s+agent\b/i.test(line),
  },
  {
    name: 'Overclaim: proof of funds',
    regex: /proof\s+of\s+funds/i,
  },
  {
    name: 'Overclaim: guaranteed payment / funds',
    regex: /guaranteed\s+(payment|funds)/i,
  },
  {
    name: 'Overclaim: autonomous negotiation (unbuilt feature)',
    regex: /autonomous\s+agents\s+negotiate/i,
  },
  {
    name: 'Overclaim: 100% accurate',
    regex: /100%\s+accurate/i,
  },
  {
    name: 'Overclaim: legally binding',
    regex: /legally\s+binding/i,
  },
  {
    name: 'Overclaim: bank-grade',
    regex: /bank-grade/i,
  },
  {
    name: 'Overclaim: insured',
    regex: /\binsured\b/i,
  },
  {
    name: 'Preserves escrow',
    regex: /preserves?\s+escrow/i,
  },
  {
    name: 'Auto-releases escrow',
    regex: /auto-releases?\s+escrow/i,
  },
  {
    name: 'Locks authorization holds (inaccurate)',
    regex: /locks\s+authorization/i,
  },
]

function walkDir(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git', 'dist'].includes(entry.name)) continue
      walkDir(fullPath, callback)
    } else if (/\.(tsx?|jsx?|md)$/.test(entry.name)) {
      // Exclude documentation review files that quote the forbidden text
      if (fullPath.includes('08-current-build-review.md')) continue
      if (fullPath.includes('01-product-vision-and-scope.md')) continue
      callback(fullPath)
    }
  }
}

let totalViolations = 0

console.log('🔍 Checking codebase for honesty policy & claims compliance...\n')

walkDir('src', (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  lines.forEach((line, idx) => {
    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.regex.test(line)) {
        if (rule.allowedCheck && rule.allowedCheck(line)) {
          continue
        }
        console.error(`❌ [${rule.name}] at ${filePath}:${idx + 1}`)
        console.error(`   "${line.trim()}"\n`)
        totalViolations++
      }
    }
  })
})

if (totalViolations === 0) {
  console.log('✅ Honesty policy check passed: zero copy violations found across src/!\n')
  process.exit(0)
} else {
  console.error(`❌ Total copy violations found: ${totalViolations}`)
  process.exit(1)
}
