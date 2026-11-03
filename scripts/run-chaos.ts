/**
 * PayPal Chaos Suite Runner Entrypoint
 * Implements phase-8-testing-and-hardening.md §8.3 & testing.md §5.
 * Usage: npm run chaos
 */
import fs from 'fs'
import path from 'path'

// Load .env if present
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

process.env['NODE_ENV'] = process.env['NODE_ENV'] || 'test'
process.env['DATABASE_URL'] =
  process.env['DATABASE_URL'] || 'postgresql://proofpay:proofpay@localhost:5435/proofpay'
process.env['PAYPAL_ENV'] = process.env['PAYPAL_ENV'] || 'sandbox'
process.env['PAYPAL_CLIENT_ID'] = process.env['PAYPAL_CLIENT_ID'] || 'mock_chaos_client_id'
process.env['PAYPAL_CLIENT_SECRET'] =
  process.env['PAYPAL_CLIENT_SECRET'] || 'mock_chaos_client_secret'
process.env['ANTHROPIC_API_KEY'] = process.env['ANTHROPIC_API_KEY'] || 'mock_chaos_anthropic_key'
process.env['SESSION_SECRET'] =
  process.env['SESSION_SECRET'] || 'mock_test_session_secret_min_32_characters_long'
process.env['DEMO_MODE'] = process.env['DEMO_MODE'] || 'true'
process.env['CHAOS_MODE'] = 'true'

// Dynamic import to ensure process.env is set before env.ts is evaluated
import('../tests/chaos/runner')
  .then(({ main }) => main())
  .catch((err) => {
    console.error('Chaos suite failed:', err)
    process.exit(1)
  })
