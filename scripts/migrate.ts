/**
 * Migration runner script — runs all .sql files in ./drizzle in sequential order.
 * Implements phase-2-data-layer.md §2.3.
 */
import fs from 'fs'
import path from 'path'
import postgres from 'postgres'

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

const DATABASE_URL =
  process.env['DATABASE_URL'] || 'postgresql://proofpay:proofpay@localhost:5435/proofpay'

export async function runMigrations(dbUrl = DATABASE_URL): Promise<void> {
  console.log(`🔌 Connecting to database: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`)
  const sql = postgres(dbUrl, { max: 1 })

  try {
    // 1. Ensure migrations tracking table exists
    await sql`
      CREATE TABLE IF NOT EXISTS __proofpay_migrations (
        id serial PRIMARY KEY,
        name text NOT NULL UNIQUE,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `

    // 2. Read migration files from ./drizzle
    const migrationsDir = path.resolve(process.cwd(), 'drizzle')
    if (!fs.existsSync(migrationsDir)) {
      console.log('No drizzle directory found. Skipping migrations.')
      return
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    // 3. Apply pending migrations sequentially
    for (const file of files) {
      const alreadyApplied = await sql`
        SELECT 1 FROM __proofpay_migrations WHERE name = ${file} LIMIT 1
      `
      if (alreadyApplied.length > 0) {
        console.log(`  ✓ ${file} (already applied)`)
        continue
      }

      console.log(`  ⚡ Applying ${file}...`)
      const filePath = path.join(migrationsDir, file)
      const content = fs.readFileSync(filePath, 'utf8')

      await sql.begin(async (tx) => {
        await tx.unsafe(content)
        await tx`INSERT INTO __proofpay_migrations (name) VALUES (${file})`
      })

      console.log(`  ✓ ${file} applied successfully`)
    }

    console.log('🎉 All migrations applied successfully.')
  } catch (err) {
    console.error('❌ Migration failed:', err)
    throw err
  } finally {
    await sql.end()
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
