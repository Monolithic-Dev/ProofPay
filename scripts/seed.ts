/**
 * Database seed script — creates the 5 core demo personas.
 * Implements phase-2-data-layer.md §2.11.
 */
import postgres from 'postgres'

const DATABASE_URL =
  process.env['DATABASE_URL'] || 'postgresql://proofpay:proofpay@localhost:5432/proofpay'

export const DEMO_PERSONAS = [
  {
    email: 'buyer@demo.proofpay',
    displayName: 'Sarah Buyer',
    role: 'buyer' as const,
    isAgent: false,
    personaKey: 'buyer',
  },
  {
    email: 'seller@demo.proofpay',
    displayName: 'Alex Seller',
    role: 'seller' as const,
    isAgent: false,
    personaKey: 'seller',
  },
  {
    email: 'buyer-agent@demo.proofpay',
    displayName: 'ProcureBot',
    role: 'buyer' as const,
    isAgent: true,
    personaKey: 'buyer_agent',
  },
  {
    email: 'worker-agent@demo.proofpay',
    displayName: 'SynthetixBot',
    role: 'seller' as const,
    isAgent: true,
    personaKey: 'worker_agent',
  },
  {
    email: 'admin@demo.proofpay',
    displayName: 'Platform Admin',
    role: 'admin' as const,
    isAgent: false,
    personaKey: 'admin',
  },
]

export async function seedDatabase(dbUrl = DATABASE_URL): Promise<void> {
  const nodeEnv = process.env['NODE_ENV']
  const demoMode = process.env['DEMO_MODE'] ?? 'true'

  if (nodeEnv === 'production' && demoMode !== 'true') {
    console.warn('⚠️ Skipping seed: refusing to run in production without DEMO_MODE=true')
    return
  }

  console.log(`🌱 Seeding demo personas into ${dbUrl.replace(/:[^:@]+@/, ':***@')}...`)
  const sql = postgres(dbUrl, { max: 1 })

  try {
    for (const p of DEMO_PERSONAS) {
      const [inserted] = await sql`
        INSERT INTO users (email, display_name, role, is_agent, persona_key)
        VALUES (${p.email}, ${p.displayName}, ${p.role}, ${p.isAgent}, ${p.personaKey})
        ON CONFLICT (email) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            role = EXCLUDED.role,
            is_agent = EXCLUDED.is_agent,
            persona_key = EXCLUDED.persona_key
        RETURNING id, email, display_name, role, persona_key;
      `
      console.log(`  ✓ Persona: ${inserted?.['display_name']} (${inserted?.['persona_key']}) -> ${inserted?.['id']}`)
    }
    console.log('✅ Seeding complete.')
  } catch (err) {
    console.error('❌ Seeding failed:', err)
    throw err
  } finally {
    await sql.end()
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
