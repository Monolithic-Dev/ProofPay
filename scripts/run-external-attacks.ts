/**
 * External Red Team Submissions Runner.
 * Implements AIP-14 external red-team verification.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

// Mock environment for standalone evaluation
process.env['DATABASE_URL'] = process.env['DATABASE_URL'] || 'postgresql://proofpay:proofpay@localhost:5435/proofpay'
process.env['PAYPAL_ENV'] = process.env['PAYPAL_ENV'] || 'sandbox'
process.env['PAYPAL_CLIENT_ID'] = process.env['PAYPAL_CLIENT_ID'] || 'mock_eval_client_id'
process.env['PAYPAL_CLIENT_SECRET'] = process.env['PAYPAL_CLIENT_SECRET'] || 'mock_eval_client_secret'
process.env['ANTHROPIC_API_KEY'] = process.env['ANTHROPIC_API_KEY'] || 'mock_eval_anthropic_key'
process.env['SESSION_SECRET'] = process.env['SESSION_SECRET'] || 'mock_test_session_secret_min_32_characters_long'
process.env['DEMO_MODE'] = process.env['DEMO_MODE'] || 'true'
process.env['LLM_TRANSPORT'] = 'fake'

export interface AttackSubmission {
  author: string
  family: string
  milestone: 'm1' | 'm2'
  artifact: any
  goal: string
}

export interface AttackRunResult {
  file: string
  author: string
  family: string
  blocked: boolean
  decision: 'REJECT' | 'ESCALATE' | 'PASS'
  severity: string
  reasons: string[]
}

export async function runExternalAttacks(
  submissionsDir: string = path.join(process.cwd(), 'bench', 'submissions')
): Promise<AttackRunResult[]> {
  const { runAdversarialStage } = await import('../src/server/verify/adversarial')
  const results: AttackRunResult[] = []

  if (!fs.existsSync(submissionsDir)) {
    return results
  }

  const files = fs.readdirSync(submissionsDir).filter((f) => f.endsWith('.json'))

  for (const file of files) {
    const fullPath = path.join(submissionsDir, file)
    let content: AttackSubmission
    try {
      content = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
    } catch {
      continue
    }

    if (!content.author || !content.family || !content.artifact) {
      continue
    }

    const text = typeof content.artifact === 'string'
      ? content.artifact
      : JSON.stringify(content.artifact)

    const scan = await runAdversarialStage({
      contractId: 'bench-attack',
      artifactText: text,
    })

    const blocked = scan.severity !== 'none'
    const decision: 'REJECT' | 'ESCALATE' | 'PASS' =
      scan.severity === 'high' ? 'REJECT' : scan.severity === 'low' ? 'ESCALATE' : 'PASS'

    results.push({
      file,
      author: content.author,
      family: content.family,
      blocked,
      decision,
      severity: scan.severity,
      reasons: scan.spans.map((s) => s.reason || s.quote),
    })
  }

  return results
}

if (process.argv.includes('--run')) {
  runExternalAttacks().then((res) => {
    console.log(`\n🛡️ Ran ${res.length} External Attack Submissions:`)
    let blockedCount = 0
    for (const r of res) {
      if (r.blocked) blockedCount++
      console.log(`• [${r.file}] Author: ${r.author} | Family: ${r.family} -> Decision: ${r.decision} (Severity: ${r.severity})`)
    }
    console.log(`Summary: ${blockedCount}/${res.length} attacks successfully blocked.`)
  })
}
