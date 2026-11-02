/**
 * Contract Live Events SSE Route — GET /api/v1/contracts/[id]/events?after_seq=
 * Emits SSE contract.updated events from ledger_events polling every 1.5s.
 * Implements phase-6-frontend.md §6.2 & Correction C-3.
 */
import { eq, gt, asc } from 'drizzle-orm'
import { apiHandler } from '@/server/http/handler'
import { getDb } from '@/server/db/client'
import { ledger_events } from '@/server/db/schema'
import { requireParty } from '@/server/auth/guards'

export const dynamic = 'force-dynamic'

export const GET = apiHandler(
  { auth: 'user' },
  async ({ user, params, req }) => {
    const contractId = params['id']!
    const db = getDb()

    // Enforce authorization: stranger gets 404
    await requireParty(db, contractId, user!)

    const url = new URL(req.url)
    const afterSeqParam = url.searchParams.get('after_seq')

    // Determine initial lastSeq
    let lastSeq = 0
    if (afterSeqParam !== null && !isNaN(parseInt(afterSeqParam, 10))) {
      lastSeq = parseInt(afterSeqParam, 10)
    } else {
      // Default to current head seq
      const [head] = await db
        .select({ seq: ledger_events.seq })
        .from(ledger_events)
        .where(eq(ledger_events.contract_id, contractId))
        .orderBy(asc(ledger_events.seq))
      if (head) {
        const all = await db
          .select({ seq: ledger_events.seq })
          .from(ledger_events)
          .where(eq(ledger_events.contract_id, contractId))
          .orderBy(asc(ledger_events.seq))
        lastSeq = all[all.length - 1]?.seq ?? 0
      }
    }

    const encoder = new TextEncoder()
    let pollTimer: NodeJS.Timeout | null = null
    let pingTimer: NodeJS.Timeout | null = null
    let maxLifeTimer: NodeJS.Timeout | null = null
    let isClosed = false

    const stream = new ReadableStream({
      start(controller) {
        const cleanup = () => {
          if (isClosed) return
          isClosed = true
          if (pollTimer) clearInterval(pollTimer)
          if (pingTimer) clearInterval(pingTimer)
          if (maxLifeTimer) clearTimeout(maxLifeTimer)
          try {
            controller.close()
          } catch {
            // controller might already be closed
          }
        }

        req.signal.addEventListener('abort', cleanup)

        // Heartbeat comment every 15s
        pingTimer = setInterval(() => {
          if (isClosed) return
          try {
            controller.enqueue(encoder.encode(': ping\n\n'))
          } catch {
            cleanup()
          }
        }, 15000)

        // Poll for new ledger events every 1.5s
        pollTimer = setInterval(async () => {
          if (isClosed) return
          try {
            const newEvents = await db
              .select({
                seq: ledger_events.seq,
                type: ledger_events.type,
                payload: ledger_events.payload,
              })
              .from(ledger_events)
              .where(
                eq(ledger_events.contract_id, contractId) && gt(ledger_events.seq, lastSeq)
              )
              .orderBy(asc(ledger_events.seq))

            // Extra safety filter
            const filtered = newEvents.filter((e) => e.seq > lastSeq)

            for (const ev of filtered) {
              lastSeq = ev.seq
              const payload = ev.payload as Record<string, unknown>
              const milestoneKey =
                typeof payload?.milestone_key === 'string' ? payload.milestone_key : undefined

              const message = JSON.stringify({
                contract_id: contractId,
                type: ev.type,
                milestone_key: milestoneKey,
                seq: ev.seq,
              })

              controller.enqueue(encoder.encode(`event: contract.updated\ndata: ${message}\n\n`))
            }
          } catch {
            // DB query error or controller closed
            cleanup()
          }
        }, 1500)

        // Max stream life 25 minutes (client reconnects with after_seq)
        maxLifeTimer = setTimeout(cleanup, 25 * 60 * 1000)
      },
      cancel() {
        if (pollTimer) clearInterval(pollTimer)
        if (pingTimer) clearInterval(pingTimer)
        if (maxLifeTimer) clearTimeout(maxLifeTimer)
        isClosed = true
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      },
    })
  }
)
