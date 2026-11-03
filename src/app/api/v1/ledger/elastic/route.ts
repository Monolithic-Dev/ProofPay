import { NextResponse } from 'next/server'
import { getDb } from '@/server/db/client'
import { ledger_events } from '@/server/db/schema'
import { asc } from 'drizzle-orm'
import { formatElasticBulkNdjson, formatLedgerEventToEcs } from '@/server/ledger/elastic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'json'

  const db = getDb()
  const events = await db
    .select()
    .from(ledger_events)
    .orderBy(asc(ledger_events.seq))
    .limit(500)

  if (format === 'ndjson' || format === 'bulk') {
    const ndjson = formatElasticBulkNdjson(events)
    return new NextResponse(ndjson, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Content-Disposition': 'attachment; filename="proofpay-elastic-bulk.ndjson"',
      },
    })
  }

  const ecsRecords = events.map(formatLedgerEventToEcs)
  return NextResponse.json({
    ecs_version: '8.11.0',
    count: ecsRecords.length,
    events: ecsRecords,
  })
}
