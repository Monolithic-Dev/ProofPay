import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// ---------------------------------------------------------------------------
// Singleton DB client
// ---------------------------------------------------------------------------
let _client: ReturnType<typeof postgres> | undefined
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined

function getDbUrl(): string {
  // During testing we use TEST_DATABASE_URL
  if (process.env['NODE_ENV'] === 'test') {
    return process.env['TEST_DATABASE_URL'] ?? 'postgresql://proofpay:proofpay@localhost:5432/proofpay_test'
  }
  return process.env['DATABASE_URL'] ?? ''
}

export function getDb() {
  if (!_db) {
    const url = getDbUrl()
    if (!url) throw new Error('DATABASE_URL is not set')
    _client = postgres(url, {
      max: 10,
      idle_timeout: 30,
      connection: {
        application_name: 'proofpay',
      },
    })
    _db = drizzle(_client, { schema })
  }
  return _db
}

// For tests / migrations
export async function closeDb() {
  if (_client) {
    await _client.end()
    _client = undefined
    _db = undefined
  }
}

export type Db = ReturnType<typeof getDb>
